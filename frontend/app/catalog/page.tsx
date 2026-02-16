"use client";

import { useEffect, useMemo, useState } from "react";
import ActionModal from "../../components/ActionModal";
import SearchableSelect from "../../components/SearchableSelect";
import { useToast } from "../../components/ToastProvider";
import { createBook, deleteBook, getBooks, queryBooks, updateBook } from "../../lib/api";

const initialBookForm = {
  title: "",
  author: "",
  subject: "",
  rack_number: "",
  isbn: "",
  published_year: "",
  copies_total: "1",
};

type BookModalMode = "create" | "edit" | null;

export default function CatalogPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [allBooks, setAllBooks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [authorFilter, setAuthorFilter] = useState<string[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("title_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);

  const [modalMode, setModalMode] = useState<BookModalMode>(null);
  const [activeBookId, setActiveBookId] = useState<number | null>(null);
  const [bookForm, setBookForm] = useState(initialBookForm);

  const sortConfigMap: Record<string, { sort_by: string; sort_order: "asc" | "desc" }> = {
    title_asc: { sort_by: "title", sort_order: "asc" },
    title_desc: { sort_by: "title", sort_order: "desc" },
    author_asc: { sort_by: "author", sort_order: "asc" },
    author_desc: { sort_by: "author", sort_order: "desc" },
    subject_asc: { sort_by: "subject", sort_order: "asc" },
    subject_desc: { sort_by: "subject", sort_order: "desc" },
    available_desc: { sort_by: "available", sort_order: "desc" },
    available_asc: { sort_by: "available", sort_order: "asc" },
    id_desc: { sort_by: "id", sort_order: "desc" },
    id_asc: { sort_by: "id", sort_order: "asc" },
  };

  const loadStats = async () => {
    setAllBooks(await getBooks());
  };

  const loadPage = async (showSuccess = false) => {
    setLoading(true);
    try {
      const sortConfig = sortConfigMap[sortBy] || sortConfigMap.title_asc;
      const rows = await queryBooks({
        q: search.trim() || undefined,
        author: authorFilter,
        subject: subjectFilter,
        availability: availabilityFilter,
        sort_by: sortConfig.sort_by,
        sort_order: sortConfig.sort_order,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      });
      setBooks(rows);
      setHasNextPage(rows.length === pageSize);
      if (showSuccess) {
        showToast({ type: "success", title: "Catalog refreshed" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load books",
        description: err.message || "Request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (showSuccess = false) => {
    try {
      await Promise.all([loadPage(showSuccess), loadStats()]);
    } catch {
      // Errors are already handled in child loaders.
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    loadPage();
  }, [search, authorFilter, subjectFilter, availabilityFilter, sortBy, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, authorFilter, subjectFilter, availabilityFilter, sortBy, pageSize]);

  const stats = useMemo(() => {
    const totalTitles = allBooks.length;
    const totalCopies = allBooks.reduce((sum, book) => sum + book.copies_total, 0);
    const availableCopies = allBooks.reduce((sum, book) => sum + book.copies_available, 0);
    const lowStock = allBooks.filter((book) => book.copies_available <= 1).length;
    return { totalTitles, totalCopies, availableCopies, lowStock };
  }, [allBooks]);

  const authorOptions = useMemo(() => {
    const values = Array.from(
      new Set(allBooks.map((book) => (book.author || "").trim()).filter(Boolean))
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [allBooks]);

  const subjectOptions = useMemo(() => {
    const values = Array.from(
      new Set(allBooks.map((book) => (book.subject || "").trim()).filter(Boolean))
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [allBooks]);

  const authorFilterOptions = useMemo(
    () =>
      authorOptions.map((author) => ({
        value: author,
        label: author,
        keywords: author,
      })),
    [authorOptions]
  );

  const subjectFilterOptions = useMemo(
    () =>
      subjectOptions.map((subject) => ({
        value: subject,
        label: subject,
        keywords: subject,
      })),
    [subjectOptions]
  );

  const availabilityFilterOptions = [
    { value: "available", label: "Available only" },
    { value: "unavailable", label: "Unavailable only" },
  ];

  const sortOptions = [
    { value: "title_asc", label: "Title A-Z" },
    { value: "title_desc", label: "Title Z-A" },
    { value: "author_asc", label: "Author A-Z" },
    { value: "author_desc", label: "Author Z-A" },
    { value: "subject_asc", label: "Category A-Z" },
    { value: "subject_desc", label: "Category Z-A" },
    { value: "available_desc", label: "Availability High-Low" },
    { value: "available_asc", label: "Availability Low-High" },
    { value: "id_desc", label: "Book ID Newest" },
    { value: "id_asc", label: "Book ID Oldest" },
  ];

  const closeModal = () => setModalMode(null);

  const openCreateModal = () => {
    setActiveBookId(null);
    setBookForm(initialBookForm);
    setModalMode("create");
  };

  const openEditModal = (book: any) => {
    setActiveBookId(book.id);
    setBookForm({
      title: book.title || "",
      author: book.author || "",
      subject: book.subject || "",
      rack_number: book.rack_number || "",
      isbn: book.isbn || "",
      published_year: book.published_year ? String(book.published_year) : "",
      copies_total: String(book.copies_total || 1),
    });
    setModalMode("edit");
  };

  const handleBookSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const copies = Number(bookForm.copies_total);
    if (!Number.isFinite(copies) || copies < 1) {
      showToast({ type: "error", title: "Total copies must be 1 or higher" });
      return;
    }
    const publishedYear = bookForm.published_year.trim()
      ? Number(bookForm.published_year)
      : undefined;
    if (
      publishedYear !== undefined
      && (!Number.isInteger(publishedYear) || publishedYear < 0 || publishedYear > 2100)
    ) {
      showToast({
        type: "error",
        title: "Invalid published year",
        description: "Published Year must be between 0 and 2100.",
      });
      return;
    }

    try {
      if (modalMode === "edit") {
        if (!activeBookId) return;
        await updateBook(activeBookId, {
          title: bookForm.title.trim(),
          author: bookForm.author.trim(),
          subject: bookForm.subject.trim() || null,
          rack_number: bookForm.rack_number.trim() || null,
          isbn: bookForm.isbn.trim() || null,
          published_year: publishedYear ?? null,
          copies_total: copies,
        });
        showToast({ type: "success", title: "Book updated successfully" });
      } else {
        await createBook({
          ...bookForm,
          subject: bookForm.subject.trim() || undefined,
          rack_number: bookForm.rack_number.trim() || undefined,
          isbn: bookForm.isbn.trim() || undefined,
          published_year: publishedYear,
          copies_total: copies,
        });
        showToast({ type: "success", title: "Book created successfully" });
      }

      closeModal();
      setActiveBookId(null);
      setBookForm(initialBookForm);
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: modalMode === "edit" ? "Unable to update book" : "Unable to create book",
        description: err.message || "Request failed",
      });
    }
  };

  const handleDeleteBook = async (book: any) => {
    const ok = window.confirm(`Delete "${book.title}"?`);
    if (!ok) return;
    try {
      await deleteBook(book.id);
      if (activeBookId === book.id) {
        setActiveBookId(null);
      }
      showToast({ type: "success", title: "Book deleted successfully" });
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to delete book",
        description: err.message || "Request failed",
      });
    }
  };

  const modalTitle = modalMode === "edit" ? "Edit Book" : "Add Book";
  const modalSubtitle =
    modalMode === "edit"
      ? `Book ID ${activeBookId ?? "-"} • Update metadata and inventory`
      : "Create a new catalog title";

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Catalog</div>
          <h1>Catalog & Inventory</h1>
          <p className="lede">
            Search titles quickly and keep book IDs, ISBNs, and stock information
            accurate.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={openCreateModal} data-testid="book-open-create">
            Add Book
          </button>
          <button className="secondary" onClick={() => refresh(true)}>
            Refresh
          </button>
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Titles</div>
          <div className="stat-value">{stats.totalTitles}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Copies</div>
          <div className="stat-value">{stats.totalCopies}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available Copies</div>
          <div className="stat-value">{stats.availableCopies}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Low Stock Titles</div>
          <div className="stat-value">{stats.lowStock}</div>
        </div>
      </section>

      <section className="table-card">
        <div className="card-header">
          <h2>Catalog Index</h2>
          <span className="pill">Searchable</span>
        </div>
        <div className="filter-bar">
          <div className="filter-field grow">
            <label>Search</label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, author, subject, rack, ISBN, Book ID"
            />
          </div>
          <div className="filter-field">
            <SearchableSelect
              label="Author"
              value={authorFilter}
              options={authorFilterOptions}
              placeholder="Any author"
              onChange={setAuthorFilter}
              multiple
              testId="catalog-author-filter"
            />
          </div>
          <div className="filter-field">
            <SearchableSelect
              label="Availability"
              value={availabilityFilter}
              options={availabilityFilterOptions}
              placeholder="Any availability"
              onChange={setAvailabilityFilter}
              multiple
              testId="catalog-availability-filter"
            />
          </div>
          <div className="filter-field">
            <SearchableSelect
              label="Subject"
              value={subjectFilter}
              options={subjectFilterOptions}
              placeholder="Any subject"
              onChange={setSubjectFilter}
              multiple
              testId="catalog-subject-filter"
            />
          </div>
          <div className="filter-field">
            <SearchableSelect
              label="Sort"
              value={sortBy}
              options={sortOptions}
              placeholder="Sort catalog"
              onChange={setSortBy}
              testId="catalog-sort"
            />
          </div>
          <div className="filter-field">
            <label>Page Size</label>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              data-testid="catalog-page-size"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <div className="table">
          {books.map((book) => (
            <div
              key={book.id}
              className={`row ${
                activeBookId === book.id && modalMode === "edit" ? "row-highlight" : ""
              }`}
              data-testid="book-row"
              data-book-id={book.id}
            >
              <div className="book-primary">
                <strong className="book-title">{book.title}</strong>
                <div className="book-author">{book.author}</div>
                <div className="book-meta-inline">
                  <span className="book-meta-item">
                    <span className="book-meta-key">Category</span>
                    <span>{book.subject || "General"}</span>
                  </span>
                  <span className="book-meta-item">
                    <span className="book-meta-key">Rack</span>
                    <span>{book.rack_number || "-"}</span>
                  </span>
                </div>
              </div>
              <div>
                <div className="meta-label">Available</div>
                <div className="meta-value">
                  {book.copies_available}/{book.copies_total}
                </div>
              </div>
              <div className="row-meta">
                <div className="meta-pair">
                  <div className="meta-label">Book ID</div>
                  <div className="meta-value">{book.id}</div>
                </div>
                <div className="meta-pair">
                  <div className="meta-label">ISBN</div>
                  <div className="meta-value">{book.isbn || "-"}</div>
                </div>
                <div className="row-actions">
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => openEditModal(book)}
                  >
                    Edit
                  </button>
                  <button
                    className="danger small"
                    type="button"
                    onClick={() => handleDeleteBook(book)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {books.length === 0 && (
            <div className="row">
              <div>
                <strong>
                  {loading
                    ? "Loading catalog page..."
                    : "No books match the active filters and search input."}
                </strong>
              </div>
              <div />
              <div />
            </div>
          )}
        </div>
        <div className="table-footer">
          <div className="meta-label">
            Page {page} · Showing {books.length} record{books.length === 1 ? "" : "s"}
          </div>
          <div className="row-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
              data-testid="catalog-prev-page"
            >
              Previous
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasNextPage || loading}
              data-testid="catalog-next-page"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <ActionModal
        open={modalMode !== null}
        title={modalTitle}
        subtitle={modalSubtitle}
        onClose={closeModal}
        testId="book-action-modal"
      >
        <form onSubmit={handleBookSubmit} data-testid="book-form">
          <div>
            <label>Title</label>
            <input
              data-testid="book-title"
              value={bookForm.title}
              onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })}
              required
            />
          </div>
          <div>
            <label>Author</label>
            <input
              data-testid="book-author"
              value={bookForm.author}
              onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })}
              required
            />
          </div>
          <div className="form-grid-2">
            <div>
              <label>ISBN</label>
              <input
                data-testid="book-isbn"
                value={bookForm.isbn}
                onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })}
              />
            </div>
            <div>
              <label>Subject</label>
              <input
                data-testid="book-subject"
                value={bookForm.subject}
                onChange={(event) => setBookForm({ ...bookForm, subject: event.target.value })}
              />
            </div>
          </div>
          <div className="form-grid-2">
            <div>
              <label>Rack Number</label>
              <input
                data-testid="book-rack-number"
                value={bookForm.rack_number}
                onChange={(event) =>
                  setBookForm({ ...bookForm, rack_number: event.target.value })
                }
              />
            </div>
            <div>
              <label>Published Year</label>
              <input
                type="number"
                data-testid="book-year"
                min={0}
                max={2100}
                value={bookForm.published_year}
                onChange={(event) =>
                  setBookForm({ ...bookForm, published_year: event.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label>Total Copies</label>
            <input
              type="number"
              min={1}
              data-testid="book-copies"
              value={bookForm.copies_total}
              onChange={(event) => setBookForm({ ...bookForm, copies_total: event.target.value })}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" data-testid="book-submit">
              {modalMode === "edit" ? "Save Changes" : "Add Book"}
            </button>
          </div>
        </form>
      </ActionModal>
    </div>
  );
}
