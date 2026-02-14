import "./globals.css";
import AppShell from "../components/AppShell";

export const metadata = {
  title: "Neighborhood Library Service",
  description: "Manage books, users, and loans"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
