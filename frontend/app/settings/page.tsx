"use client";

import { useState } from "react";

import { useToast } from "../../components/ToastProvider";
import { importBooksFile, importLoansFile, importUsersFile, seedData } from "../../lib/api";

export default function SettingsPage() {
  const { showToast } = useToast();
  const [booksFile, setBooksFile] = useState<File | null>(null);
  const [usersFile, setUsersFile] = useState<File | null>(null);
  const [loansFile, setLoansFile] = useState<File | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const runImport = async (
    entity: "books" | "users" | "loans",
    file: File | null,
    importer: (input: File) => Promise<{ imported: number; skipped: number; errors: Array<any> }>
  ) => {
    if (!file) {
      showToast({ type: "error", title: `Select a ${entity} CSV/XLSX file first` });
      return;
    }
    setLoadingAction(entity);
    try {
      const result = await importer(file);
      const errorCount = result.errors?.length || 0;
      showToast({
        type: errorCount > 0 ? "info" : "success",
        title: `${entity} import complete`,
        description: `Imported ${result.imported}, skipped ${result.skipped}, errors ${errorCount}`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: `${entity} import failed`,
        description: err.message || "Request failed",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const runSeed = async () => {
    setLoadingAction("seed");
    try {
      const result = await seedData();
      showToast({
        type: "success",
        title: "Indian sample dataset loaded",
        description: `Books ${result.counts?.books || 0}, Users ${result.counts?.users || 0}, Loans ${result.counts?.loans || 0}`,
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Sample load failed",
        description: err.message || "Request failed",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Settings</div>
          <h1>Library Configuration</h1>
          <p className="lede">Configure policies and import onboarding data in bulk.</p>
        </div>
      </header>

      <section className="page-grid">
        <div className="table-card">
          <div className="card-header">
            <h2>Bulk Import</h2>
            <span className="pill">CSV / XLSX</span>
          </div>
          <div className="settings-grid">
            <div className="settings-item">
              <div>
                <strong>Import Books</strong>
                <p>Headers: title, author, subject, rack_number, isbn, published_year, copies_total</p>
              </div>
              <div className="row-actions">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => setBooksFile(event.target.files?.[0] || null)}
                />
                <button
                  className="ghost"
                  onClick={() => runImport("books", booksFile, importBooksFile)}
                  disabled={loadingAction === "books"}
                >
                  {loadingAction === "books" ? "Importing..." : "Import"}
                </button>
              </div>
            </div>

            <div className="settings-item">
              <div>
                <strong>Import Users</strong>
                <p>Headers: name, email, phone, role, password</p>
              </div>
              <div className="row-actions">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => setUsersFile(event.target.files?.[0] || null)}
                />
                <button
                  className="ghost"
                  onClick={() => runImport("users", usersFile, importUsersFile)}
                  disabled={loadingAction === "users"}
                >
                  {loadingAction === "users" ? "Importing..." : "Import"}
                </button>
              </div>
            </div>

            <div className="settings-item">
              <div>
                <strong>Import Loans</strong>
                <p>Headers: book_id/book_isbn, user_id/user_email, days, borrowed_at, due_at, returned_at</p>
              </div>
              <div className="row-actions">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(event) => setLoansFile(event.target.files?.[0] || null)}
                />
                <button
                  className="ghost"
                  onClick={() => runImport("loans", loansFile, importLoansFile)}
                  disabled={loadingAction === "loans"}
                >
                  {loadingAction === "loans" ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="panel-card">
          <div className="card-header">
            <h2>Onboarding Dataset</h2>
            <span className="pill">India Demo</span>
          </div>
          <div className="settings-grid">
            <div className="settings-item">
              <div>
                <strong>Bundled Indian Books + Users + Loans</strong>
                <p>Loads curated CSV data with overdue and returned transactions.</p>
              </div>
              <button className="secondary" onClick={runSeed} disabled={loadingAction === "seed"}>
                {loadingAction === "seed" ? "Loading..." : "Load Dataset"}
              </button>
            </div>
            <div className="settings-item">
              <div>
                <strong>Circulation policy</strong>
                <p>Max 5 active loans/user, max 21 days, fines per day for overdue books.</p>
              </div>
              <span className="status active">Enforced</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
