export default function RolesPage() {
  const roleStats = [
    { label: "Members", value: "128" },
    { label: "Staff", value: "12" },
    { label: "Admins", value: "4" }
  ];

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Roles</div>
          <h1>Access Profiles</h1>
          <p className="lede">
            Define responsibilities and access levels for community members and staff.
          </p>
        </div>
      </header>

      <section className="stat-grid">
        {roleStats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </section>

      <section className="table-card">
        <div className="card-header">
          <h2>Role Matrix</h2>
          <span className="pill">Policy</span>
        </div>
        <div className="table">
          {[
            {
              role: "Member",
              scope: "Borrow books, view own loans, request holds",
              level: "Standard"
            },
            {
              role: "Staff",
              scope: "Manage catalog, assist members, process returns",
              level: "Operational"
            },
            {
              role: "Admin",
              scope: "Manage roles, review audits, configure settings",
              level: "Full Access"
            }
          ].map((item) => (
            <div key={item.role} className="row">
              <div>
                <strong>{item.role}</strong>
                <div>
                  <span>{item.scope}</span>
                </div>
              </div>
              <div>
                <div className="meta-label">Access Level</div>
                <div className="meta-value">{item.level}</div>
              </div>
              <div>
                <div className="meta-label">Status</div>
                <span className="status active">Active</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <div className="card-header">
          <h2>Governance Notes</h2>
          <span className="pill">Review</span>
        </div>
        <div className="activity">
          <div className="activity-item">
            <div>
              <strong>Quarterly access review scheduled</strong>
              <div>
                <span>Next audit window opens in 6 days.</span>
              </div>
            </div>
            <span className="activity-time">Scheduled</span>
          </div>
          <div className="activity-item">
            <div>
              <strong>Role change approvals</strong>
              <div>
                <span>Admin actions now require second approver.</span>
              </div>
            </div>
            <span className="activity-time">Policy update</span>
          </div>
        </div>
      </section>
    </div>
  );
}
