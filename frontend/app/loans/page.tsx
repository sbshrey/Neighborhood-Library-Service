"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import {
  borrowBook,
  deleteLoan,
  getBooks,
  getLoans,
  getUsers,
  returnBook,
  updateLoan,
} from "../../lib/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function LoansPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
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
        showToast({ type: "success", title: "Loans refreshed" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load loans",
        description: err.message || "Request failed",
      });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => {
    const active = loans.filter((loan) => !loan.returned_at);
    const overdue = active.filter((loan) => {
      const due = new Date(loan.due_at);
      return !Number.isNaN(due.getTime()) && due < new Date();
    });
    const estimatedFines = active.reduce(
      (sum, loan) => sum + Number(loan.estimated_fine || 0),
      0
    );
    return {
      active: active.length,
      returned: loans.length - active.length,
      overdue: overdue.length,
      estimatedFines: estimatedFines.toFixed(2),
    };
  }, [loans]);

  const activeLoans = useMemo(() => loans.filter((loan) => !loan.returned_at), [loans]);

  const userLookup = useMemo(() => {
    return new Map(users.map((user) => [user.id, user.name]));
  }, [users]);

  const visibleLoans = useMemo(() => {
    return loans.filter((loan) => {
      if (statusFilter === "active" && loan.returned_at) return false;
      if (statusFilter === "returned" && !loan.returned_at) return false;
      if (statusFilter === "overdue" && !loan.is_overdue) return false;
      if (userFilter !== "all" && String(loan.user_id) !== userFilter) return false;
      return true;
    });
  }, [loans, statusFilter, userFilter]);

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await borrowBook({
        book_id: Number(borrowForm.book_id),
        user_id: Number(borrowForm.user_id),
        days: Number(borrowForm.days)
      });
      setBorrowForm({ book_id: "", user_id: "", days: "14" });
      showToast({ type: "success", title: "Book borrowed successfully" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Borrow failed",
        description: err.message || "Request failed",
      });
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await returnBook(Number(returnForm.loan_id));
      setReturnForm({ loan_id: "" });
      showToast({ type: "success", title: "Book returned successfully" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Return failed",
        description: err.message || "Request failed",
      });
    }
  };

  const handleEditLoan = async (loan: any) => {
    const value = window.prompt("Extend due date by how many days?", "7");
    if (value === null) return;
    const extendDays = Number(value);
    if (!Number.isFinite(extendDays) || extendDays < 1) {
      showToast({ type: "error", title: "Invalid extension value" });
      return;
    }
    try {
      await updateLoan(loan.id, { extend_days: extendDays });
      showToast({ type: "success", title: "Loan updated successfully" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to update loan",
        description: err.message || "Request failed",
      });
    }
  };

  const handleDeleteLoan = async (loan: any) => {
    const ok = window.confirm(`Delete loan #${loan.id}?`);
    if (!ok) return;
    try {
      await deleteLoan(loan.id);
      showToast({ type: "success", title: "Loan deleted successfully" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to delete loan",
        description: err.message || "Request failed",
      });
    }
  };

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Loans</div>
          <h1>Borrowing Operations</h1>
          <p className="lede">Issue and return books while keeping availability aligned.</p>
        </div>
        <button className="secondary" onClick={() => refresh(true)}>
          Refresh
        </button>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Active Loans</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue</div>
          <div className="stat-value">{stats.overdue}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Returned</div>
          <div className="stat-value">{stats.returned}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Est. Active Fines</div>
          <div className="stat-value">${stats.estimatedFines}</div>
        </div>
      </section>

      <section className="page-grid">
        <div className="table-card">
          <div className="card-header">
            <h2>Active + Recent Loans</h2>
            <span className="pill">Circulation</span>
          </div>
          <div className="filter-bar">
            <div className="filter-field">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="loans-status-filter"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="returned">Returned</option>
              </select>
            </div>
            <div className="filter-field">
              <label>User</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                data-testid="loans-user-filter"
              >
                <option value="all">All users</option>
                {users.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.name} (ID {user.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="table">
            {visibleLoans.map((loan) => (
              <div key={loan.id} className="row" data-testid="loan-row" data-loan-id={loan.id}>
                <div>
                  <strong>Loan #{loan.id}</strong>
                  <div>
                    <span>Book {loan.book_id}</span>
                  </div>
                  <div>
                    <span>Borrowed {formatDate(loan.borrowed_at)}</span>
                  </div>
                </div>
                <div>
                  <div className="meta-label">Book ID</div>
                  <div className="meta-value">{loan.book_id}</div>
                  <div className="meta-label">User</div>
                  <div className="meta-value">
                    {userLookup.get(loan.user_id) || "User"} (ID {loan.user_id})
                  </div>
                </div>
                <div className="row-meta">
                  <div className="meta-pair">
                    <div className="meta-label">Due</div>
                    <div className="meta-value">{formatDate(loan.due_at)}</div>
                  </div>
                  <div className="meta-pair">
                    <div className="meta-label">Overdue</div>
                    <div className="meta-value">
                      {loan.overdue_days ? `${loan.overdue_days} day(s)` : "No"}
                    </div>
                  </div>
                  <div className="meta-pair">
                    <div className="meta-label">Est. Fine</div>
                    <div className="meta-value">${Number(loan.estimated_fine || 0).toFixed(2)}</div>
                  </div>
                  <span className={`status ${loan.returned_at ? "returned" : "active"}`}>
                    {loan.returned_at ? "Returned" : "Active"}
                  </span>
                  <div className="row-actions">
                    <button
                      className="ghost small"
                      type="button"
                      onClick={() => handleEditLoan(loan)}
                      disabled={Boolean(loan.returned_at)}
                    >
                      Edit
                    </button>
                    <button className="danger small" type="button" onClick={() => handleDeleteLoan(loan)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {visibleLoans.length === 0 && (
              <div className="row">
                <div>
                  <strong>No loans match the selected filters.</strong>
                </div>
                <div />
                <div />
              </div>
            )}
          </div>
        </div>

        <aside className="panel-card">
          <h2>Borrow Book</h2>
          <form onSubmit={handleBorrow} data-testid="borrow-form">
            <div>
              <label>Book</label>
              <select
                data-testid="borrow-book-id"
                value={borrowForm.book_id}
                onChange={(e) => setBorrowForm({ ...borrowForm, book_id: e.target.value })}
                required
              >
                <option value="">Select a book</option>
                {books.map((book) => (
                  <option key={book.id} value={String(book.id)}>
                    {book.title} (ID {book.id}) - {book.copies_available}/{book.copies_total} available
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>User</label>
              <select
                data-testid="borrow-user-id"
                value={borrowForm.user_id}
                onChange={(e) => setBorrowForm({ ...borrowForm, user_id: e.target.value })}
                required
              >
                <option value="">Select a user</option>
                {users.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {user.name} (ID {user.id}) - {user.role}
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
                data-testid="borrow-days"
                value={borrowForm.days}
                onChange={(e) => setBorrowForm({ ...borrowForm, days: e.target.value })}
              />
            </div>
            <p className="muted">Policy: max 5 active loans per user, max 21 days per loan.</p>
            <button type="submit" data-testid="borrow-submit">
              Borrow Book
            </button>
          </form>

          <h2>Return Book</h2>
          <form onSubmit={handleReturn} data-testid="return-form">
            <div>
              <label>Loan</label>
              <select
                data-testid="return-loan-id"
                value={returnForm.loan_id}
                onChange={(e) => setReturnForm({ ...returnForm, loan_id: e.target.value })}
                required
              >
                <option value="">Select an active loan</option>
                {activeLoans.map((loan) => (
                  <option key={loan.id} value={String(loan.id)}>
                    Loan #{loan.id} - Book {loan.book_id} / User {loan.user_id}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="secondary" data-testid="return-submit">
              Return Book
            </button>
          </form>
        </aside>
      </section>
    </div>
  );
}
