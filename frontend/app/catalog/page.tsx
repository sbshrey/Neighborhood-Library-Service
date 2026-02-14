"use client";

import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "../../components/SearchableSelect";
import { useToast } from "../../components/ToastProvider";
import { createBook, deleteBook, getBooks, updateBook } from "../../lib/api";

const initialBookForm = {
  title: "",
  author: "",
  subject: "",
  rack_number: "",
  isbn: "",
  published_year: "",
  copies_total: "1",
};

export default function CatalogPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [bookForm, setBookForm] = useState(initialBookForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(initialBookForm);

  const refresh = async (showSuccess = false) => {
    try {
      setBooks(await getBooks());
      if (showSuccess) {
        showToast({ type: "success", title: "Catalog refreshed" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load books",
        description: err.message || "Request failed",
      });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => {
    const totalTitles = books.length;
    const totalCopies = books.reduce((sum, book) => sum + book.copies_total, 0);
    const availableCopies = books.reduce((sum, book) => sum + book.copies_available, 0);
    const lowStock = books.filter((book) => book.copies_available <= 1).length;
    return { totalTitles, totalCopies, availableCopies, lowStock };
  }, [books]);

  const authorOptions = useMemo(() => {
    const values = Array.from(new Set(books.map((book) => (book.author || "").trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [books]);

  const subjectOptions = useMemo(() => {
    const values = Array.from(new Set(books.map((book) => (book.subject || "").trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [books]);

  const authorFilterOptions = useMemo(
    () => [
      { value: "all", label: "All authors", keywords: "all any" },
      ...authorOptions.map((author) => ({ value: author, label: author, keywords: author })),
    ],
    [authorOptions]
  );

  const subjectFilterOptions = useMemo(
    () => [
      { value: "all", label: "All subjects", keywords: "all any" },
      ...subjectOptions.map((subject) => ({ value: subject, label: subject, keywords: subject })),
    ],
    [subjectOptions]
  );

  const availabilityFilterOptions = [
    { value: "all", label: "All availability" },
    { value: "available", label: "Available only" },
    { value: "unavailable", label: "Unavailable only" },
  ];

  const visibleBooks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return books.filter((book) => {
      if (authorFilter !== "all" && book.author !== authorFilter) return false;
      if (subjectFilter !== "all" && book.subject !== subjectFilter) return false;
      if (availabilityFilter === "available" && book.copies_available <= 0) return false;
      if (availabilityFilter === "unavailable" && book.copies_available > 0) return false;
      if (!normalizedSearch) return true;
      const haystack = `${book.id} ${book.title} ${book.author} ${book.subject || ""} ${book.rack_number || ""} ${book.isbn || ""}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [books, authorFilter, subjectFilter, availabilityFilter, search]);

  const handleCreateBook = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createBook({
        ...bookForm,
        subject: bookForm.subject.trim() || undefined,
        rack_number: bookForm.rack_number.trim() || undefined,
        published_year: bookForm.published_year ? Number(bookForm.published_year) : undefined,
        copies_total: Number(bookForm.copies_total),
      });
      setBookForm(initialBookForm);
      showToast({ type: "success", title: "Book created successfully" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to create book",
        description: err.message || "Request failed",
      });
    }
  };

  const openEditor = (book: any) => {
    setEditingId(book.id);
    setEditForm({
      title: book.title || "",
      author: book.author || "",
      subject: book.subject || "",
      rack_number: book.rack_number || "",
      isbn: book.isbn || "",
      published_year: book.published_year ? String(book.published_year) : "",
      copies_total: String(book.copies_total || 1),
    });
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    const copies = Number(editForm.copies_total);
    if (!Number.isFinite(copies) || copies < 1) {
      showToast({ type: "error", title: "Invalid copies_total value" });
      return;
    }
    try {
      await updateBook(editingId, {
        title: editForm.title.trim(),
        author: editForm.author.trim(),
        subject: editForm.subject.trim() || null,
        rack_number: editForm.rack_number.trim() || null,
        isbn: editForm.isbn.trim() || null,
        published_year: editForm.published_year.trim() ? Number(editForm.published_year) : null,
        copies_total: copies,
      });
      showToast({ type: "success", title: "Book updated successfully" });
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to update book",
        description: err.message || "Request failed",
      });
    }
  };

  const handleDeleteBook = async (book: any) => {
    const ok = window.confirm(`Delete "${book.title}"?`);
    if (!ok) return;
    try {
      await deleteBook(book.id);
      if (editingId === book.id) {
        setEditingId(null);
      }
      showToast({ type: "success", title: "Book deleted successfully" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to delete book",
        description: err.message || "Request failed",
      });
    }
  };

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Catalog</div>
          <h1>Catalog & Inventory</h1>
          <p className="lede">Search titles quickly and keep book IDs, ISBNs, and stock information accurate.</p>
        </div>
        <button className="secondary" onClick={() => refresh(true)}>
          Refresh
        </button>
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

      <section className="dashboard-grid">
        <div className="table-card">
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
                placeholder="Filter by author"
                onChange={setAuthorFilter}
                testId="catalog-author-filter"
              />
            </div>
            <div className="filter-field">
              <SearchableSelect
                label="Availability"
                value={availabilityFilter}
                options={availabilityFilterOptions}
                placeholder="Filter by availability"
                onChange={setAvailabilityFilter}
                testId="catalog-availability-filter"
              />
            </div>
            <div className="filter-field">
              <SearchableSelect
                label="Subject"
                value={subjectFilter}
                options={subjectFilterOptions}
                placeholder="Filter by subject"
                onChange={setSubjectFilter}
                testId="catalog-subject-filter"
              />
            </div>
          </div>
          <div className="table">
            {visibleBooks.map((book) => (
              <div key={book.id} className={`row ${editingId === book.id ? "row-highlight" : ""}`} data-testid="book-row" data-book-id={book.id}>
                <div>
                  <strong>{book.title}</strong>
                  <div>
                    <span>{book.author}</span>
                  </div>
                  <div>
                    <span>{book.subject || "General"} · Rack {book.rack_number || "-"}</span>
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
                    <button className="ghost small" type="button" onClick={() => openEditor(book)}>
                      Edit
                    </button>
                    <button className="danger small" type="button" onClick={() => handleDeleteBook(book)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {visibleBooks.length === 0 && (
              <div className="row">
                <div>
                  <strong>No books match the active filters and search input.</strong>
                </div>
                <div />
                <div />
              </div>
            )}
          </div>
        </div>

        <aside className="panel-stack">
          <div className="panel-card">
            <h2>Add Book</h2>
            <form onSubmit={handleCreateBook} data-testid="book-form">
              <div>
                <label>Title</label>
                <input data-testid="book-title" value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} required />
              </div>
              <div>
                <label>Author</label>
                <input data-testid="book-author" value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} required />
              </div>
              <div>
                <label>ISBN</label>
                <input data-testid="book-isbn" value={bookForm.isbn} onChange={(event) => setBookForm({ ...bookForm, isbn: event.target.value })} />
              </div>
              <div>
                <label>Subject</label>
                <input data-testid="book-subject" value={bookForm.subject} onChange={(event) => setBookForm({ ...bookForm, subject: event.target.value })} />
              </div>
              <div>
                <label>Rack Number</label>
                <input data-testid="book-rack-number" value={bookForm.rack_number} onChange={(event) => setBookForm({ ...bookForm, rack_number: event.target.value })} />
              </div>
              <div>
                <label>Published Year</label>
                <input type="number" data-testid="book-year" value={bookForm.published_year} onChange={(event) => setBookForm({ ...bookForm, published_year: event.target.value })} />
              </div>
              <div>
                <label>Total Copies</label>
                <input type="number" min={1} data-testid="book-copies" value={bookForm.copies_total} onChange={(event) => setBookForm({ ...bookForm, copies_total: event.target.value })} required />
              </div>
              <button type="submit" data-testid="book-submit">
                Add Book
              </button>
            </form>
          </div>

          <div className="panel-card">
            <div className="card-header">
              <h2>Edit Book</h2>
              <span className="pill">{editingId ? `Book ${editingId}` : "Select from list"}</span>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div>
                <label>Title</label>
                <input value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} disabled={!editingId} required />
              </div>
              <div>
                <label>Author</label>
                <input value={editForm.author} onChange={(event) => setEditForm({ ...editForm, author: event.target.value })} disabled={!editingId} required />
              </div>
              <div>
                <label>ISBN</label>
                <input value={editForm.isbn} onChange={(event) => setEditForm({ ...editForm, isbn: event.target.value })} disabled={!editingId} />
              </div>
              <div>
                <label>Subject</label>
                <input value={editForm.subject} onChange={(event) => setEditForm({ ...editForm, subject: event.target.value })} disabled={!editingId} />
              </div>
              <div>
                <label>Rack Number</label>
                <input value={editForm.rack_number} onChange={(event) => setEditForm({ ...editForm, rack_number: event.target.value })} disabled={!editingId} />
              </div>
              <div>
                <label>Published Year</label>
                <input type="number" value={editForm.published_year} onChange={(event) => setEditForm({ ...editForm, published_year: event.target.value })} disabled={!editingId} />
              </div>
              <div>
                <label>Total Copies</label>
                <input type="number" min={1} value={editForm.copies_total} onChange={(event) => setEditForm({ ...editForm, copies_total: event.target.value })} disabled={!editingId} />
              </div>
              <button type="submit" disabled={!editingId}>
                Save Changes
              </button>
            </form>
          </div>
        </aside>
      </section>
    </div>
  );
}
