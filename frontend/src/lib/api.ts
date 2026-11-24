export const apiPrefix = '/api/v1';
export const connectionError = 'Không thể kết nối đến UniSwap. Vui lòng thử lại.';
export const conflictMessage = 'Trạng thái vừa thay đổi. Thông tin đã được tải lại.';

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

export async function decode<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => undefined);
    throw new ApiError(response.status, error?.message ?? connectionError, error?.fields);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export async function request<T>(path: string, method = 'GET', body?: object | FormData, signal?: AbortSignal): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(apiPrefix + path, {
    method, cache: 'no-store', credentials: 'same-origin', signal,
    headers: body && !multipart ? { 'Content-Type': 'application/json' } : undefined,
    body: multipart ? body : body ? JSON.stringify(body) : undefined,
  }).catch((error: unknown) => {
    if (signal?.aborted) throw error;
    throw new ApiError(503, connectionError);
  });
  return decode<T>(response);
}

export function assetPath(asset: { id: string }) {
  return `${apiPrefix}/assets/${encodeURIComponent(asset.id)}`;
}
