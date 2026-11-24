'use client';

import { useState } from 'react';
import { Notice } from '../components/ui';
import { request } from '../lib/api';
import { useMutation } from './mutation';

export function Toggle({ endpoint, active, add, remove }: { endpoint: string; active: boolean; add: string; remove: string }) {
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const current = confirmed ?? active;
  const { pending, error, run, router } = useMutation();
  return <div className="stack compact">
    <button type="button" className={current ? 'button secondary' : 'button'} aria-pressed={current} disabled={pending} onClick={() => void run(async () => {
      await request(endpoint, current ? 'DELETE' : 'PUT');
      setConfirmed(!current);
      router.refresh();
    })}>{current ? remove : add}</button>
    <Notice text={error} error />
  </div>;
}
