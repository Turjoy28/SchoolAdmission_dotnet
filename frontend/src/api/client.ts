export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
const GENERIC_ERROR = 'Something went wrong on our side. Please try again.';

export async function api<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    studentId?: string;
  } = {}
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.studentId ? { 'X-Student-Id': opts.studentId } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Cannot reach the server. Please check your connection and try again.',
      0
    );
  }

  // 204 No Content has no body
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg =
      res.status >= 500
        ? GENERIC_ERROR
        : (data?.message ?? data?.title ?? GENERIC_ERROR);

    throw new ApiError(errorMsg, res.status);
  }

  return data as T;
}
