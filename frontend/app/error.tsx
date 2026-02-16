"use client";

import { useEffect } from "react";

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary", error);
  }, [error]);

  return (
    <main className="app-error-shell">
      <section className="app-error-card">
        <div className="badge">Error</div>
        <h1>Unable to render this page</h1>
        <p className="lede">
          An unexpected issue occurred while loading this route.
        </p>
        {error?.message ? <p className="notice">{error.message}</p> : null}
        <div className="row-actions">
          <button type="button" onClick={reset}>
            Try Again
          </button>
        </div>
      </section>
    </main>
  );
}
