import { Field, Notice, PageHeader } from '../../components/ui';
import { vietnamDate } from '../../lib/format';
import type { Stats } from '../../lib/model';
import { getParam, href, type SearchParams } from '../../lib/query';
import { requireUser, serverGet } from '../../lib/server';

export const metadata = { title: 'Quản trị' };

const dateParts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if ((await requireUser('/admin')).role !== 'ADMIN') return null;
  const params = await searchParams;
  const today = dateParts.format(new Date());
  const first = getParam(params, 'from') || `${today.slice(0, 7)}-01`;
  const last = getParam(params, 'to') || today;
  const valid = validDate(first) && validDate(last) && first <= last;
  const stats = valid ? await serverGet<Stats>(href('/admin/stats', { from: vietnamDate(first), to: vietnamDate(last, true) })) : undefined;
  return <section className="stack">
    <div><PageHeader title="Quản trị" description="Số liệu theo ngày tại Việt Nam." /></div>
    <form action="/admin" className="panel filter-row">
      <Field name="from" label="Từ ngày"><input id="from" name="from" type="date" required defaultValue={first} /></Field>
      <Field name="to" label="Đến ngày"><input id="to" name="to" type="date" required defaultValue={last} /></Field>
      <button type="submit">Xem thống kê</button>
    </form>
    {!valid && <Notice text="Chọn khoảng ngày hợp lệ. Ngày kết thúc phải từ ngày bắt đầu trở đi." error />}
    {stats && <div className="stat-grid" aria-label="Số liệu trong kỳ">
      <article className="stat panel"><h2>Tin đã tạo</h2><strong>{stats.listingCount.toLocaleString('vi-VN')}</strong></article>
      <article className="stat panel"><h2>Giao dịch hoàn tất</h2><strong>{stats.completedCount.toLocaleString('vi-VN')}</strong></article>
      <article className="stat panel"><h2>Sinh viên hoạt động</h2><strong>{stats.activeStudentCount.toLocaleString('vi-VN')}</strong></article>
    </div>}
  </section>;
}
