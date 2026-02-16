"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "../../components/ToastProvider";
import { FinePayment, getMyFinePayments, getMyLoans, MemberLoan } from "../../lib/api";

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

export default function MemberDashboardPage() {
  const { showToast } = useToast();
  const [loans, setLoans] = useState<MemberLoan[]>([]);
  const [payments, setPayments] = useState<FinePayment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadLoans = async () => {
    setLoading(true);
    try {
      const [loanData, paymentData] = await Promise.all([getMyLoans(), getMyFinePayments()]);
      setLoans(loanData);
      setPayments(paymentData);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load your circulation data",
        description: err.message || "Request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const stats = useMemo(() => {
    const active = loans.filter((loan) => !loan.returned_at);
    const returned = loans.filter((loan) => !!loan.returned_at);
    const overdueActive = active.filter((loan) => loan.is_overdue);
    const outstandingFines = loans.reduce((sum, loan) => sum + Number(loan.fine_due || 0), 0);
    const totalFinesPaidOrDue = loans.reduce((sum, loan) => sum + Number(loan.estimated_fine || 0), 0);
    const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return {
      active: active.length,
      returned: returned.length,
      overdueActive: overdueActive.length,
      outstandingFines,
      totalFinesPaidOrDue,
      totalCollected,
    };
  }, [loans, payments]);

  const visibleLoans = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return loans;
    return loans.filter((loan) => {
      const haystack = [
        loan.id,
        loan.book_id,
        loan.book_title,
        loan.book_author,
        loan.book_isbn,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [loans, search]);

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Member</div>
          <h1>My Borrowings & Fines</h1>
          <p className="lede">Track your active loans, returned books, due dates, and fine totals.</p>
        </div>
        <button className="secondary" onClick={loadLoans} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Active Borrowings</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Returned</div>
          <div className="stat-value">{stats.returned}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue (Active)</div>
          <div className="stat-value">{stats.overdueActive}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding Fines</div>
          <div className="stat-value">{formatCurrencyINR(stats.outstandingFines)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Collected</div>
          <div className="stat-value">{formatCurrencyINR(stats.totalCollected)}</div>
        </div>
      </section>

      <section className="table-card">
        <div className="card-header">
          <h2>Loan History</h2>
          <span className="pill">Total Fines {formatCurrencyINR(stats.totalFinesPaidOrDue)}</span>
        </div>
        <div className="filter-bar">
          <div className="filter-field grow">
            <label>Search loans</label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Loan ID, title, author, ISBN"
            />
          </div>
        </div>
        <div className="table">
          {visibleLoans.map((loan) => (
            <div key={loan.id} className="row row-loan">
              <div className="loan-main">
                <strong>{loan.book_title}</strong>
                <div>
                  <span>{loan.book_author}</span>
                </div>
                <div>
                  <span>
                    Loan ID {loan.id} · Book ID {loan.book_id} · ISBN {loan.book_isbn || "N/A"}
                  </span>
                </div>
              </div>
              <div className="loan-dates">
                <div className="meta-label">Borrowed</div>
                <div className="meta-value">{formatDate(loan.borrowed_at)}</div>
                <div className="meta-label">Due</div>
                <div className="meta-value">{formatDate(loan.due_at)}</div>
              </div>
              <div className="row-meta">
                <div className="meta-pair">
                  <div className="meta-label">Status</div>
                  <div className="meta-value">
                    {loan.returned_at ? "Returned" : loan.is_overdue ? "Overdue" : "Active"}
                  </div>
                </div>
                <div className="meta-pair">
                  <div className="meta-label">Fine</div>
                  <div className="meta-value">
                    Due {formatCurrencyINR(Number(loan.fine_due || 0))} / Paid {formatCurrencyINR(Number(loan.fine_paid || 0))}
                  </div>
                </div>
                <span className={`status ${loan.returned_at ? "returned" : loan.is_overdue ? "flag" : "active"}`}>
                  {loan.returned_at ? "Returned" : loan.is_overdue ? "Overdue" : "Active"}
                </span>
              </div>
            </div>
          ))}
          {visibleLoans.length === 0 ? (
            <div className="row">
              <div>
                <strong>No loans found for your account.</strong>
              </div>
              <div />
              <div />
            </div>
          ) : null}
        </div>
      </section>

      <section className="table-card">
        <div className="card-header">
          <h2>Fine Payments</h2>
          <span className="pill">{payments.length} recorded</span>
        </div>
        <div className="table">
          {payments.map((payment) => (
            <div key={payment.id} className="row">
              <div>
                <strong>{formatCurrencyINR(Number(payment.amount || 0))}</strong>
                <div>
                  <span>
                    Loan {payment.loan_id} · Mode {payment.payment_mode.toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <div className="meta-label">Reference</div>
                <div className="meta-value">{payment.reference || "-"}</div>
              </div>
              <div>
                <div className="meta-label">Collected At</div>
                <div className="meta-value">{formatDate(payment.collected_at)}</div>
              </div>
            </div>
          ))}
          {payments.length === 0 ? (
            <div className="row">
              <div>
                <strong>No fine payments recorded yet.</strong>
              </div>
              <div />
              <div />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
