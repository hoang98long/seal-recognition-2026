import { serviceErrorMessage } from './comparisonPresentation';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const csrf = () =>
  decodeURIComponent(
    document.cookie
      .split('; ')
      .find((x) => x.startsWith('seal_csrf='))
      ?.split('=')
      .slice(1)
      .join('=') || '',
  );
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (init.method && init.method !== 'GET') headers.set('X-CSRF-Token', csrf());
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...init, credentials: 'include', headers });
  } catch {
    throw new ApiError(
      0,
      'network',
      'Không kết nối được backend. Kiểm tra terminal uvicorn và cấu hình proxy frontend.',
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      data?.error?.code || 'http_error',
      serviceErrorMessage(data?.error?.code) ||
        data?.error?.message ||
        `Yêu cầu thất bại (${response.status}).`,
    );
  }
  return response;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await request(path, init)).json();
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const previewUrl = (id: string, page = 1, thumb = false) =>
  `/api/v1/assets/${id}/preview?page=${page}${thumb ? '&thumb=true' : ''}`;
export async function upload(file: File, kind = 'document') {
  const body = new FormData();
  body.append('file', file);
  return api<import('../types').Asset>(`/assets/upload?kind=${kind}`, { method: 'POST', body });
}
