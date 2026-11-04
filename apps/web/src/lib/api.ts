const API_PREFIX = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly traceId?: string;

  constructor(message: string, status: number, traceId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.traceId = traceId;
  }
}

function normalizePath(path: string): string {
  if (path.startsWith(API_PREFIX)) return path;
  return `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

function messageFrom(text: string, fallback: string): string {
  try {
    const body = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join("；");
    if (typeof body.message === "string") return body.message;
  } catch {
    // 错误体不是 JSON，退回状态文案
  }
  return fallback;
}

/** 全站唯一请求出口：补前缀、归一错误、带上 traceId。 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(normalizePath(path), { ...options, headers });
  } catch {
    throw new ApiError("后端服务不可达，请确认 admin 已启动", 0);
  }

  const traceId = response.headers.get("x-trace-id") ?? undefined;
  const text = await response.text();

  if (!response.ok) {
    // 5xx 且 body 不是后端的 JSON 错误体 = 代理连不上后端，说成人话
    const fallback =
      response.status >= 500 ? "后端服务不可达，请确认 admin 已启动" : response.statusText;
    throw new ApiError(messageFrom(text, fallback), response.status, traceId);
  }
  // 204 或空 body 一律视为 undefined，避免 json() 对空体抛错
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}
