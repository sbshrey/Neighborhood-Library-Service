"use client";

import { useEffect, useMemo, useState } from "react";

import ListViewCard, { ListGrid } from "../../components/ListViewCard";
import SearchableSelect from "../../components/SearchableSelect";
import { useToast } from "../../components/ToastProvider";
import { FinePaymentLedgerItem, queryFinePayments } from "../../lib/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatCurrencyINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function FinesLedgerPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<FinePaymentLedgerItem[]>([]);
  const [search, setSearch] = useState("");
  const [paymentModes, setPaymentModes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("collected_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);

  const sortConfigMap: Record<string, { sort_by: string; sort_order: "asc" | "desc" }> = {
    collected_desc: { sort_by: "collected_at", sort_order: "desc" },
    collected_asc: { sort_by: "collected_at", sort_order: "asc" },
    amount_desc: { sort_by: "amount", sort_order: "desc" },
    amount_asc: { sort_by: "amount", sort_order: "asc" },
    user_asc: { sort_by: "user_name", sort_order: "asc" },
    user_desc: { sort_by: "user_name", sort_order: "desc" },
    title_asc: { sort_by: "book_title", sort_order: "asc" },
    title_desc: { sort_by: "book_title", sort_order: "desc" },
    id_desc: { sort_by: "id", sort_order: "desc" },
    id_asc: { sort_by: "id", sort_order: "asc" },
  };

  const paymentModeOptions = [
    { value: "upi", label: "UPI" },
    { value: "cash", label: "Cash" },
    { value: "card", label: "Card" },
    { value: "net_banking", label: "Net Banking" },
    { value: "wallet", label: "Wallet" },
    { value: "waiver", label: "Waiver" },
    { value: "adjustment", label: "Adjustment" },
  ];

  const sortOptions = [
    { value: "collected_desc", label: "Collected newest" },
    { value: "collected_asc", label: "Collected oldest" },
    { value: "amount_desc", label: "Amount high-low" },
    { value: "amount_asc", label: "Amount low-high" },
    { value: "user_asc", label: "User A-Z" },
    { value: "user_desc", label: "User Z-A" },
    { value: "title_asc", label: "Book title A-Z" },
    { value: "title_desc", label: "Book title Z-A" },
    { value: "id_desc", label: "Payment ID newest" },
    { value: "id_asc", label: "Payment ID oldest" },
  ];

  const loadPage = async (showSuccess = false) => {
    setLoading(true);
    try {
      const sortConfig = sortConfigMap[sortBy] || sortConfigMap.collected_desc;
      const ledgerRows = await queryFinePayments({
        q: search.trim() || undefined,
        payment_mode: paymentModes,
        sort_by: sortConfig.sort_by,
        sort_order: sortConfig.sort_order,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      });
      setRows(ledgerRows);
      setHasNextPage(ledgerRows.length === pageSize);
      if (showSuccess) {
        showToast({ type: "success", title: "Fines ledger refreshed" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load fines ledger",
        description: err.message || "Request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [search, paymentModes, sortBy, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, paymentModes, sortBy, pageSize]);

  const stats = useMemo(() => {
    const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const uniqueUsers = new Set(rows.map((row) => row.user_id)).size;
    const uniqueLoans = new Set(rows.map((row) => row.loan_id)).size;
    return {
      records: rows.length,
      totalAmount,
      uniqueUsers,
      uniqueLoans,
    };
  }, [rows]);

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Fines</div>
          <h1>Fines Ledger</h1>
          <p className="lede">
            Payment ledger for collected fines with user, loan, and catalog traceability.
          </p>
        </div>
        <button className="secondary" onClick={() => loadPage(true)} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Rows On Page</div>
          <div className="stat-value">{stats.records}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Collected (Page)</div>
          <div className="stat-value">{formatCurrencyINR(stats.totalAmount)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Users</div>
          <div className="stat-value">{stats.uniqueUsers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Loans</div>
          <div className="stat-value">{stats.uniqueLoans}</div>
        </div>
      </section>

      <ListViewCard
        title="Collection Register"
        headerRight={<span className="pill">Auditable</span>}
        filters={(
          <>
            <div className="filter-field grow">
              <label>Search</label>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Payment ID, loan, user name/email/phone, title, ISBN, reference"
              />
            </div>
            <div className="filter-field">
              <SearchableSelect
                label="Payment Mode"
                value={paymentModes}
                options={paymentModeOptions}
                placeholder="All modes"
                onChange={setPaymentModes}
                multiple
                testId="fines-mode-filter"
              />
            </div>
            <div className="filter-field">
              <SearchableSelect
                label="Sort"
                value={sortBy}
                options={sortOptions}
                placeholder="Sort"
                onChange={setSortBy}
                testId="fines-sort"
              />
            </div>
            <div className="filter-field">
              <label>Page Size</label>
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </>
        )}
        footer={(
          <div className="table-footer">
            <div className="meta-label">
              Page {page} · Showing {rows.length} payment record{rows.length === 1 ? "" : "s"}
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="ghost small"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || loading}
              >
                Previous
              </button>
              <button
                type="button"
                className="ghost small"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasNextPage || loading}
              >
                Next
              </button>
            </div>
          </div>
        )}
      >
        <ListGrid>
          {rows.map((row) => (
            <div key={row.id} className="row row-fine" data-testid="fine-row">
              <div>
                <strong>{row.book_title}</strong>
                <div>
                  <span>{row.book_author}</span>
                </div>
                <div>
                  <span>
                    Loan ID {row.loan_id} · Book ID {row.book_id} · ISBN {row.book_isbn || "N/A"}
                  </span>
                </div>
              </div>
              <div>
                <div className="meta-pair">
                  <div className="meta-label">Collected</div>
                  <div className="meta-value">{formatDate(row.collected_at)}</div>
                </div>
                <div className="meta-pair">
                  <div className="meta-label">Amount</div>
                  <div className="meta-value">{formatCurrencyINR(Number(row.amount || 0))}</div>
                </div>
                <div className="meta-pair">
                  <div className="meta-label">Mode</div>
                  <div className="meta-value">{row.payment_mode}</div>
                </div>
              </div>
              <div className="row-meta">
                <div className="meta-pair">
                  <div className="meta-label">User</div>
                  <div className="meta-value">{row.user_name}</div>
                </div>
                <div className="meta-pair">
                  <div className="meta-label">Contact</div>
                  <div className="meta-value">{row.user_email || row.user_phone || "-"}</div>
                </div>
                <div className="meta-pair">
                  <div className="meta-label">Reference</div>
                  <div className="meta-value">{row.reference || "-"}</div>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="row">
              <div>
                <strong>{loading ? "Loading fines ledger..." : "No fine payment records found."}</strong>
              </div>
              <div />
              <div />
            </div>
          ) : null}
        </ListGrid>
      </ListViewCard>
    </div>
  );
}
