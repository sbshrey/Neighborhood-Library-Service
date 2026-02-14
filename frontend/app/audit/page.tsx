"use client";

import { useEffect, useMemo, useState } from "react";

import SearchableSelect from "../../components/SearchableSelect";
import { useToast } from "../../components/ToastProvider";
import { getAuditLogs } from "../../lib/api";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function AuditPage() {
  const { showToast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [entity, setEntity] = useState("all");
  const [loading, setLoading] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 300 };
      if (search.trim()) params.q = search.trim();
      if (method !== "all") params.method = method;
      if (entity !== "all") params.entity = entity;
      const logs = await getAuditLogs(params);
      setEvents(logs);
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
  }, []);

  const methodOptions = [
    { value: "all", label: "All methods" },
    { value: "POST", label: "POST" },
    { value: "PATCH", label: "PATCH" },
    { value: "PUT", label: "PUT" },
    { value: "DELETE", label: "DELETE" },
  ];

  const entityOptions = useMemo(() => {
    const dynamicEntities = Array.from(new Set(events.map((event) => event.entity).filter(Boolean)));
    return [
      { value: "all", label: "All entities" },
      ...dynamicEntities.map((value) => ({ value, label: String(value) })),
    ];
  }, [events]);

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Audit</div>
          <h1>Audit Timeline</h1>
          <p className="lede">Database-backed request audit log for all mutating API operations.</p>
        </div>
        <button className="secondary" onClick={loadEvents}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <section className="table-card">
        <div className="card-header">
          <h2>Audit Logs</h2>
          <span className="pill">Persisted in DB</span>
        </div>
        <div className="filter-bar">
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
              placeholder="Method filter"
              onChange={setMethod}
            />
          </div>
          <div className="filter-field">
            <SearchableSelect
              label="Entity"
              value={entity}
              options={entityOptions}
              placeholder="Entity filter"
              onChange={setEntity}
            />
          </div>
          <div className="filter-field">
            <label>&nbsp;</label>
            <button onClick={loadEvents} className="ghost">
              Apply Filters
            </button>
          </div>
        </div>
        <div className="table">
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
                <strong>No audit logs found.</strong>
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
