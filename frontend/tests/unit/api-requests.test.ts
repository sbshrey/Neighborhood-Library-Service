import { beforeEach, describe, expect, test, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  clearAuth: vi.fn(),
  getStoredToken: vi.fn(() => null as string | null),
}));

vi.mock("../../lib/auth", () => ({
  clearAuth: authMocks.clearAuth,
  getStoredToken: authMocks.getStoredToken,
}));

import {
  bootstrapAdmin,
  borrowBook,
  createBook,
  createLoanFinePayment,
  createUser,
  deleteBook,
  deleteLoan,
  deleteUser,
  getAuditLogs,
  getBooks,
  getLoanFinePayments,
  getLoanFineSummary,
  getMe,
  getMyFinePayments,
  getMyLoans,
  importBooksFile,
  importLoansFile,
  importUsersFile,
  login,
  queryAuditLogs,
  queryBooks,
  queryFinePayments,
  queryLoans,
  queryUsers,
  returnBook,
  seedData,
  updateBook,
  updateLoan,
  updatePolicy,
  updateUser,
} from "../../lib/api";

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api request wrappers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMocks.clearAuth.mockReset();
    authMocks.getStoredToken.mockReset();
    authMocks.getStoredToken.mockReturnValue(null);

    (globalThis as any).window = {
      localStorage: new LocalStorageMock(),
      location: {
        protocol: "http:",
        hostname: "127.0.0.1",
        href: "http://127.0.0.1:3000",
      },
    };
  });

  test("query helpers build expected URLs", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, [])));
    vi.stubGlobal("fetch", fetchMock);

    await queryBooks({
      q: "ddd",
      author: ["Eric Evans"],
      subject: ["Software"],
      availability: ["available"],
      sort_by: "title",
      sort_order: "asc",
      skip: 20,
      limit: 10,
    });
    await queryUsers({ q: "nisha", role: ["staff", "admin"], skip: 0, limit: 20 });
    await queryLoans({ q: "loan", active: true, overdue_only: true, skip: 5, limit: 15 });
    await queryFinePayments({
      q: "upi",
      payment_mode: ["upi", "cash"],
      sort_by: "amount",
      sort_order: "desc",
      skip: 0,
      limit: 10,
    });
    await queryAuditLogs({
      q: "/books",
      method: ["POST"],
      entity: ["books"],
      status_code: 201,
      skip: 0,
      limit: 10,
    });

    const urls = fetchMock.mock.calls.map((entry) => String(entry[0]));
    expect(urls[0]).toContain("/books?");
    expect(urls[0]).toContain("q=ddd");
    expect(urls[0]).toContain("author=Eric+Evans");
    expect(urls[0]).toContain("subject=Software");
    expect(urls[1]).toContain("/users?");
    expect(urls[1]).toContain("role=staff");
    expect(urls[2]).toContain("/loans?");
    expect(urls[2]).toContain("overdue_only=true");
    expect(urls[3]).toContain("/fine-payments?");
    expect(urls[3]).toContain("payment_mode=upi");
    expect(urls[4]).toContain("/audit/logs?");
    expect(urls[4]).toContain("status_code=201");
  });

  test("common CRUD wrappers call API with proper methods", async () => {
    authMocks.getStoredToken.mockReturnValue("token-123");
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      const method = options?.method || "GET";
      if (method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes("/audit/logs")) return Promise.resolve(jsonResponse(200, []));
      return Promise.resolve(jsonResponse(200, { ok: true, path: url, method }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await createBook({ title: "A", author: "B", copies_total: 1 });
    await updateBook(1, { title: "Updated" });
    await deleteBook(1);

    await createUser({ name: "U", role: "member" });
    await updateUser(2, { name: "User 2" });
    await deleteUser(2);

    await borrowBook({ book_id: 1, user_id: 1, days: 7 });
    await returnBook(3);
    await updateLoan(3, { extend_days: 2 });
    await deleteLoan(3);

    await getLoanFineSummary(3);
    await getLoanFinePayments(3);
    await createLoanFinePayment(3, { amount: 10, payment_mode: "upi" });

    await seedData();
    await updatePolicy({
      enforce_limits: true,
      max_active_loans_per_user: 5,
      max_loan_days: 21,
      fine_per_day: 2,
    });
    await getAuditLogs({ q: "books", limit: 20 });

    const methods = fetchMock.mock.calls.map((entry) => entry[1]?.method || "GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("PATCH");
    expect(methods).toContain("DELETE");
    expect(methods).toContain("PUT");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer token-123",
    });
  });

  test("getBooks paginates across multiple chunks", async () => {
    const fetchMock = vi.fn((url: string) => {
      const parsed = new URL(url);
      const skip = Number(parsed.searchParams.get("skip") || "0");
      if (skip === 0) {
        return Promise.resolve(jsonResponse(200, Array.from({ length: 200 }, (_, i) => ({ id: i + 1 }))));
      }
      return Promise.resolve(jsonResponse(200, [{ id: 201 }, { id: 202 }]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = await getBooks();
    expect(rows).toHaveLength(202);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("auth=false endpoints do not attach bearer token", async () => {
    authMocks.getStoredToken.mockReturnValue("secret-token");
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
        access_token: "abc",
        token_type: "bearer",
        expires_in: 3600,
        user: { id: 1, name: "Admin", role: "admin" },
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await login({ email: "a@b.com", password: "pass" });
    await bootstrapAdmin({
      name: "Admin",
      email: "a@b.com",
      role: "admin",
      password: "pass",
    });

    const loginHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    const bootstrapHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(loginHeaders.Authorization).toBeUndefined();
    expect(bootstrapHeaders.Authorization).toBeUndefined();
  });

  test("401 clears auth and redirects to login", async () => {
    authMocks.getStoredToken.mockReturnValue("expired-token");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { detail: "Could not validate credentials" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getMe()).rejects.toThrow("Could not validate credentials");
    expect(authMocks.clearAuth).toHaveBeenCalledTimes(1);
    expect((window as any).location.href).toBe("/login");
  });

  test("upload endpoints propagate API errors", async () => {
    authMocks.getStoredToken.mockReturnValue("upload-token");
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(400, { detail: "Invalid file format" }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = new Blob(["title,author"], { type: "text/csv" }) as File;
    Object.defineProperty(file, "name", { value: "books.csv" });

    await expect(importBooksFile(file)).rejects.toThrow("Invalid file format");
    await expect(importUsersFile(file)).rejects.toThrow("Invalid file format");
    await expect(importLoansFile(file)).rejects.toThrow("Invalid file format");
  });

  test("member endpoints hit expected paths", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, [])));
    vi.stubGlobal("fetch", fetchMock);

    await getMyLoans();
    await getMyFinePayments();

    expect(String(fetchMock.mock.calls[0][0])).toContain("/users/me/loans");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/users/me/fine-payments");
  });
});
