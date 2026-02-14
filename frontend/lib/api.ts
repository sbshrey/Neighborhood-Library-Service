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

export async function getBooks() {
  return request<any[]>("/books");
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

export async function getUsers() {
  return request<any[]>("/users");
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
  return request<any[]>("/loans", { method: "GET" });
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
