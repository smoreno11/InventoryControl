/** Shared fetch wrapper.

All paths are relative so Vite's dev proxy and a production deployment behind
the same origin both work. Nothing here should hardcode a host. */

/** A non-2xx response. `detail` is the message the backend sent, when it sent one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Pull FastAPI's `detail` out of an error response, falling back to a generic message. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // Body was not JSON — fall through to the status text.
  }
  return res.statusText || `Request failed (${res.status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new ApiError(await errorMessage(res), res.status);
  }
  return (await res.json()) as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

function withJsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, withJsonBody("POST", body));
}

export function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, withJsonBody("PUT", body));
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, withJsonBody("PATCH", body));
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

/** POST multipart form data (used for file uploads). */
export function postForm<T>(path: string, form: FormData): Promise<T> {
  // No Content-Type header: the browser must set it with the multipart boundary.
  return request<T>(path, { method: "POST", body: form });
}
