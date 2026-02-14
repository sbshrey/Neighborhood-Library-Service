export default function SettingsPage() {
  return (
    <div className="page-layout">
      <header className="page-header">
        <div>
          <div className="badge">Settings</div>
          <h1>Library Configuration</h1>
          <p className="lede">Tune circulation policies, notifications, and API behavior.</p>
        </div>
      </header>

      <section className="page-grid">
        <div className="table-card">
          <div className="card-header">
            <h2>Circulation Defaults</h2>
            <span className="pill">Policies</span>
          </div>
          <div className="settings-grid">
            <div className="settings-item">
              <div>
                <strong>Default loan period</strong>
                <p>14 days</p>
              </div>
              <button className="ghost">Edit</button>
            </div>
            <div className="settings-item">
              <div>
                <strong>Overdue grace period</strong>
                <p>3 days</p>
              </div>
              <button className="ghost">Edit</button>
            </div>
            <div className="settings-item">
              <div>
                <strong>Notifications</strong>
                <p>Enabled (Email)</p>
              </div>
              <button className="ghost">Manage</button>
            </div>
            <div className="settings-item">
              <div>
                <strong>Hold queue</strong>
                <p>Auto-promote in 24 hours</p>
              </div>
              <button className="ghost">Adjust</button>
            </div>
          </div>
        </div>
        <aside className="panel-card">
          <div className="card-header">
            <h2>API Health</h2>
            <span className="pill">Status</span>
          </div>
          <div className="settings-grid">
            <div className="settings-item">
              <div>
                <strong>Environment</strong>
                <p>Local development</p>
              </div>
              <span className="status active">Healthy</span>
            </div>
            <div className="settings-item">
              <div>
                <strong>Seed Data</strong>
                <p>Enabled</p>
              </div>
              <span className="status active">Active</span>
            </div>
            <div className="settings-item">
              <div>
                <strong>Role sync</strong>
                <p>Synced 5 minutes ago</p>
              </div>
              <span className="status active">Healthy</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="panel-card">
        <div className="card-header">
          <h2>Security Controls</h2>
          <span className="pill">Protected</span>
        </div>
        <div className="settings-grid">
          <div className="settings-item">
            <div>
              <strong>Audit logging</strong>
              <p>Streaming to long-term storage</p>
            </div>
            <span className="status active">On</span>
          </div>
          <div className="settings-item">
            <div>
              <strong>Admin approvals</strong>
              <p>Required for role changes</p>
            </div>
            <span className="status active">On</span>
          </div>
        </div>
      </section>
    </div>
  );
}
