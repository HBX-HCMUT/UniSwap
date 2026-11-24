import { Badge, Empty, Field, PageHeader, Pagination } from '../../../components/ui';
import { AdminDecision } from '../../../features/admin';
import type { AdminUser, Page } from '../../../lib/model';
import { getParam, href, type SearchParams } from '../../../lib/query';
import { requireUser, serverGet } from '../../../lib/server';

export const metadata = { title: 'Tài khoản' };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = { q: getParam(params, 'q'), page: getParam(params, 'page') };
  if ((await requireUser(href('/admin/users', query))).role !== 'ADMIN') return null;
  const data = await serverGet<Page<AdminUser>>(href('/admin/users', query));
  return <section className="stack">
    <div><PageHeader title="Tài khoản" /></div>
    <form action="/admin/users" className="panel filter-row">
      <Field name="q" label="Tên hoặc email"><input name="q" id="q" type="search" defaultValue={query.q} /></Field>
      <button type="submit" className="secondary">Tìm tài khoản</button>
    </form>
    {data.items.length ? <div className="record-list">{data.items.map((user) => <article key={user.id} className="panel record">
      <div className="record-top"><h2>{user.displayName}</h2><Badge tone={user.status === 'LOCKED' ? 'red' : 'green'}>{user.status === 'LOCKED' ? 'Đã khóa' : 'Hoạt động'}</Badge></div>
      <p>{user.email} · {user.role === 'ADMIN' ? 'Quản trị viên' : 'Sinh viên'}</p>
      {user.role === 'STUDENT' && <AdminDecision endpoint={`/admin/users/${user.id}`} decisions={user.status === 'ACTIVE'
        ? [{ label: 'Khóa tài khoản', body: { status: 'LOCKED' }, danger: true }]
        : [{ label: 'Mở khóa tài khoản', body: { status: 'ACTIVE' } }]} />}
    </article>)}</div> : <Empty title="Không tìm thấy tài khoản" />}
    <Pagination to="/admin/users" data={data} params={query} />
  </section>;
}
