"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { createUser, deleteUser, getUsers, updateUser } from "../../lib/api";

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "member"
  });

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
    const staff = users.filter((user) => user.role === "staff").length;
    const admins = users.filter((user) => user.role === "admin").length;
    return { total, staff, admins };
  }, [users]);

  const roleOptions = useMemo(() => {
    const values = Array.from(new Set(users.map((user) => user.role).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [users]);

  const visibleUsers = useMemo(() => {
    if (roleFilter === "all") return users;
    return users.filter((user) => user.role === roleFilter);
  }, [users, roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser(userForm);
      setUserForm({ name: "", email: "", phone: "", role: "member" });
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

  const handleEditUser = async (user: any) => {
    const name = window.prompt("Edit name", user.name);
    if (name === null) return;
    const email = window.prompt("Edit email (optional)", user.email || "");
    if (email === null) return;
    const phone = window.prompt("Edit phone (optional)", user.phone || "");
    if (phone === null) return;
    const role = window.prompt("Edit role (member/staff/admin)", user.role || "member");
    if (role === null) return;

    const normalizedRole = role.trim().toLowerCase();
    if (!["member", "staff", "admin"].includes(normalizedRole)) {
      showToast({ type: "error", title: "Invalid role value" });
      return;
    }

    try {
      await updateUser(user.id, {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role: normalizedRole,
      });
      showToast({ type: "success", title: "User updated successfully" });
      refresh();
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
          <h1>Community Members</h1>
          <p className="lede">Track memberships, roles, and contact details.</p>
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
          <div className="stat-label">Staff</div>
          <div className="stat-value">{stats.staff}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Admins</div>
          <div className="stat-value">{stats.admins}</div>
        </div>
      </section>

      <section className="page-grid">
        <div className="table-card">
          <div className="card-header">
            <h2>Active Users</h2>
            <span className="pill">Roster</span>
          </div>
          <div className="filter-bar">
            <div className="filter-field">
              <label>Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                data-testid="users-role-filter"
              >
                <option value="all">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="table">
            {visibleUsers.map((user) => (
              <div
                key={user.id}
                className="row"
                data-testid="user-row"
                data-user-id={user.id}
              >
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
                    <button className="ghost small" type="button" onClick={() => handleEditUser(user)}>
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
                  <strong>No users match the selected role.</strong>
                </div>
                <div />
                <div />
              </div>
            )}
          </div>
        </div>

        <aside className="panel-card">
          <h2>Add User</h2>
          <form onSubmit={handleCreateUser} data-testid="user-form">
            <div>
              <label>Name</label>
              <input
                data-testid="user-name"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label>Email</label>
              <input
                data-testid="user-email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </div>
            <div>
              <label>Phone</label>
              <input
                data-testid="user-phone"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label>Role</label>
              <select
                data-testid="user-role"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              >
                <option value="member">Member</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" data-testid="user-submit">
              Add User
            </button>
          </form>
        </aside>
      </section>
    </div>
  );
}
