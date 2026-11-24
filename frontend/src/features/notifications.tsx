'use client';

import Link from 'next/link';
import { Badge, Notice } from '../components/ui';
import { request } from '../lib/api';
import { moment } from '../lib/format';
import type { Notification } from '../lib/model';
import { useMutation } from './mutation';

const resourceRoute = {
  MESSAGE: '/inbox',
  RESERVATION: '/reservations',
  NEW_LISTING: '/listings',
  MODERATION: '/listings',
};

export function NotificationRow({ notification }: { notification: Notification }) {
  const { pending, error, run, router } = useMutation();
  const target = `${resourceRoute[notification.kind]}/${notification.resourceId}`;

  function mark(open: boolean) {
    void run(async () => {
      await request(`/notifications/${notification.id}/read`, 'PUT');
      window.dispatchEvent(new Event('uniswap:notification-read'));
      if (open) router.push(target);
      else router.refresh();
    });
  }

  return <article className="panel record">
    <div className="record-top">
      {notification.readAt ? <Link href={target}>{notification.text}</Link> :
        <button type="button" className="notification-link" disabled={pending} onClick={() => mark(true)}>{notification.text}</button>}
      <Badge tone={notification.readAt ? 'neutral' : 'amber'}>{notification.readAt ? 'Đã đọc' : 'Chưa đọc'}</Badge>
    </div>
    <div className="record-top">
      <time className="muted" dateTime={notification.createdAt}>{moment(notification.createdAt)}</time>
      {!notification.readAt && <button type="button" className="secondary" disabled={pending} onClick={() => mark(false)}>Đánh dấu đã đọc</button>}
    </div>
    <Notice text={error} error />
  </article>;
}
