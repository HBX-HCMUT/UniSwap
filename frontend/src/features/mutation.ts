'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiError, conflictMessage, connectionError } from '../lib/api';
import { href } from '../lib/query';

export function useMutation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const router = useRouter();
  const pathname = usePathname();
  async function run(task: () => Promise<void>, refreshOnConflict = false) {
    setPending(true);
    setError('');
    setFields({});
    try { await task(); }
    catch (failure) {
      if (failure instanceof ApiError) {
        setFields(failure.fields);
        if (failure.status === 409 && refreshOnConflict) {
          setError(conflictMessage);
          router.refresh();
        } else {
          setError(failure.message);
          if (failure.status === 401 && pathname !== '/login') router.push(href('/login', { returnTo: pathname }));
        }
      } else setError(connectionError);
    } finally { setPending(false); }
  }
  return { pending, error, fields, run, setError, router };
}
