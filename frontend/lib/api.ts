import { clearAuth, getStoredToken } from "./auth";

type RequestOptions = RequestInit & {
  auth?: boolean;
};

function getApiBase() {
  const configured = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
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
    const detail = typeof body.detail === "string" ? body.detail : undefined;
    throw new Error(detail || `Request failed (${res.status}) on ${path}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
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
    const detail = typeof body.detail === "string" ? body.detail : undefined;
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

export type FineSummary = {
  loan_id: number;
  estimated_fine: number;
  fine_paid: number;
  fine_due: number;
  payment_count: number;
  is_settled: boolean;
};

export async function getBooks(q?: string) {
  const suffix = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return request<any[]>(`/books${suffix}`);
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
  const suffix = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return request<any[]>(`/users${suffix}`);
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
  return request<LoanItem[]>("/loans", { method: "GET" });
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
  method?: string;
  entity?: string;
  status_code?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.q?.trim()) query.set("q", params.q.trim());
  if (params?.method?.trim()) query.set("method", params.method.trim());
  if (params?.entity?.trim()) query.set("entity", params.entity.trim());
  if (typeof params?.status_code === "number") query.set("status_code", String(params.status_code));
  if (typeof params?.limit === "number") query.set("limit", String(params.limit));
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
