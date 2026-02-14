"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "../components/ToastProvider";
import { borrowBook, getBooks, getLoans, getUsers, returnBook } from "../lib/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function BorrowingsPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [borrowForm, setBorrowForm] = useState({ book_id: "", user_id: "", days: "14" });
  const [returnForm, setReturnForm] = useState({ loan_id: "" });

  const refresh = async (showSuccess = false) => {
    try {
      const [booksData, usersData, loansData] = await Promise.all([
        getBooks(),
        getUsers(),
        getLoans(),
      ]);
      setBooks(booksData);
      setUsers(usersData);
      setLoans(loansData);
      if (showSuccess) {
        showToast({ type: "success", title: "Borrowings refreshed" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load borrowings",
        description: err.message || "Request failed",
      });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => {
    const active = loans.filter((loan) => !loan.returned_at);
    const overdue = active.filter((loan) => loan.is_overdue);
    const estimatedFines = active.reduce((sum, loan) => sum + Number(loan.estimated_fine || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const returnedToday = loans.filter(
      (loan) => loan.returned_at && String(loan.returned_at).slice(0, 10) === today
    ).length;
    return {
      active: active.length,
      overdue: overdue.length,
      estimatedFines: estimatedFines.toFixed(2),
      returnedToday,
    };
  }, [loans]);

  const bookLookup = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const userLookup = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const activeLoans = useMemo(() => loans.filter((loan) => !loan.returned_at), [loans]);

  const visibleLoans = useMemo(() => {
    return loans.filter((loan) => {
      if (statusFilter === "active" && loan.returned_at) return false;
      if (statusFilter === "returned" && !loan.returned_at) return false;
      if (statusFilter === "overdue" && !loan.is_overdue) return false;
      return true;
    });
  }, [loans, statusFilter]);

  const handleBorrow = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await borrowBook({
        book_id: Number(borrowForm.book_id),
        user_id: Number(borrowForm.user_id),
        days: Number(borrowForm.days),
      });
      setBorrowForm({ book_id: "", user_id: "", days: "14" });
      showToast({ type: "success", title: "Borrowing recorded" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Borrowing failed",
        description: err.message || "Request failed",
      });
    }
  };

  const handleReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await returnBook(Number(returnForm.loan_id));
      setReturnForm({ loan_id: "" });
      showToast({ type: "success", title: "Return recorded" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Return failed",
        description: err.message || "Request failed",
      });
    }
  };

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Circulation Desk</div>
          <h1>Borrowings, Returns, Fines</h1>
          <p className="lede">Staff workflow for issuing books, accepting returns, and monitoring overdue fines.</p>
        </div>
        <button className="secondary" onClick={() => refresh(true)}>
          Refresh
        </button>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Active Borrowings</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue</div>
          <div className="stat-value">{stats.overdue}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding Fines</div>
          <div className="stat-value">${stats.estimatedFines}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Returned Today</div>
          <div className="stat-value">{stats.returnedToday}</div>
        </div>
      </section>

      <section className="page-grid">
        <div className="table-card">
          <div className="card-header">
            <h2>Borrowing Register</h2>
            <div className="filter-field">
              <label>Status</label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="returned">Returned</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          <div className="table">
            {visibleLoans.map((loan) => {
              const book = bookLookup.get(loan.book_id);
              const user = userLookup.get(loan.user_id);
              return (
                <div key={loan.id} className="row">
                  <div>
                    <strong>{book?.title || `Book #${loan.book_id}`}</strong>
                    <div>
                      <span>{user?.name || `User #${loan.user_id}`}</span>
                    </div>
                  </div>
                  <div>
                    <div className="meta-label">Due Date</div>
                    <div className="meta-value">{formatDate(loan.due_at)}</div>
                    <div className="meta-label">Status</div>
                    <div className="meta-value">{loan.returned_at ? "Returned" : loan.is_overdue ? "Overdue" : "Active"}</div>
                  </div>
                  <div className="row-meta">
                    <div className="meta-pair">
                      <div className="meta-label">Overdue Days</div>
                      <div className="meta-value">{loan.overdue_days || 0}</div>
                    </div>
                    <div className="meta-pair">
                      <div className="meta-label">Estimated Fine</div>
                      <div className="meta-value">${Number(loan.estimated_fine || 0).toFixed(2)}</div>
                    </div>
                    <span className={`status ${loan.returned_at ? "returned" : loan.is_overdue ? "flag" : "active"}`}>
                      {loan.returned_at ? "Returned" : loan.is_overdue ? "Overdue" : "Active"}
                    </span>
                  </div>
                </div>
              );
            })}
            {visibleLoans.length === 0 && (
              <div className="row">
                <div>
                  <strong>No borrowing records for this filter.</strong>
                </div>
                <div />
                <div />
              </div>
            )}
          </div>
        </div>

        <aside className="panel-stack">
          <div className="panel-card">
            <h2>Issue Book</h2>
            <form onSubmit={handleBorrow}>
              <div>
                <label>Book</label>
                <select
                  value={borrowForm.book_id}
                  onChange={(event) => setBorrowForm({ ...borrowForm, book_id: event.target.value })}
                  required
                >
                  <option value="">Select a book</option>
                  {books.map((book) => (
                    <option key={book.id} value={String(book.id)}>
                      {book.title} ({book.copies_available}/{book.copies_total} available)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Member</label>
                <select
                  value={borrowForm.user_id}
                  onChange={(event) => setBorrowForm({ ...borrowForm, user_id: event.target.value })}
                  required
                >
                  <option value="">Select a member</option>
                  {users.map((user) => (
                    <option key={user.id} value={String(user.id)}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Days (max 21)</label>
                <input
                  type="number"
                  min={1}
                  max={21}
                  value={borrowForm.days}
                  onChange={(event) => setBorrowForm({ ...borrowForm, days: event.target.value })}
                />
              </div>
              <button type="submit">Record Borrowing</button>
            </form>
          </div>

          <div className="panel-card">
            <h2>Accept Return</h2>
            <form onSubmit={handleReturn}>
              <div>
                <label>Active Loan</label>
                <select
                  value={returnForm.loan_id}
                  onChange={(event) => setReturnForm({ loan_id: event.target.value })}
                  required
                >
                  <option value="">Select loan</option>
                  {activeLoans.map((loan) => {
                    const book = bookLookup.get(loan.book_id);
                    const user = userLookup.get(loan.user_id);
                    return (
                      <option key={loan.id} value={String(loan.id)}>
                        {book?.title || `Book #${loan.book_id}`} - {user?.name || `User #${loan.user_id}`}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button type="submit" className="secondary">
                Record Return
              </button>
            </form>
          </div>
        </aside>
      </section>
    </div>
  );
}
