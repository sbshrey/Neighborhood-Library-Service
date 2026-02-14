"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "../../components/ToastProvider";
import { getPolicy, getUsers } from "../../lib/api";

const roleMatrix = [
  {
    role: "member",
    scope: "Borrow and return through staff desk.",
    canManageUsers: "No",
    canManageCatalog: "No",
    canManagePolicy: "No",
  },
  {
    role: "staff",
    scope: "Manage borrowings, returns, fines, and member profiles.",
    canManageUsers: "Yes (non-admin)",
    canManageCatalog: "Read-only",
    canManagePolicy: "No",
  },
  {
    role: "admin",
    scope: "Full system configuration and governance control.",
    canManageUsers: "Yes",
    canManageCatalog: "Yes",
    canManagePolicy: "Yes",
  },
];

export default function RolesPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    try {
      const [usersData, policyData] = await Promise.all([getUsers(), getPolicy()]);
      setUsers(usersData);
      setPolicy(policyData);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load roles data",
        description: err.message || "Request failed",
      });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const roleStats = useMemo(() => {
    const members = users.filter((user) => user.role === "member").length;
    const staff = users.filter((user) => user.role === "staff").length;
    const admins = users.filter((user) => user.role === "admin").length;
    return { members, staff, admins };
  }, [users]);

  const visibleRoles = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return roleMatrix;
    return roleMatrix.filter((role) => {
      const haystack =
        `${role.role} ${role.scope} ${role.canManageUsers} ${role.canManageCatalog} ${role.canManagePolicy}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [search]);

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Roles</div>
          <h1>Roles & Permissions</h1>
          <p className="lede">Keep operational privileges explicit and searchable across admin and staff workflows.</p>
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Members</div>
          <div className="stat-value">{roleStats.members}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Staff</div>
          <div className="stat-value">{roleStats.staff}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Admins</div>
          <div className="stat-value">{roleStats.admins}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Policy Mode</div>
          <div className="stat-value">{policy?.enforce_limits ? "Enforced" : "Relaxed"}</div>
        </div>
      </section>

      <section className="table-card">
        <div className="card-header">
          <h2>Role Matrix</h2>
          <span className="pill">Governance</span>
        </div>
        <div className="filter-bar">
          <div className="filter-field grow">
            <label>Search matrix</label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Role, scope, or permission"
            />
          </div>
        </div>
        <div className="table">
          {visibleRoles.map((item) => (
            <div key={item.role} className="row">
              <div>
                <strong>{item.role.toUpperCase()}</strong>
                <div>
                  <span>{item.scope}</span>
                </div>
              </div>
              <div>
                <div className="meta-label">User Management</div>
                <div className="meta-value">{item.canManageUsers}</div>
                <div className="meta-label">Catalog</div>
                <div className="meta-value">{item.canManageCatalog}</div>
              </div>
              <div>
                <div className="meta-label">Policy Controls</div>
                <div className="meta-value">{item.canManagePolicy}</div>
                <span className={`status ${item.role === "admin" ? "active" : "flag"}`}>
                  {item.role === "admin" ? "Full" : item.role === "staff" ? "Operational" : "Limited"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
