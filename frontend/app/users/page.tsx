"use client";

import { useEffect, useMemo, useState } from "react";
import SearchableSelect from "../../components/SearchableSelect";
import { useToast } from "../../components/ToastProvider";
import { createUser, deleteUser, getUsers, updateUser } from "../../lib/api";

const initialUserForm = {
  name: "",
  email: "",
  phone: "",
  role: "member",
};

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [userForm, setUserForm] = useState(initialUserForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(initialUserForm);

  const refresh = async (showSuccess = false) => {
    try {
      setUsers(await getUsers());
      if (showSuccess) {
        showToast({ type: "success", title: "Users refreshed" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load users",
        description: err.message || "Request failed",
      });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(() => {
    const total = users.length;
    const members = users.filter((user) => user.role === "member").length;
    const staff = users.filter((user) => user.role === "staff").length;
    const admins = users.filter((user) => user.role === "admin").length;
    return { total, members, staff, admins };
  }, [users]);

  const roleOptions = useMemo(() => {
    const values = Array.from(new Set(users.map((user) => user.role).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [users]);

  const roleFilterOptions = useMemo(
    () => [
      { value: "all", label: "All roles", keywords: "all any" },
      ...roleOptions.map((role) => ({ value: role, label: role, keywords: role })),
    ],
    [roleOptions]
  );

  const visibleUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!normalized) return true;
      const haystack = `${user.id} ${user.name} ${user.email || ""} ${user.phone || ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [users, roleFilter, search]);

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createUser(userForm);
      setUserForm(initialUserForm);
      showToast({ type: "success", title: "User created successfully" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to create user",
        description: err.message || "Request failed",
      });
    }
  };

  const openEditor = (user: any) => {
    setEditingId(user.id);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "member",
    });
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    try {
      await updateUser(editingId, {
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        role: editForm.role,
      });
      showToast({ type: "success", title: "User updated successfully" });
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to update user",
        description: err.message || "Request failed",
      });
    }
  };

  const handleDeleteUser = async (user: any) => {
    const ok = window.confirm(`Delete user "${user.name}"?`);
    if (!ok) return;
    try {
      await deleteUser(user.id);
      if (editingId === user.id) {
        setEditingId(null);
      }
      showToast({ type: "success", title: "User deleted successfully" });
      refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to delete user",
        description: err.message || "Request failed",
      });
    }
  };

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Users</div>
          <h1>User Administration</h1>
          <p className="lede">Search and update member/staff records, then create new users from the same workspace.</p>
        </div>
        <button className="secondary" onClick={() => refresh(true)}>
          Refresh
        </button>
      </header>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Members</div>
          <div className="stat-value">{stats.members}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Staff</div>
          <div className="stat-value">{stats.staff}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Admins</div>
          <div className="stat-value">{stats.admins}</div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="table-card">
          <div className="card-header">
            <h2>User Directory</h2>
            <span className="pill">Searchable</span>
          </div>
          <div className="filter-bar">
            <div className="filter-field grow">
              <label>Search</label>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, phone, user ID"
              />
            </div>
            <div className="filter-field">
              <SearchableSelect
                label="Role"
                value={roleFilter}
                options={roleFilterOptions}
                placeholder="Filter by role"
                onChange={setRoleFilter}
                testId="users-role-filter"
              />
            </div>
          </div>
          <div className="table">
            {visibleUsers.map((user) => (
              <div key={user.id} className={`row ${editingId === user.id ? "row-highlight" : ""}`} data-testid="user-row" data-user-id={user.id}>
                <div>
                  <strong>{user.name}</strong>
                  <div>
                    <span>{user.email || "-"}</span>
                  </div>
                  <div>
                    <span>{user.phone || "-"}</span>
                  </div>
                </div>
                <div>
                  <div className="meta-label">Role</div>
                  <div className="meta-value">{user.role}</div>
                </div>
                <div className="row-meta">
                  <div className="meta-pair">
                    <div className="meta-label">User ID</div>
                    <div className="meta-value">{user.id}</div>
                  </div>
                  <div className="row-actions">
                    <button className="ghost small" type="button" onClick={() => openEditor(user)}>
                      Edit
                    </button>
                    <button className="danger small" type="button" onClick={() => handleDeleteUser(user)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {visibleUsers.length === 0 && (
              <div className="row">
                <div>
                  <strong>No users match the active search and role filters.</strong>
                </div>
                <div />
                <div />
              </div>
            )}
          </div>
        </div>

        <aside className="panel-stack">
          <div className="panel-card">
            <h2>Add User</h2>
            <form onSubmit={handleCreateUser} data-testid="user-form">
              <div>
                <label>Name</label>
                <input data-testid="user-name" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} required />
              </div>
              <div>
                <label>Email</label>
                <input data-testid="user-email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
              </div>
              <div>
                <label>Phone</label>
                <input data-testid="user-phone" value={userForm.phone} onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })} />
              </div>
              <div>
                <label>Role</label>
                <select data-testid="user-role" value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
                  <option value="member">Member</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" data-testid="user-submit">
                Add User
              </button>
            </form>
          </div>

          <div className="panel-card">
            <div className="card-header">
              <h2>Edit User</h2>
              <span className="pill">{editingId ? `User ${editingId}` : "Select from list"}</span>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div>
                <label>Name</label>
                <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} disabled={!editingId} required />
              </div>
              <div>
                <label>Email</label>
                <input value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} disabled={!editingId} />
              </div>
              <div>
                <label>Phone</label>
                <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} disabled={!editingId} />
              </div>
              <div>
                <label>Role</label>
                <select value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })} disabled={!editingId}>
                  <option value="member">Member</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" disabled={!editingId}>
                Save Changes
              </button>
            </form>
          </div>
        </aside>
      </section>
    </div>
  );
}
