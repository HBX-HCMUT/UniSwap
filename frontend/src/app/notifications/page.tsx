import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Empty, PageHeader, Pagination } from '../../components/ui';
import { NotificationRow } from '../../features/notifications';
import type { Notification, Page } from '../../lib/model';
import { getParam, href, type SearchParams } from '../../lib/query';
import { requireUser, serverGet } from '../../lib/server';

export const metadata = { title: 'Thông báo', robots: { index: false, follow: false } };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const unread = getParam(params, 'unread') === 'true' ? 'true' : '';
  const query = { page: getParam(params, 'page'), unread };
  const viewer = await requireUser(href('/notifications', query));
  if (viewer.role !== 'STUDENT') notFound();
  const data = await serverGet<Page<Notification>>(href('/notifications', query));
  return <>
    <PageHeader title="Thông báo">
      <nav className="row" aria-label="Lọc thông báo">
        <Link className={unread ? 'button secondary' : 'button'} aria-current={unread ? undefined : 'page'} href="/notifications">Tất cả</Link>
        <Link className={unread ? 'button' : 'button secondary'} aria-current={unread ? 'page' : undefined} href="/notifications?unread=true">Chưa đọc</Link>
      </nav>
    </PageHeader>
    {data.items.length ? <section className="record-list" aria-label="Danh sách thông báo">
      {data.items.map((notification) => <NotificationRow key={notification.id} notification={notification} />)}
    </section> : <Empty title={unread ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'} />}
    <Pagination data={data} to="/notifications" params={query} />
  </>;
}
