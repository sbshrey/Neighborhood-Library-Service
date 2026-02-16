"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import SearchableSelect from "../../components/SearchableSelect";
import { useToast } from "../../components/ToastProvider";
import {
  getPolicy,
  importBooksFile,
  importLoansFile,
  importUsersFile,
  seedData,
  updatePolicy,
} from "../../lib/api";

const importFilterOptions = [
  { value: "books", label: "Books import" },
  { value: "users", label: "Users import" },
  { value: "loans", label: "Loans import" },
];

const moduleFilterOptions = [
  { value: "catalog", label: "Catalog module" },
  { value: "users", label: "Users module" },
  { value: "roles", label: "Roles module" },
  { value: "audit", label: "Audit module" },
];

const modules = [
  { id: "catalog", href: "/catalog", title: "Catalog", desc: "Search and edit titles, ISBN, rack, and inventory." },
  { id: "users", href: "/users", title: "Users", desc: "Search members, update user data, assign roles." },
  { id: "roles", href: "/roles", title: "Roles", desc: "Review role scope and policy access model." },
  { id: "audit", href: "/audit", title: "Audit", desc: "Track admin activity and high-risk actions." },
];

type ImportEntity = "books" | "users" | "loans";

export default function SettingsPage() {
  const { showToast } = useToast();
  const [booksFile, setBooksFile] = useState<File | null>(null);
  const [usersFile, setUsersFile] = useState<File | null>(null);
  const [loansFile, setLoansFile] = useState<File | null>(null);
  const [importFilter, setImportFilter] = useState<string[]>([]);
  const [moduleFilter, setModuleFilter] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [draggingEntity, setDraggingEntity] = useState<ImportEntity | null>(null);
  const fileInputRefs = useRef<Record<ImportEntity, HTMLInputElement | null>>({
    books: null,
    users: null,
    loans: null,
  });
  const [policyForm, setPolicyForm] = useState({
    enforce_limits: true,
    max_active_loans_per_user: "5",
    max_loan_days: "21",
    fine_per_day: "2.0",
  });

  const loadPolicy = async () => {
    try {
      const policy = await getPolicy();
      setPolicyForm({
        enforce_limits: policy.enforce_limits,
        max_active_loans_per_user: String(policy.max_active_loans_per_user),
        max_loan_days: String(policy.max_loan_days),
        fine_per_day: String(policy.fine_per_day),
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load circulation policy",
        description: err.message || "Request failed",
      });
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const importRows = useMemo(
    () => [
      {
        entity: "books" as const,
        title: "Import Books",
        headers: "Headers: title, author, subject, rack_number, isbn, published_year, copies_total",
        file: booksFile,
        setFile: setBooksFile,
        importer: importBooksFile,
      },
      {
        entity: "users" as const,
        title: "Import Users",
        headers: "Headers: name, email, phone, role, password",
        file: usersFile,
        setFile: setUsersFile,
        importer: importUsersFile,
      },
      {
        entity: "loans" as const,
        title: "Import Loans",
        headers: "Headers: book_id/book_isbn, user_id/user_email, days, borrowed_at, due_at, returned_at",
        file: loansFile,
        setFile: setLoansFile,
        importer: importLoansFile,
      },
    ],
    [booksFile, usersFile, loansFile]
  );

  const visibleImportRows = useMemo(
    () =>
      importRows.filter((row) => {
        if (importFilter.length === 0) return true;
        return importFilter.includes(row.entity);
      }),
    [importRows, importFilter]
  );

  const visibleModules = useMemo(
    () =>
      modules.filter((module) => {
        if (moduleFilter.length === 0) return true;
        return moduleFilter.includes(module.id);
      }),
    [moduleFilter]
  );

  const isValidImportFile = (file: File) => {
    const lower = file.name.toLowerCase();
    return lower.endsWith(".csv") || lower.endsWith(".xlsx");
  };

  const assignImportFile = (
    entity: ImportEntity,
    file: File | null,
    setFile: (file: File | null) => void
  ) => {
    if (!file) {
      setFile(null);
      return;
    }
    if (!isValidImportFile(file)) {
      showToast({
        type: "error",
        title: `Invalid file for ${entity} import`,
        description: "Only .csv or .xlsx files are supported.",
      });
      return;
    }
    setFile(file);
  };

  const clearImportFile = (entity: ImportEntity, setFile: (file: File | null) => void) => {
    setFile(null);
    const input = fileInputRefs.current[entity];
    if (input) input.value = "";
  };

  const runImport = async (
    entity: ImportEntity,
    file: File | null,
    importer: (input: File) => Promise<{ imported: number; skipped: number; errors: Array<any> }>,
    setFile: (file: File | null) => void
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
      clearImportFile(entity, setFile);
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

  const savePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoadingAction("policy");
    try {
      const saved = await updatePolicy({
        enforce_limits: policyForm.enforce_limits,
        max_active_loans_per_user: Number(policyForm.max_active_loans_per_user),
        max_loan_days: Number(policyForm.max_loan_days),
        fine_per_day: Number(policyForm.fine_per_day),
      });
      setPolicyForm({
        enforce_limits: saved.enforce_limits,
        max_active_loans_per_user: String(saved.max_active_loans_per_user),
        max_loan_days: String(saved.max_loan_days),
        fine_per_day: String(saved.fine_per_day),
      });
      showToast({
        type: "success",
        title: "Circulation policy updated",
        description: "Borrowing and fine rules are now enforced with the latest values.",
      });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to update policy",
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
          <h1>Admin Control Center</h1>
          <p className="lede">Configure enforcement policies, onboarding workflows, and admin modules.</p>
        </div>
      </header>

      <section className="settings-layout">
        <div className="table-card">
          <div className="card-header">
            <h2>Circulation Policy</h2>
            <span className={`status ${policyForm.enforce_limits ? "active" : "returned"}`}>
              {policyForm.enforce_limits ? "Enforced" : "Relaxed"}
            </span>
          </div>
          <form onSubmit={savePolicy} className="policy-form">
            <div className="toggle-row">
              <label htmlFor="enforce-limits">Enforce borrowing limits</label>
              <input
                id="enforce-limits"
                type="checkbox"
                data-testid="policy-enforce-limits"
                checked={policyForm.enforce_limits}
                onChange={(event) =>
                  setPolicyForm({ ...policyForm, enforce_limits: event.target.checked })
                }
              />
            </div>
            <div className="form-grid-2">
              <div>
                <label>Max Active Loans / User</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  data-testid="policy-max-active-loans"
                  value={policyForm.max_active_loans_per_user}
                  onChange={(event) =>
                    setPolicyForm({
                      ...policyForm,
                      max_active_loans_per_user: event.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <label>Max Loan Days</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  data-testid="policy-max-loan-days"
                  value={policyForm.max_loan_days}
                  onChange={(event) =>
                    setPolicyForm({ ...policyForm, max_loan_days: event.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div>
              <label>Fine / Overdue Day (₹)</label>
              <input
                type="number"
                min={0}
                step="0.5"
                data-testid="policy-fine-per-day"
                value={policyForm.fine_per_day}
                onChange={(event) =>
                  setPolicyForm({ ...policyForm, fine_per_day: event.target.value })
                }
                required
              />
            </div>
            <button type="submit" disabled={loadingAction === "policy"} data-testid="policy-save">
              {loadingAction === "policy" ? "Saving..." : "Save Policy"}
            </button>
          </form>
        </div>

        <aside className="panel-card">
          <div className="card-header">
            <h2>Onboarding Dataset</h2>
            <span className="pill">India Demo</span>
          </div>
          <div className="settings-grid">
            <div className="settings-item">
              <div>
                <strong>Bundled Books + Users + Loans</strong>
                <p>Load curated Indian catalog, user profiles, and borrowing history.</p>
              </div>
              <button className="secondary" onClick={runSeed} disabled={loadingAction === "seed"}>
                {loadingAction === "seed" ? "Loading..." : "Load Dataset"}
              </button>
            </div>
          </div>
        </aside>
      </section>

      <section className="table-card">
        <div className="card-header">
          <h2>Bulk Import</h2>
          <span className="pill">CSV / XLSX</span>
        </div>
        <div className="filter-bar">
          <div className="filter-field">
            <SearchableSelect
              label="Import filter"
              value={importFilter}
              options={importFilterOptions}
              placeholder="All import types"
              onChange={setImportFilter}
              multiple
              testId="settings-import-filter"
            />
          </div>
        </div>
        <div className="settings-grid">
          {visibleImportRows.map((row) => (
            <div className="settings-item" key={row.entity}>
              <div>
                <strong>{row.title}</strong>
                <p>{row.headers}</p>
              </div>
              <div className="row-actions">
                <div
                  className={`file-dropzone${draggingEntity === row.entity ? " dragging" : ""}`}
                  data-testid={`import-dropzone-${row.entity}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDraggingEntity(row.entity);
                  }}
                  onDragLeave={() => setDraggingEntity((current) => (current === row.entity ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDraggingEntity(null);
                    assignImportFile(row.entity, event.dataTransfer.files?.[0] || null, row.setFile);
                  }}
                >
                  <input
                    id={`import-file-${row.entity}`}
                    ref={(node) => {
                      fileInputRefs.current[row.entity] = node;
                    }}
                    type="file"
                    accept=".csv,.xlsx"
                    className="file-input-hidden"
                    data-testid={`import-file-input-${row.entity}`}
                    onChange={(event) => assignImportFile(row.entity, event.target.files?.[0] || null, row.setFile)}
                  />
                  <span className="file-dropzone-text" data-testid={`import-file-name-${row.entity}`}>
                    {row.file ? row.file.name : "Drag and drop CSV/XLSX here"}
                  </span>
                  <label htmlFor={`import-file-${row.entity}`} className="ghost-link">
                    Choose File
                  </label>
                </div>
                <button
                  className="ghost"
                  data-testid={`import-run-${row.entity}`}
                  onClick={() => runImport(row.entity, row.file, row.importer, row.setFile)}
                  disabled={loadingAction === row.entity}
                >
                  {loadingAction === row.entity ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="table-card">
        <div className="card-header">
          <h2>Admin Modules</h2>
          <span className="pill">Restricted</span>
        </div>
        <div className="filter-bar">
          <div className="filter-field">
            <SearchableSelect
              label="Module filter"
              value={moduleFilter}
              options={moduleFilterOptions}
              placeholder="All admin modules"
              onChange={setModuleFilter}
              multiple
              testId="settings-module-filter"
            />
          </div>
        </div>
        <div className="settings-links-grid">
          {visibleModules.map((module) => (
            <Link className="settings-module-link" href={module.href} key={module.id}>
              <strong>{module.title}</strong>
              <span>{module.desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
