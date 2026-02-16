import "./globals.css";
import AppShell from "../components/AppShell";
import AppErrorBoundary from "../components/AppErrorBoundary";

export const metadata = {
  title: "Neighborhood Library Service",
  description: "Manage books, users, and loans"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppErrorBoundary>
          <AppShell>{children}</AppShell>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
