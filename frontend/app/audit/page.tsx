"use client";

import { useEffect, useMemo, useState } from "react";

import ListViewCard, { ListGrid } from "../../components/ListViewCard";
import SearchableSelect from "../../components/SearchableSelect";
import { useToast } from "../../components/ToastProvider";
import { queryAuditLogs } from "../../lib/api";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function AuditPage() {
  const { showToast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<string[]>([]);
  const [entity, setEntity] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("time_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);

  const sortConfigMap: Record<string, { sort_by: string; sort_order: "asc" | "desc" }> = {
    time_desc: { sort_by: "created_at", sort_order: "desc" },
    time_asc: { sort_by: "created_at", sort_order: "asc" },
    status_desc: { sort_by: "status_code", sort_order: "desc" },
    status_asc: { sort_by: "status_code", sort_order: "asc" },
    duration_desc: { sort_by: "duration_ms", sort_order: "desc" },
    duration_asc: { sort_by: "duration_ms", sort_order: "asc" },
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const sortConfig = sortConfigMap[sortBy] || sortConfigMap.time_desc;
      const logs = await queryAuditLogs({
        q: search.trim() || undefined,
        method,
        entity,
        sort_by: sortConfig.sort_by,
        sort_order: sortConfig.sort_order,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      });
      setEvents(logs);
      setHasNextPage(logs.length === pageSize);
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Unable to load audit logs",
        description: err.message || "Request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [page, pageSize, search, method, entity, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, method, entity, sortBy, pageSize]);

  const methodOptions = [
    { value: "POST", label: "POST" },
    { value: "PATCH", label: "PATCH" },
    { value: "PUT", label: "PUT" },
    { value: "DELETE", label: "DELETE" },
  ];

  const entityOptions = useMemo(() => {
    const dynamicEntities = Array.from(new Set(events.map((event) => event.entity).filter(Boolean)));
    return dynamicEntities.map((value) => ({ value, label: String(value) }));
  }, [events]);

  const sortOptions = [
    { value: "time_desc", label: "Latest first" },
    { value: "time_asc", label: "Oldest first" },
    { value: "status_desc", label: "Status high-low" },
    { value: "status_asc", label: "Status low-high" },
    { value: "duration_desc", label: "Duration high-low" },
    { value: "duration_asc", label: "Duration low-high" },
  ];

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Audit</div>
          <h1>Audit Timeline</h1>
          <p className="lede">Database-backed request audit log for all mutating API operations.</p>
        </div>
        <button className="secondary" onClick={loadEvents} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <ListViewCard
        title="Audit Logs"
        headerRight={<span className="pill">Persisted in DB</span>}
        filters={(
          <>
            <div className="filter-field grow">
              <label>Search</label>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Path, method, role, status, actor, entity id"
              />
            </div>
            <div className="filter-field">
              <SearchableSelect
                label="Method"
                value={method}
                options={methodOptions}
                placeholder="Any method"
                onChange={setMethod}
                multiple
              />
            </div>
            <div className="filter-field">
              <SearchableSelect
                label="Entity"
                value={entity}
                options={entityOptions}
                placeholder="Any entity"
                onChange={setEntity}
                multiple
              />
            </div>
            <div className="filter-field">
              <SearchableSelect
                label="Sort"
                value={sortBy}
                options={sortOptions}
                placeholder="Sort logs"
                onChange={setSortBy}
                testId="audit-sort"
              />
            </div>
            <div className="filter-field">
              <label>Page Size</label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                data-testid="audit-page-size"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </>
        )}
        footer={(
          <div className="table-footer">
            <div className="meta-label">
              Page {page} · Showing {events.length} record{events.length === 1 ? "" : "s"}
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="ghost small"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || loading}
                data-testid="audit-prev-page"
              >
                Previous
              </button>
              <button
                type="button"
                className="ghost small"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasNextPage || loading}
                data-testid="audit-next-page"
              >
                Next
              </button>
            </div>
          </div>
        )}
      >
        <ListGrid>
          {events.map((event) => (
            <div key={event.id} className="row">
              <div>
                <strong>{event.method} {event.path}</strong>
                <div>
                  <span>
                    actor {event.actor_user_id ?? "-"} ({event.actor_role || "-"}) · entity {event.entity || "-"}:{event.entity_id ?? "-"}
                  </span>
                </div>
              </div>
              <div>
                <div className="meta-label">Status</div>
                <div className="meta-value">{event.status_code}</div>
                <div className="meta-label">Duration</div>
                <div className="meta-value">{event.duration_ms.toFixed(2)} ms</div>
              </div>
              <div>
                <div className="meta-label">Timestamp</div>
                <div className="meta-value">{formatTime(event.created_at)}</div>
              </div>
            </div>
          ))}
          {events.length === 0 ? (
            <div className="row">
              <div>
                <strong>{loading ? "Loading audit logs..." : "No audit logs found."}</strong>
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
