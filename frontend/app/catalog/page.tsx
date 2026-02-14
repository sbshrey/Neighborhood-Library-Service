"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { createBook, deleteBook, getBooks, updateBook } from "../../lib/api";

export default function CatalogPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [authorFilter, setAuthorFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    isbn: "",
    published_year: "",
    copies_total: "1"
  });

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
    const values = Array.from(
      new Set(books.map((book) => (book.author || "").trim()).filter(Boolean))
    );
    return values.sort((a, b) => a.localeCompare(b));
  }, [books]);

  const visibleBooks = useMemo(() => {
    return books.filter((book) => {
      if (authorFilter !== "all" && book.author !== authorFilter) return false;
      if (availabilityFilter === "available" && book.copies_available <= 0) return false;
      if (availabilityFilter === "unavailable" && book.copies_available > 0) return false;
      return true;
    });
  }, [books, authorFilter, availabilityFilter]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBook({
        ...bookForm,
        published_year: bookForm.published_year
          ? Number(bookForm.published_year)
          : undefined,
        copies_total: Number(bookForm.copies_total)
      });
      setBookForm({ title: "", author: "", isbn: "", published_year: "", copies_total: "1" });
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

  const handleEditBook = async (book: any) => {
    const title = window.prompt("Edit title", book.title);
    if (title === null) return;
    const author = window.prompt("Edit author", book.author);
    if (author === null) return;
    const isbn = window.prompt("Edit ISBN (optional)", book.isbn || "");
    if (isbn === null) return;
    const publishedYear = window.prompt(
      "Edit published year (optional)",
      book.published_year ? String(book.published_year) : ""
    );
    if (publishedYear === null) return;
    const copies = window.prompt("Edit total copies", String(book.copies_total));
    if (copies === null) return;

    const parsedCopies = Number(copies);
    if (!Number.isFinite(parsedCopies) || parsedCopies < 1) {
      showToast({ type: "error", title: "Invalid copies value" });
      return;
    }

    try {
      await updateBook(book.id, {
        title: title.trim(),
        author: author.trim(),
        isbn: isbn.trim() || null,
        published_year: publishedYear.trim() ? Number(publishedYear) : null,
        copies_total: parsedCopies,
      });
      showToast({ type: "success", title: "Book updated successfully" });
      refresh();
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
          <h1>Books & Inventory</h1>
          <p className="lede">Manage titles, copies, and availability across the collection.</p>
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
          <div className="stat-label">Available</div>
          <div className="stat-value">{stats.availableCopies}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Low Stock</div>
          <div className="stat-value">{stats.lowStock}</div>
        </div>
      </section>

      <section className="page-grid">
        <div className="table-card">
          <div className="card-header">
            <h2>Catalog Overview</h2>
            <span className="pill">Inventory</span>
          </div>
          <div className="filter-bar">
            <div className="filter-field">
              <label>Author</label>
              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                data-testid="catalog-author-filter"
              >
                <option value="all">All authors</option>
                {authorOptions.map((author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label>Availability</label>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                data-testid="catalog-availability-filter"
              >
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>
          <div className="table">
            {visibleBooks.map((book) => (
              <div
                key={book.id}
                className="row"
                data-testid="book-row"
                data-book-id={book.id}
              >
                <div>
                  <strong>{book.title}</strong>
                  <div>
                    <span>{book.author}</span>
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
                    <button className="ghost small" type="button" onClick={() => handleEditBook(book)}>
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
                  <strong>No books match the selected filters.</strong>
                </div>
                <div />
                <div />
              </div>
            )}
          </div>
        </div>

        <aside className="panel-card">
          <h2>Add Book</h2>
          <form onSubmit={handleCreateBook} data-testid="book-form">
            <div>
              <label>Title</label>
              <input
                data-testid="book-title"
                value={bookForm.title}
                onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Author</label>
              <input
                data-testid="book-author"
                value={bookForm.author}
                onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                required
              />
            </div>
            <div>
              <label>ISBN</label>
              <input
                data-testid="book-isbn"
                value={bookForm.isbn}
                onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
              />
            </div>
            <div>
              <label>Published Year</label>
              <input
                type="number"
                data-testid="book-year"
                value={bookForm.published_year}
                onChange={(e) => setBookForm({ ...bookForm, published_year: e.target.value })}
              />
            </div>
            <div>
              <label>Total Copies</label>
              <input
                type="number"
                min={1}
                data-testid="book-copies"
                value={bookForm.copies_total}
                onChange={(e) => setBookForm({ ...bookForm, copies_total: e.target.value })}
                required
              />
            </div>
            <button type="submit" data-testid="book-submit">
              Add Book
            </button>
          </form>
        </aside>
      </section>
    </div>
  );
}
