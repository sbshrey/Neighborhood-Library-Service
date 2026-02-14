"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../components/ToastProvider";
import { getBooks, getLoans, getUsers, seedData } from "../lib/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [seeding, setSeeding] = useState(false);

  const refresh = async (showSuccess = false) => {
    try {
      const [b, u, l] = await Promise.all([getBooks(), getUsers(), getLoans()]);
      setBooks(b);
      setUsers(u);
      setLoans(l);
      if (showSuccess) {
        showToast({ type: "success", title: "Dashboard refreshed" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load dashboard",
        description: err.message || "Request failed",
      });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => {
    const totalCopies = books.reduce((sum, book) => sum + book.copies_total, 0);
    const availableCopies = books.reduce((sum, book) => sum + book.copies_available, 0);
    const activeLoans = loans.filter((loan) => !loan.returned_at);
    const overdueLoans = activeLoans.filter((loan) => {
      const due = new Date(loan.due_at);
      return !Number.isNaN(due.getTime()) && due < new Date();
    });
    const returnedLoans = loans.filter((loan) => loan.returned_at).length;
    const utilization = totalCopies
      ? Math.round(((totalCopies - availableCopies) / totalCopies) * 100)
      : 0;
    return {
      totalCopies,
      availableCopies,
      users: users.length,
      activeLoans: activeLoans.length,
      overdue: overdueLoans.length,
      returnRate: loans.length ? Math.round((returnedLoans / loans.length) * 100) : 0,
      utilization
    };
  }, [books, users, loans]);

  const recentLoans = useMemo(() => loans.slice(0, 6), [loans]);

  const circulationTrend = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        label: date.toLocaleDateString(undefined, { weekday: "short" })
      };
    });
    const counts = loans.reduce<Record<string, number>>((acc, loan) => {
      const timestamp = new Date(loan.borrowed_at);
      if (Number.isNaN(timestamp.getTime())) return acc;
      const key = timestamp.toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const series = days.map((day) => ({
      ...day,
      value: counts[day.key] || 0
    }));
    const max = Math.max(1, ...series.map((item) => item.value));
    return { series, max };
  }, [loans]);

  const activityFeed = useMemo(() => {
    const items = loans
      .map((loan) => {
        const returned = Boolean(loan.returned_at);
        const timestamp = returned ? loan.returned_at : loan.borrowed_at;
        return {
          title: returned ? "Return processed" : "Loan issued",
          detail: `Book ${loan.book_id} • User ${loan.user_id}`,
          time: formatTimestamp(timestamp),
          sortKey: timestamp ? new Date(timestamp).getTime() : 0
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey)
      .slice(0, 6);
    return items;
  }, [loans]);

  const inventoryAlerts = useMemo(() => {
    return books
      .filter((book) => book.copies_available <= 1)
      .slice(0, 4)
      .map((book) => ({
        title: book.title,
        detail: `${book.copies_available}/${book.copies_total} available`,
        isbn: book.isbn || "-"
      }));
  }, [books]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedData();
      const message = result.status === "created" ? "Sample data loaded." : result.message;
      showToast({
        type: "success",
        title: "Seed completed",
        description: message || "Sample data request complete.",
      });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to seed sample data",
        description: err.message || "Request failed",
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <div className="badge">Operational Console</div>
          <h1>Library Overview</h1>
          <p className="lede">
            Track circulation, monitor availability, and keep the catalog healthy. Launch with
            production-ready sample data or operate live.
          </p>
        </div>
        <div className="page-actions">
          <button className="ghost" onClick={handleSeed} disabled={seeding} data-testid="seed-data">
            {seeding ? "Seeding..." : "Load Sample Data"}
          </button>
          <button className="secondary" onClick={() => refresh(true)}>
            Refresh Data
          </button>
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Copies</div>
          <div className="stat-value">{stats.totalCopies}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available Now</div>
          <div className="stat-value">{stats.availableCopies}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Loans</div>
          <div className="stat-value">{stats.activeLoans}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue</div>
          <div className="stat-value">{stats.overdue}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Return Rate</div>
          <div className="stat-value">{stats.returnRate}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Utilization</div>
          <div className="stat-value">{stats.utilization}%</div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel-stack">
          <div className="panel-card">
            <div className="card-header">
              <h2>Circulation Trend</h2>
              <span className="pill">Last 7 days</span>
            </div>
            <div className="chart">
              <div className="chart-bars">
                {circulationTrend.series.map((item) => (
                  <div key={item.key} className="chart-bar">
                    <div
                      className="chart-bar-fill"
                      style={{ height: `${Math.round((item.value / circulationTrend.max) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                {circulationTrend.series.map((item) => (
                  <span key={item.key}>{item.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="card-header">
              <h2>Catalog Pulse</h2>
              <span className="pill">Live inventory</span>
            </div>
            <div className="table">
              {books.map((book) => (
                <div key={book.id} className="row">
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="table-card">
            <div className="card-header">
              <h2>Recent Loans</h2>
              <span className="pill">Last updated</span>
            </div>
            <div className="table">
              {recentLoans.map((loan) => (
                <div key={loan.id} className="row">
                  <div>
                    <strong>Loan #{loan.id}</strong>
                    <div>
                      <span>Borrowed {formatDate(loan.borrowed_at)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="meta-label">Book ID</div>
                    <div className="meta-value">{loan.book_id}</div>
                    <div className="meta-label">User ID</div>
                    <div className="meta-value">{loan.user_id}</div>
                  </div>
                  <div className="row-meta">
                    <div className="meta-pair">
                      <div className="meta-label">Due</div>
                      <div className="meta-value">{formatDate(loan.due_at)}</div>
                    </div>
                    <span className={`status ${loan.returned_at ? "returned" : "active"}`}>
                      {loan.returned_at ? "Returned" : "Active"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="panel-stack">
          <div className="panel-card">
            <div className="card-header">
              <h2>Activity Feed</h2>
              <span className="pill">Circulation</span>
            </div>
            <div className="activity">
              {activityFeed.map((event) => (
                <div key={`${event.title}-${event.detail}`} className="activity-item">
                  <div>
                    <strong>{event.title}</strong>
                    <div>
                      <span>{event.detail}</span>
                    </div>
                  </div>
                  <span className="activity-time">{event.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-card">
            <div className="card-header">
              <h2>Inventory Alerts</h2>
              <span className="pill">Low stock</span>
            </div>
            <div className="activity">
              {inventoryAlerts.length === 0 ? (
                <div className="activity-item">
                  <div>
                    <strong>All shelves healthy</strong>
                    <div>
                      <span>No low-stock titles detected.</span>
                    </div>
                  </div>
                  <span className="status active">Stable</span>
                </div>
              ) : (
                inventoryAlerts.map((alert) => (
                  <div key={alert.title} className="activity-item">
                    <div>
                      <strong>{alert.title}</strong>
                      <div>
                        <span>{alert.detail}</span>
                      </div>
                      <div className="meta-label">ISBN {alert.isbn}</div>
                    </div>
                    <span className="status flag">Watch</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
