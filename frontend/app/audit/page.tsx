export default function AuditPage() {
  const events = [
    { action: "Book returned", detail: "Loan #12 marked returned", time: "2 min ago" },
    { action: "User added", detail: "Jordan Lee added as member", time: "18 min ago" },
    { action: "Catalog updated", detail: "Copies updated for Clean Code", time: "1 hour ago" },
    { action: "Loan issued", detail: "Loan #11 created", time: "3 hours ago" },
    { action: "Role changed", detail: "Casey Morgan promoted to admin", time: "Yesterday" }
  ];

  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Audit</div>
          <h1>Operational Timeline</h1>
          <p className="lede">Review system activity and critical circulation events.</p>
        </div>
      </header>

      <section className="table-card">
        <div className="card-header">
          <h2>Activity Feed</h2>
          <div className="tag-grid">
            {["All", "Loans", "Catalog", "Users", "Settings"].map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="activity">
          {events.map((event) => (
            <div key={event.detail} className="activity-item">
              <div>
                <strong>{event.action}</strong>
                <div>
                  <span>{event.detail}</span>
                </div>
              </div>
              <span className="activity-time">{event.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
