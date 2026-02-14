"use client";

import { useEffect, useMemo, useState } from "react";

import SearchableSelect from "../components/SearchableSelect";
import { useToast } from "../components/ToastProvider";
import {
  borrowBook,
  createLoanFinePayment,
  createUser,
  getBooks,
  getLoans,
  getUsers,
  returnBook,
  updateUser,
} from "../lib/api";
import { getStoredUser } from "../lib/auth";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatCurrencyINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type QuickUserForm = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
};

const initialQuickUser: QuickUserForm = {
  id: "",
  name: "",
  email: "",
  phone: "",
  role: "member",
};

export default function BorrowingsPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [registerSearch, setRegisterSearch] = useState("");
  const [borrowForm, setBorrowForm] = useState({ book_id: "", user_id: "", days: "14" });
  const [returnForm, setReturnForm] = useState({ loan_id: "" });
  const [fineForm, setFineForm] = useState({
    loan_id: "",
    amount: "",
    payment_mode: "upi",
    reference: "",
  });
  const [fineLoading, setFineLoading] = useState(false);
  const [quickUserForm, setQuickUserForm] = useState<QuickUserForm>(initialQuickUser);
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [authRole, setAuthRole] = useState("staff");

  const refresh = async (showSuccess = false) => {
    try {
      const [booksData, usersData, loansData] = await Promise.all([getBooks(), getUsers(), getLoans()]);
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
    const currentUser = getStoredUser();
    if (currentUser?.role) {
      setAuthRole(currentUser.role);
      if (currentUser.role === "admin") {
        setQuickUserForm((prev) => ({ ...prev, role: "staff" }));
      }
    }
    refresh();
  }, []);

  useEffect(() => {
    if (!borrowForm.user_id) return;
    const selectedUser = users.find((user) => String(user.id) === borrowForm.user_id);
    if (!selectedUser) return;
    setQuickUserForm({
      id: String(selectedUser.id),
      name: selectedUser.name || "",
      email: selectedUser.email || "",
      phone: selectedUser.phone || "",
      role: selectedUser.role || "member",
    });
  }, [borrowForm.user_id, users]);

  const stats = useMemo(() => {
    const active = loans.filter((loan) => !loan.returned_at);
    const overdue = active.filter((loan) => loan.is_overdue);
    const estimatedFines = loans.reduce((sum, loan) => sum + Number(loan.fine_due || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const returnedToday = loans.filter(
      (loan) => loan.returned_at && String(loan.returned_at).slice(0, 10) === today
    ).length;
    return {
      active: active.length,
      overdue: overdue.length,
      estimatedFines,
      returnedToday,
    };
  }, [loans]);

  const bookLookup = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const userLookup = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const activeLoans = useMemo(() => loans.filter((loan) => !loan.returned_at), [loans]);
  const fineCandidateLoans = useMemo(
    () => loans.filter((loan) => Number(loan.fine_due || 0) > 0),
    [loans]
  );

  const visibleLoans = useMemo(() => {
    const normalizedSearch = registerSearch.trim().toLowerCase();
    return loans.filter((loan) => {
      if (statusFilter === "active" && loan.returned_at) return false;
      if (statusFilter === "returned" && !loan.returned_at) return false;
      if (statusFilter === "overdue" && !loan.is_overdue) return false;
      if (!normalizedSearch) return true;

      const book = bookLookup.get(loan.book_id);
      const user = userLookup.get(loan.user_id);
      const haystack = [
        loan.id,
        book?.id,
        book?.title,
        book?.isbn,
        user?.name,
        user?.email,
        user?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [loans, statusFilter, registerSearch, bookLookup, userLookup]);

  const bookOptions = useMemo(
    () =>
      books.map((book) => ({
        value: String(book.id),
        label: `${book.title} • Book ID ${book.id} • ISBN ${book.isbn || "N/A"} • ${book.copies_available}/${book.copies_total} available`,
        keywords: `${book.title} ${book.author || ""} ${book.isbn || ""} ${book.id}`,
      })),
    [books]
  );

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        value: String(user.id),
        label: `${user.name} • User ID ${user.id} • ${user.email || "no-email"} • ${user.phone || "no-phone"}`,
        keywords: `${user.name} ${user.email || ""} ${user.phone || ""} ${user.id}`,
      })),
    [users]
  );

  const activeLoanOptions = useMemo(
    () =>
      activeLoans.map((loan) => {
        const book = bookLookup.get(loan.book_id);
        const user = userLookup.get(loan.user_id);
        const label = `Loan ${loan.id} • ${book?.title || `Book ${loan.book_id}`} • ${user?.name || `User ${loan.user_id}`} • Due ${formatDate(loan.due_at)}`;
        return {
          value: String(loan.id),
          label,
          keywords: `${loan.id} ${book?.title || ""} ${book?.isbn || ""} ${user?.name || ""} ${user?.email || ""} ${user?.phone || ""}`,
        };
      }),
    [activeLoans, bookLookup, userLookup]
  );

  const fineLoanOptions = useMemo(
    () =>
      fineCandidateLoans.map((loan) => {
        const book = bookLookup.get(loan.book_id);
        const user = userLookup.get(loan.user_id);
        const due = Number(loan.fine_due || 0);
        const label = `Loan ${loan.id} • ${book?.title || `Book ${loan.book_id}`} • ${user?.name || `User ${loan.user_id}`} • Due ${formatCurrencyINR(due)}`;
        return {
          value: String(loan.id),
          label,
          keywords: `${loan.id} ${book?.title || ""} ${book?.isbn || ""} ${user?.name || ""} ${user?.email || ""} ${user?.phone || ""} ${due}`,
        };
      }),
    [fineCandidateLoans, bookLookup, userLookup]
  );

  const handleBorrow = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await borrowBook({
        book_id: Number(borrowForm.book_id),
        user_id: Number(borrowForm.user_id),
        days: Number(borrowForm.days),
      });
      setBorrowForm({ book_id: "", user_id: "", days: "14" });
      showToast({
        type: "success",
        title: "Borrowing recorded",
        description: "Loan entry added and inventory updated.",
      });
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
      showToast({
        type: "success",
        title: "Return recorded",
        description: "Loan closed and book inventory released.",
      });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Return failed",
        description: err.message || "Request failed",
      });
    }
  };

  const handleCollectFine = async (event: React.FormEvent) => {
    event.preventDefault();
    setFineLoading(true);
    try {
      await createLoanFinePayment(Number(fineForm.loan_id), {
        amount: Number(fineForm.amount),
        payment_mode: fineForm.payment_mode,
        reference: fineForm.reference.trim() || null,
      });
      showToast({
        type: "success",
        title: "Fine collected",
        description: "Fine payment has been recorded with payment mode details.",
      });
      setFineForm({ loan_id: "", amount: "", payment_mode: "upi", reference: "" });
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Fine collection failed",
        description: err.message || "Request failed",
      });
    } finally {
      setFineLoading(false);
    }
  };

  const handleCreateQuickUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setUserActionLoading(true);
    try {
      const payload: any = {
        name: quickUserForm.name.trim(),
        email: quickUserForm.email.trim() || null,
        phone: quickUserForm.phone.trim() || null,
        role: quickUserForm.role,
      };
      const created: any = await createUser(payload);
      setBorrowForm((prev) => ({ ...prev, user_id: String(created.id) }));
      setQuickUserForm({
        id: String(created.id),
        name: created.name,
        email: created.email || "",
        phone: created.phone || "",
        role: created.role || "member",
      });
      showToast({
        type: "success",
        title: "New user created",
        description: `${created.name} is now ready for borrowing.`,
      });
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to create user",
        description: err.message || "Request failed",
      });
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleUpdateQuickUser = async () => {
    if (!quickUserForm.id) {
      showToast({
        type: "info",
        title: "Select a user first",
        description: "Pick an existing user in the borrow form to edit details.",
      });
      return;
    }
    setUserActionLoading(true);
    try {
      const payload: any = {
        name: quickUserForm.name.trim(),
        email: quickUserForm.email.trim() || null,
        phone: quickUserForm.phone.trim() || null,
        role: quickUserForm.role,
      };
      await updateUser(Number(quickUserForm.id), payload);
      showToast({
        type: "success",
        title: "User details updated",
        description: "Borrowing form uses the latest profile values.",
      });
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to update user",
        description: err.message || "Request failed",
      });
    } finally {
      setUserActionLoading(false);
    }
  };

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Circulation Desk</div>
          <h1>Borrowings, Returns, Fines</h1>
          <p className="lede">Issue and return books fast while keeping user and inventory records accurate.</p>
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
          <div className="stat-value">{formatCurrencyINR(stats.estimatedFines)}</div>
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
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                data-testid="loan-status-filter"
              >
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="returned">Returned</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          <div className="filter-bar">
            <div className="filter-field grow">
              <label>Search register</label>
              <input
                type="search"
                value={registerSearch}
                onChange={(event) => setRegisterSearch(event.target.value)}
                placeholder="Search by loan ID, book title/ISBN, user name/email/phone"
              />
            </div>
          </div>
          <div className="table">
            {visibleLoans.map((loan) => {
              const book = bookLookup.get(loan.book_id);
              const user = userLookup.get(loan.user_id);
              return (
                <div
                  key={loan.id}
                  className="row row-loan"
                  data-testid="loan-row"
                  data-loan-id={loan.id}
                >
                  <div className="loan-main">
                    <strong>{book?.title || `Book #${loan.book_id}`}</strong>
                    <div>
                      <span>{user?.name || `User #${loan.user_id}`}</span>
                    </div>
                    <div>
                      <span>
                        Loan ID {loan.id} · Book ID {loan.book_id} · ISBN {book?.isbn || "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="loan-dates">
                    <div className="meta-label">Due Date</div>
                    <div className="meta-value">{formatDate(loan.due_at)}</div>
                    <div className="meta-label">Status</div>
                    <div className="meta-value">
                      {loan.returned_at ? "Returned" : loan.is_overdue ? "Overdue" : "Active"}
                    </div>
                  </div>
                  <div className="row-meta">
                    <div className="meta-pair">
                      <div className="meta-label">Overdue Days</div>
                      <div className="meta-value">{loan.overdue_days || 0}</div>
                    </div>
                    <div className="meta-pair">
                      <div className="meta-label">Fine Due / Paid</div>
                      <div className="meta-value">
                        {formatCurrencyINR(Number(loan.fine_due || 0))} / {formatCurrencyINR(Number(loan.fine_paid || 0))}
                      </div>
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
                  <strong>No borrowing records match the current filters.</strong>
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
              <SearchableSelect
                label="Book"
                value={borrowForm.book_id}
                options={bookOptions}
                placeholder="Search by title, author, ISBN, Book ID"
                onChange={(value) => setBorrowForm({ ...borrowForm, book_id: value })}
                required
                testId="borrow-book-id"
              />
              <SearchableSelect
                label="User"
                value={borrowForm.user_id}
                options={userOptions}
                placeholder="Search by name, email, phone, User ID"
                onChange={(value) => setBorrowForm({ ...borrowForm, user_id: value })}
                required
                testId="borrow-user-id"
              />
              <div>
                <label>Days</label>
                <input
                  data-testid="borrow-days"
                  type="number"
                  min={1}
                  max={365}
                  value={borrowForm.days}
                  onChange={(event) => setBorrowForm({ ...borrowForm, days: event.target.value })}
                />
              </div>
              <button type="submit" data-testid="borrow-submit">
                Record Borrowing
              </button>
            </form>
          </div>

          <div className="panel-card">
            <h2>Accept Return</h2>
            <form onSubmit={handleReturn}>
              <SearchableSelect
                label="Active Loan"
                value={returnForm.loan_id}
                options={activeLoanOptions}
                placeholder="Search by loan ID, user, title, email, phone"
                onChange={(value) => setReturnForm({ loan_id: value })}
                required
                testId="return-loan-id"
              />
              <button type="submit" className="secondary" data-testid="return-submit">
                Record Return
              </button>
            </form>
          </div>

          <div className="panel-card">
            <h2>Fine Collection</h2>
            <form onSubmit={handleCollectFine}>
              <SearchableSelect
                label="Loan with outstanding fine"
                value={fineForm.loan_id}
                options={fineLoanOptions}
                placeholder="Search by loan, user, title, ISBN"
                onChange={(value) => {
                  const selected = loans.find((loan) => String(loan.id) === value);
                  setFineForm({
                    loan_id: value,
                    amount: selected ? String(Number(selected.fine_due || 0)) : "",
                    payment_mode: "upi",
                    reference: "",
                  });
                }}
                required
                testId="fine-loan-id"
              />
              <div>
                <label>Amount (₹)</label>
                <input
                  data-testid="fine-amount"
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={fineForm.amount}
                  onChange={(event) => setFineForm({ ...fineForm, amount: event.target.value })}
                  required
                />
              </div>
              <div>
                <label>Payment Mode</label>
                <select
                  data-testid="fine-payment-mode"
                  value={fineForm.payment_mode}
                  onChange={(event) => setFineForm({ ...fineForm, payment_mode: event.target.value })}
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="net_banking">Net Banking</option>
                  <option value="wallet">Wallet</option>
                  <option value="waiver">Waiver</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label>Reference</label>
                <input
                  data-testid="fine-reference"
                  value={fineForm.reference}
                  onChange={(event) => setFineForm({ ...fineForm, reference: event.target.value })}
                  placeholder="Txn id / receipt id"
                />
              </div>
              <button type="submit" className="secondary" data-testid="fine-submit" disabled={fineLoading}>
                {fineLoading ? "Recording..." : "Record Fine Payment"}
              </button>
            </form>
          </div>

          <div className="panel-card">
            <div className="card-header">
              <h2>Quick User Desk</h2>
              <span className="pill">From Borrowings</span>
            </div>
            <form onSubmit={handleCreateQuickUser}>
              <div>
                <label>Name</label>
                <input
                  data-testid="quick-user-name"
                  value={quickUserForm.name}
                  onChange={(event) => setQuickUserForm({ ...quickUserForm, name: event.target.value })}
                  required
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  data-testid="quick-user-email"
                  value={quickUserForm.email}
                  onChange={(event) => setQuickUserForm({ ...quickUserForm, email: event.target.value })}
                />
              </div>
              <div>
                <label>Phone</label>
                <input
                  data-testid="quick-user-phone"
                  value={quickUserForm.phone}
                  onChange={(event) => setQuickUserForm({ ...quickUserForm, phone: event.target.value })}
                />
              </div>
              <div>
                <label>Role</label>
                <select
                  data-testid="quick-user-role"
                  value={quickUserForm.role}
                  onChange={(event) => setQuickUserForm({ ...quickUserForm, role: event.target.value })}
                >
                  <option value="member">Member</option>
                  <option value="staff">Staff</option>
                  {authRole === "admin" ? <option value="admin">Admin</option> : null}
                </select>
              </div>
              <div className="row-actions">
                <button
                  type="submit"
                  className="secondary"
                  disabled={userActionLoading}
                  data-testid="quick-user-create"
                >
                  {userActionLoading ? "Saving..." : "Create User"}
                </button>
                <button
                  type="button"
                  onClick={handleUpdateQuickUser}
                  disabled={userActionLoading}
                  data-testid="quick-user-update"
                >
                  {userActionLoading ? "Saving..." : "Update Selected User"}
                </button>
              </div>
              <p className="muted">
                Select any user in the issue-book panel to load and edit their data instantly.
              </p>
            </form>
          </div>
        </aside>
      </section>
    </div>
  );
}
