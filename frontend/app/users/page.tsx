"use client";

import { useEffect, useMemo, useState } from "react";
import ActionModal from "../../components/ActionModal";
import SearchableSelect from "../../components/SearchableSelect";
import { useToast } from "../../components/ToastProvider";
import { createUser, deleteUser, getUsers, queryUsers, updateUser } from "../../lib/api";

const initialUserForm = {
  name: "",
  email: "",
  phone: "",
  role: "member",
};

type UserModalMode = "create" | "edit" | null;

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);

  const [modalMode, setModalMode] = useState<UserModalMode>(null);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState(initialUserForm);

  const sortConfigMap: Record<string, { sort_by: string; sort_order: "asc" | "desc" }> = {
    name_asc: { sort_by: "name", sort_order: "asc" },
    name_desc: { sort_by: "name", sort_order: "desc" },
    role_asc: { sort_by: "role", sort_order: "asc" },
    role_desc: { sort_by: "role", sort_order: "desc" },
    id_asc: { sort_by: "id", sort_order: "asc" },
    id_desc: { sort_by: "id", sort_order: "desc" },
  };

  const loadStats = async () => {
    setAllUsers(await getUsers());
  };

  const loadPage = async (showSuccess = false) => {
    setLoading(true);
    try {
      const sortConfig = sortConfigMap[sortBy] || sortConfigMap.name_asc;
      const rows = await queryUsers({
        q: search.trim() || undefined,
        role: roleFilter,
        sort_by: sortConfig.sort_by,
        sort_order: sortConfig.sort_order,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      });
      setUsers(rows);
      setHasNextPage(rows.length === pageSize);
      if (showSuccess) {
        showToast({ type: "success", title: "Users refreshed" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load users",
        description: err.message || "Request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (showSuccess = false) => {
    try {
      await Promise.all([loadPage(showSuccess), loadStats()]);
    } catch {
      // Errors are already handled in child loaders.
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    loadPage();
  }, [search, roleFilter, sortBy, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, sortBy, pageSize]);

  const stats = useMemo(() => {
    const total = allUsers.length;
    const members = allUsers.filter((user) => user.role === "member").length;
    const staff = allUsers.filter((user) => user.role === "staff").length;
    const admins = allUsers.filter((user) => user.role === "admin").length;
    return { total, members, staff, admins };
  }, [allUsers]);

  const roleOptions = useMemo(() => {
    const values = Array.from(new Set(allUsers.map((user) => user.role).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [allUsers]);

  const roleFilterOptions = useMemo(
    () => roleOptions.map((role) => ({ value: role, label: role, keywords: role })),
    [roleOptions]
  );

  const sortOptions = [
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
    { value: "role_asc", label: "Role A-Z" },
    { value: "role_desc", label: "Role Z-A" },
    { value: "id_desc", label: "User ID Newest" },
    { value: "id_asc", label: "User ID Oldest" },
  ];


  const closeModal = () => setModalMode(null);

  const openCreateModal = () => {
    setActiveUserId(null);
    setUserForm(initialUserForm);
    setModalMode("create");
  };

  const openEditModal = (user: any) => {
    setActiveUserId(user.id);
    setUserForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "member",
    });
    setModalMode("edit");
  };

  const handleUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (modalMode === "edit") {
        if (!activeUserId) return;
        await updateUser(activeUserId, {
          name: userForm.name.trim(),
          email: userForm.email.trim() || null,
          phone: userForm.phone.trim() || null,
          role: userForm.role,
        });
        showToast({ type: "success", title: "User updated successfully" });
      } else {
        await createUser({
          name: userForm.name.trim(),
          email: userForm.email.trim() || undefined,
          phone: userForm.phone.trim() || undefined,
          role: userForm.role,
        });
        showToast({ type: "success", title: "User created successfully" });
      }
      closeModal();
      setActiveUserId(null);
      setUserForm(initialUserForm);
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: modalMode === "edit" ? "Unable to update user" : "Unable to create user",
        description: err.message || "Request failed",
      });
    }
  };

  const handleDeleteUser = async (user: any) => {
    const ok = window.confirm(`Delete user "${user.name}"?`);
    if (!ok) return;
    try {
      await deleteUser(user.id);
      if (activeUserId === user.id) {
        setActiveUserId(null);
      }
      showToast({ type: "success", title: "User deleted successfully" });
      await refresh();
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to delete user",
        description: err.message || "Request failed",
      });
    }
  };

  const modalTitle = modalMode === "edit" ? "Edit User" : "Add User";
  const modalSubtitle =
    modalMode === "edit"
      ? `User ID ${activeUserId ?? "-"} • Update account details and role`
      : "Create a new member, staff, or admin account";

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Users</div>
          <h1>User Administration</h1>
          <p className="lede">
            Search and update member/staff records, then create new users from the same
            workspace.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={openCreateModal} data-testid="user-open-create">
            Add User
          </button>
          <button className="secondary" onClick={() => refresh(true)}>
            Refresh
          </button>
        </div>
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

      <section className="table-card">
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
              placeholder="Any role"
              onChange={setRoleFilter}
              multiple
              testId="users-role-filter"
            />
          </div>
          <div className="filter-field">
            <SearchableSelect
              label="Sort"
              value={sortBy}
              options={sortOptions}
              placeholder="Sort users"
              onChange={setSortBy}
              testId="users-sort"
            />
          </div>
          <div className="filter-field">
            <label>Page Size</label>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              data-testid="users-page-size"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <div className="table">
          {users.map((user) => (
            <div
              key={user.id}
              className={`row ${
                activeUserId === user.id && modalMode === "edit" ? "row-highlight" : ""
              }`}
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
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => openEditModal(user)}
                  >
                    Edit
                  </button>
                  <button
                    className="danger small"
                    type="button"
                    onClick={() => handleDeleteUser(user)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="row">
              <div>
                <strong>
                  {loading ? "Loading users page..." : "No users match the active search and role filters."}
                </strong>
              </div>
              <div />
              <div />
            </div>
          )}
        </div>
        <div className="table-footer">
          <div className="meta-label">
            Page {page} · Showing {users.length} record{users.length === 1 ? "" : "s"}
          </div>
          <div className="row-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
              data-testid="users-prev-page"
            >
              Previous
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasNextPage || loading}
              data-testid="users-next-page"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <ActionModal
        open={modalMode !== null}
        title={modalTitle}
        subtitle={modalSubtitle}
        onClose={closeModal}
        testId="user-action-modal"
      >
        <form onSubmit={handleUserSubmit} data-testid="user-form">
          <div>
            <label>Name</label>
            <input
              data-testid="user-name"
              value={userForm.name}
              onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
              required
            />
          </div>
          <div className="form-grid-2">
            <div>
              <label>Email</label>
              <input
                data-testid="user-email"
                value={userForm.email}
                onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
              />
            </div>
            <div>
              <label>Phone</label>
              <input
                data-testid="user-phone"
                value={userForm.phone}
                onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })}
              />
            </div>
          </div>
          <div>
            <label>Role</label>
            <select
              data-testid="user-role"
              value={userForm.role}
              onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
            >
              <option value="member">Member</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" data-testid="user-submit">
              {modalMode === "edit" ? "Save Changes" : "Add User"}
            </button>
          </div>
        </form>
      </ActionModal>
    </div>
  );
}
