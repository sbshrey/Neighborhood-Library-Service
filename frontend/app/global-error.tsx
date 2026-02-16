"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="app-error-shell">
          <section className="app-error-card">
            <div className="badge">Critical Error</div>
            <h1>Application failed to load</h1>
            <p className="lede">
              A global rendering error occurred.
            </p>
            {error?.message ? <p className="notice">{error.message}</p> : null}
            <div className="row-actions">
              <button type="button" onClick={reset}>
                Retry
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
