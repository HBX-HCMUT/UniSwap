'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Notice, Field } from '../components/ui';
import { request } from '../lib/api';
import { moment } from '../lib/format';
import type { Message, Notification, Page, Reservation } from '../lib/model';
import { formData, href, value } from '../lib/query';
import { useMutation } from './mutation';

function mergeMessages(left: Message[], right: Message[]) {
  const unique = new Map([...left, ...right].map((item) => [item.id, item]));
  return [...unique.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function Chat({ id, viewerId, partner, initial }: { id: string; viewerId: string; partner: string; initial: Page<Message> }) {
  const [messages, setMessages] = useState(() => mergeMessages([], initial.items));
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [pollError, setPollError] = useState('');
  const { pending, error, run } = useMutation();
  const endpoint = `/conversations/${id}/messages`;
  const pageSize = String(initial.pageSize);

  useEffect(() => {
    const controller = new AbortController();
    async function poll() {
      if (document.hidden) return;
      try {
        const [latest, unread] = await Promise.all([
          request<Page<Message>>(href(endpoint, { pageSize }), 'GET', undefined, controller.signal),
          request<Page<Notification>>('/notifications?unread=true&pageSize=100', 'GET', undefined, controller.signal),
        ]);
        setMessages((previous) => mergeMessages(previous, latest.items));
        setTotal(latest.total);
        setPollError('');
        const matching = unread.items.filter((notification) => notification.kind === 'MESSAGE' && notification.resourceId === id);
        if (matching.length) {
          await Promise.all(matching.map(({ id }) => request(`/notifications/${id}/read`, 'PUT', undefined, controller.signal)));
          window.dispatchEvent(new Event('uniswap:notification-read'));
        }
      } catch {
        if (!controller.signal.aborted) setPollError('Chưa thể cập nhật tin nhắn. UniSwap sẽ thử lại.');
      }
    }
    void poll();
    const interval = setInterval(poll, 5000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [endpoint, pageSize, id]);

  function loadOlder() {
    const next = page + 1;
    void run(async () => {
      const older = await request<Page<Message>>(href(endpoint, { pageSize, page: String(next) }));
      setMessages((previous) => mergeMessages(previous, older.items));
      setPage(next);
      setTotal(older.total);
    });
  }
  function send(event: FormEvent<HTMLFormElement>) {
    const data = formData(event);
    const text = value(data, 'message');
    if (!text) return;
    void run(async () => {
      const message = await request<Message>(endpoint, 'POST', { text });
      setMessages((previous) => mergeMessages(previous, [message]));
      setTotal((previous) => Math.max(previous, messages.length + 1));
      setDraft('');
    });
  }
  return <section className="panel stack">
    {messages.length < total && <div><button type="button" className="button secondary" onClick={loadOlder} disabled={pending}>Xem tin nhắn cũ</button></div>}
    <Notice text={pollError} error />
    {!messages.length ? <p className="muted">Chưa có tin nhắn trong hội thoại.</p> : <ol className="chat-history" aria-label="Tin nhắn" aria-live="polite">{messages.map((message) => {
      const own = message.senderId === viewerId;
      return <li key={message.id} className={own ? 'own' : undefined}>
        <strong>{own ? 'Bạn' : partner}</strong><p className="description">{message.text}</p><time dateTime={message.createdAt}>{moment(message.createdAt)}</time>
      </li>;
    })}</ol>}
    <form className="stack compact" onSubmit={send}>
      <Field name="message" label="Tin nhắn"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} id="message" name="message" maxLength={2000} required placeholder="Viết lời nhắn…" /></Field>
      <Notice error text={error} />
      <div><button type="submit" disabled={pending || !draft.trim()}>{pending ? 'Đang xử lý…' : 'Gửi tin nhắn'}</button></div>
    </form>
  </section>;
}

export function ConversationTrade({ id }: { id: string }) {
  const { pending, error, run, router } = useMutation();
  const [empty, setEmpty] = useState(false);
  function open() {
    void run(async () => {
      const data = await request<Page<Reservation>>(href('/reservations', { conversationId: id }));
      const accepted = data.items.find(({ state }) => state === 'ACCEPTED');
      const pending = data.items.find(({ state }) => state === 'PENDING');
      const openReservation = accepted ?? pending;
      if (openReservation) router.push(`/reservations/${openReservation.id}`);
      else if (data.total > 0) {
        // Check actionable records even if a long history puts them on a later page.
        const [current, waiting] = await Promise.all([
          request<Page<Reservation>>(href('/reservations', { conversationId: id, state: 'ACCEPTED' })),
          request<Page<Reservation>>(href('/reservations', { conversationId: id, state: 'PENDING' })),
        ]);
        const result = current.items[0] ?? waiting.items[0];
        router.push(result ? `/reservations/${result.id}` : href('/me/reservations', { conversationId: id }));
      } else setEmpty(true);
    });
  }
  return <div className="stack compact"><button className="button secondary" type="button" disabled={pending} onClick={open}>Mở giao dịch</button>
    {empty && <Notice text="Chưa có yêu cầu giữ." />}<Notice error text={error} />
  </div>;
}
