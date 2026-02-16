import { clearAuth, getStoredToken } from "./auth";

type RequestOptions = RequestInit & {
  auth?: boolean;
};

type ValidationErrorItem = {
  loc?: Array<string | number>;
  msg?: string;
};

function getApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

export function formatApiErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail) || detail.length === 0) return undefined;
  const items = detail as ValidationErrorItem[];
  const messages = items
    .slice(0, 3)
    .map((item) => {
      const field = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1] ?? "") : "";
      const msg = item.msg?.trim() || "Invalid value";
      if (!field || field === "body") return msg;
      return `${field}: ${msg}`;
    })
    .filter(Boolean);
  if (!messages.length) return undefined;
  const suffix = items.length > 3 ? " (and more)" : "";
  return messages.join(" | ") + suffix;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth !== false;
  const token = auth ? getStoredToken() : null;
  const apiBase = getApiBase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      headers,
      ...options
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${apiBase}. Start backend on port 8000 and allow this frontend origin in CORS.`
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const detail = formatApiErrorDetail(body.detail);
    throw new Error(detail || `Request failed (${res.status}) on ${path}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

async function requestAllPages<T>(
  path: string,
  params?: URLSearchParams,
  options?: RequestOptions & { pageSize?: number; maxItems?: number }
): Promise<T[]> {
  const pageSize = options?.pageSize ?? 200;
  const maxItems = options?.maxItems;
  const requestOptions: RequestOptions = {
    ...options,
  };
  delete (requestOptions as { pageSize?: number }).pageSize;
  delete (requestOptions as { maxItems?: number }).maxItems;
  const items: T[] = [];
  let skip = 0;

  while (true) {
    const query = new URLSearchParams(params);
    const remaining = typeof maxItems === "number" ? maxItems - items.length : undefined;
    if (typeof remaining === "number" && remaining <= 0) break;
    const limit = typeof remaining === "number" ? Math.min(pageSize, remaining) : pageSize;

    query.set("skip", String(skip));
    query.set("limit", String(limit));

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const chunk = await request<T[]>(`${path}${suffix}`, requestOptions);
    items.push(...chunk);

    if (chunk.length < limit) break;
    skip += chunk.length;
  }

  return items;
}

function appendQueryValue(query: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined) return;
  const normalized = String(value).trim();
  if (!normalized) return;
  query.append(key, normalized);
}

function appendQueryValues(
  query: URLSearchParams,
  key: string,
  value: Array<string | number> | string | number | undefined
) {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) appendQueryValue(query, key, item);
    return;
  }
  appendQueryValue(query, key, value);
}

async function upload<T>(path: string, file: File): Promise<T> {
  const token = getStoredToken();
  const apiBase = getApiBase();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers,
      body: form,
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${apiBase}. Start backend on port 8000 and allow this frontend origin in CORS.`
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = formatApiErrorDetail(body.detail);
    throw new Error(detail || `Upload failed (${res.status}) on ${path}`);
  }
  return res.json();
}

export type LibraryPolicy = {
  id: number;
  enforce_limits: boolean;
  max_active_loans_per_user: number;
  max_loan_days: number;
  fine_per_day: number;
  updated_at: string;
};

export type AuditLog = {
  id: number;
  actor_user_id: number | null;
  actor_role: string | null;
  method: string;
  path: string;
  entity: string | null;
  entity_id: number | null;
  change_diff: Record<string, unknown> | null;
  status_code: number;
  duration_ms: number;
  created_at: string;
};

export type MemberLoan = {
  id: number;
  book_id: number;
  user_id: number;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  is_overdue: boolean;
  overdue_days: number;
  estimated_fine: number;
  book_title: string;
  book_author: string;
  book_isbn: string | null;
  fine_paid: number;
  fine_due: number;
  is_fine_settled: boolean;
};

export type LoanItem = {
  id: number;
  book_id: number;
  user_id: number;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  is_overdue: boolean;
  overdue_days: number;
  estimated_fine: number;
  fine_paid: number;
  fine_due: number;
  is_fine_settled: boolean;
};

export type FinePayment = {
  id: number;
  loan_id: number;
  user_id: number;
  amount: number;
  payment_mode: string;
  reference: string | null;
  notes: string | null;
  collected_at: string;
  created_at: string;
};

export type FinePaymentLedgerItem = FinePayment & {
  book_id: number;
  book_title: string;
  book_author: string;
  book_isbn: string | null;
  user_name: string;
  user_email: string | null;
  user_phone: string | null;
};

export type FineSummary = {
  loan_id: number;
  estimated_fine: number;
  fine_paid: number;
  fine_due: number;
  payment_count: number;
  is_settled: boolean;
};

type PageQuery = {
  skip?: number;
  limit?: number;
};

export async function queryBooks(params?: PageQuery & {
  q?: string;
  author?: string[];
  subject?: string[];
  availability?: string[];
  published_year?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  appendQueryValue(query, "q", params?.q);
  appendQueryValues(query, "author", params?.author);
  appendQueryValues(query, "subject", params?.subject);
  appendQueryValues(query, "availability", params?.availability);
  appendQueryValue(query, "published_year", params?.published_year);
  appendQueryValue(query, "sort_by", params?.sort_by);
  appendQueryValue(query, "sort_order", params?.sort_order);
  appendQueryValue(query, "skip", params?.skip);
  appendQueryValue(query, "limit", params?.limit);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<any[]>(`/books${suffix}`, { method: "GET" });
}

export async function getBooks(q?: string) {
  const query = new URLSearchParams();
  if (q?.trim()) query.set("q", q.trim());
  return requestAllPages<any>("/books", query, { method: "GET", pageSize: 200 });
}

export async function createBook(payload: any) {
  return request("/books", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateBook(bookId: number, payload: any) {
  return request(`/books/${bookId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteBook(bookId: number) {
  return request<void>(`/books/${bookId}`, {
    method: "DELETE"
  });
}

export async function getUsers(q?: string) {
  const query = new URLSearchParams();
  if (q?.trim()) query.set("q", q.trim());
  return requestAllPages<any>("/users", query, { method: "GET", pageSize: 200 });
}

export async function queryUsers(params?: PageQuery & {
  q?: string;
  role?: string[];
  sort_by?: string;
  sort_order?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  appendQueryValue(query, "q", params?.q);
  appendQueryValues(query, "role", params?.role);
  appendQueryValue(query, "sort_by", params?.sort_by);
  appendQueryValue(query, "sort_order", params?.sort_order);
  appendQueryValue(query, "skip", params?.skip);
  appendQueryValue(query, "limit", params?.limit);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<any[]>(`/users${suffix}`, { method: "GET" });
}

export async function createUser(payload: any) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateUser(userId: number, payload: any) {
  return request(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteUser(userId: number) {
  return request<void>(`/users/${userId}`, {
    method: "DELETE"
  });
}

export async function getLoans() {
  return requestAllPages<LoanItem>("/loans", undefined, { method: "GET", pageSize: 200 });
}

export async function queryLoans(params?: PageQuery & {
  q?: string;
  active?: boolean;
  overdue_only?: boolean;
  user_id?: number;
  book_id?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  appendQueryValue(query, "q", params?.q);
  if (typeof params?.active === "boolean") query.set("active", String(params.active));
  if (typeof params?.overdue_only === "boolean") query.set("overdue_only", String(params.overdue_only));
  appendQueryValue(query, "user_id", params?.user_id);
  appendQueryValue(query, "book_id", params?.book_id);
  appendQueryValue(query, "sort_by", params?.sort_by);
  appendQueryValue(query, "sort_order", params?.sort_order);
  appendQueryValue(query, "skip", params?.skip);
  appendQueryValue(query, "limit", params?.limit);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<LoanItem[]>(`/loans${suffix}`, { method: "GET" });
}

export async function borrowBook(payload: any) {
  return request("/loans/borrow", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function returnBook(loanId: number) {
  return request(`/loans/${loanId}/return`, { method: "POST" });
}

export async function updateLoan(loanId: number, payload: { extend_days: number }) {
  return request(`/loans/${loanId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteLoan(loanId: number) {
  return request<void>(`/loans/${loanId}`, {
    method: "DELETE"
  });
}

export async function seedData() {
  return request<{ status: string; message?: string; counts?: Record<string, number> }>("/seed", {
    method: "POST"
  });
}

export async function importBooksFile(file: File) {
  return upload<{ entity: string; imported: number; skipped: number; errors: Array<any> }>(
    "/imports/books",
    file
  );
}

export async function importUsersFile(file: File) {
  return upload<{ entity: string; imported: number; skipped: number; errors: Array<any> }>(
    "/imports/users",
    file
  );
}

export async function importLoansFile(file: File) {
  return upload<{ entity: string; imported: number; skipped: number; errors: Array<any> }>(
    "/imports/loans",
    file
  );
}

export async function getPolicy() {
  return request<LibraryPolicy>("/settings/policy", { method: "GET" });
}

export async function updatePolicy(payload: {
  enforce_limits: boolean;
  max_active_loans_per_user: number;
  max_loan_days: number;
  fine_per_day: number;
}) {
  return request<LibraryPolicy>("/settings/policy", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getAuditLogs(params?: {
  q?: string;
  method?: string[];
  entity?: string[];
  status_code?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.q?.trim()) query.set("q", params.q.trim());
  appendQueryValues(query, "method", params?.method);
  appendQueryValues(query, "entity", params?.entity);
  if (typeof params?.status_code === "number") query.set("status_code", String(params.status_code));
  const maxItems = typeof params?.limit === "number" ? params.limit : undefined;
  return requestAllPages<AuditLog>("/audit/logs", query, {
    method: "GET",
    pageSize: 200,
    maxItems,
  });
}

export async function queryAuditLogs(params?: PageQuery & {
  q?: string;
  method?: string[];
  entity?: string[];
  status_code?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  appendQueryValue(query, "q", params?.q);
  appendQueryValues(query, "method", params?.method);
  appendQueryValues(query, "entity", params?.entity);
  appendQueryValue(query, "status_code", params?.status_code);
  appendQueryValue(query, "sort_by", params?.sort_by);
  appendQueryValue(query, "sort_order", params?.sort_order);
  appendQueryValue(query, "skip", params?.skip);
  appendQueryValue(query, "limit", params?.limit);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<AuditLog[]>(`/audit/logs${suffix}`, { method: "GET" });
}

export async function login(payload: { email: string; password: string }) {
  return request<{ access_token: string; user: any; expires_in: number; token_type: string }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    }
  );
}

export async function getMe() {
  return request<any>("/auth/me", { method: "GET" });
}

export async function getMyLoans() {
  return request<MemberLoan[]>("/users/me/loans", { method: "GET" });
}

export async function getMyFinePayments() {
  return request<FinePayment[]>("/users/me/fine-payments", { method: "GET" });
}

export async function getLoanFineSummary(loanId: number) {
  return request<FineSummary>(`/loans/${loanId}/fine-summary`, { method: "GET" });
}

export async function getLoanFinePayments(loanId: number) {
  return request<FinePayment[]>(`/loans/${loanId}/fine-payments`, { method: "GET" });
}

export async function createLoanFinePayment(
  loanId: number,
  payload: { amount: number; payment_mode: string; reference?: string | null; notes?: string | null }
) {
  return request<FinePayment>(`/loans/${loanId}/fine-payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function queryFinePayments(params?: PageQuery & {
  q?: string;
  payment_mode?: string[];
  user_id?: number;
  loan_id?: number;
  collected_from?: string;
  collected_to?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}) {
  const query = new URLSearchParams();
  appendQueryValue(query, "q", params?.q);
  appendQueryValues(query, "payment_mode", params?.payment_mode);
  appendQueryValue(query, "user_id", params?.user_id);
  appendQueryValue(query, "loan_id", params?.loan_id);
  appendQueryValue(query, "collected_from", params?.collected_from);
  appendQueryValue(query, "collected_to", params?.collected_to);
  appendQueryValue(query, "sort_by", params?.sort_by);
  appendQueryValue(query, "sort_order", params?.sort_order);
  appendQueryValue(query, "skip", params?.skip);
  appendQueryValue(query, "limit", params?.limit);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<FinePaymentLedgerItem[]>(`/fine-payments${suffix}`, { method: "GET" });
}

export async function bootstrapAdmin(payload: {
  name: string;
  email: string;
  role: string;
  password: string;
}) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: false,
  });
}
