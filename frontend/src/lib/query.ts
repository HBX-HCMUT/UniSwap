import type { FormEvent } from 'react';

export type SearchParams = Record<string, string | string[] | undefined>;

export function getParam(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export function href(path: string, params: SearchParams) {
  const query = new URLSearchParams();
  for (const key of Object.keys(params)) {
    const value = getParam(params, key);
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function internalPath(candidate: string, fallback = '/') {
  if (!candidate.startsWith('/') || candidate.includes('\\') || [...candidate].some((character) => character.charCodeAt(0) < 32)) return fallback;
  const resolved = new URL(candidate, 'https://uniswap.invalid');
  return resolved.origin === 'https://uniswap.invalid' ? resolved.pathname + resolved.search + resolved.hash : fallback;
}

export function formData(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}

export function value(data: FormData, key: string) {
  return String(data.get(key) ?? '').trim();
}
