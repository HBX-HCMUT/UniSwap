import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, apiPrefix, connectionError, decode } from './api';
import { href } from './query';
import type { Me } from './model';

const sessionName = 'uniswap_session';

export const serverGet = cache(async function serverGet<T>(path: string): Promise<T> {
  const session = (await cookies()).get(sessionName);
  const origin = process.env.API_ORIGIN ?? 'http://127.0.0.1:3001';
  const response = await fetch(origin + apiPrefix + path, {
    cache: 'no-store',
    headers: session ? { Cookie: `${sessionName}=${encodeURIComponent(session.value)}` } : undefined,
    signal: AbortSignal.timeout(10000),
  }).catch(() => { throw new ApiError(503, connectionError); });
  return decode<T>(response);
});

export const sessionUser = cache(async function sessionUser() {
  if (!(await cookies()).has(sessionName)) return null;
  try {
    return await serverGet<Me>('/me');
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 503].includes(error.status)) return null;
    throw error;
  }
});

export async function requireUser(path: string) {
  const user = await sessionUser();
  if (!user) redirect(href('/login', { returnTo: path }));
  return user;
}

export async function optionalGet<T>(path: string): Promise<T | undefined> {
  try { return await serverGet<T>(path); }
  catch (error) { if (error instanceof ApiError && error.status === 404) return; throw error; }
}
