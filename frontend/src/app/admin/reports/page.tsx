import Link from 'next/link';
import { Badge, Empty, Field, PageHeader, Pagination } from '../../../components/ui';
import { AdminDecision } from '../../../features/admin';
import { moment } from '../../../lib/format';
import { reportReasons, reportStates, type Listing, type Page, type Report } from '../../../lib/model';
import { getParam, href, type SearchParams } from '../../../lib/query';
import { optionalGet, requireUser, serverGet } from '../../../lib/server';

export const metadata = { title: 'Báo cáo' };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = { state: getParam(params, 'state'), page: getParam(params, 'page') };
  if ((await requireUser(href('/admin/reports', query))).role !== 'ADMIN') return null;
  const data = await serverGet<Page<Report>>(href('/admin/reports', query));
  const rows = await Promise.all(data.items.map(async (report) => ({
    report, listing: await optionalGet<Listing>(`/listings/${report.listingId}`),
  })));
  return <section className="stack">
    <div><PageHeader title="Báo cáo" /></div>
    <form action="/admin/reports" className="panel filter-row">
      <Field name="state" label="Trạng thái báo cáo"><select name="state" id="state" defaultValue={query.state}>
        <option value="">Tất cả</option>
        {Object.entries(reportStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></Field>
      <button type="submit" className="secondary">Lọc báo cáo</button>
    </form>
    {rows.length ? <div className="record-list">{rows.map(({ report, listing }) => <article key={report.id} className="panel record">
      <div className="record-top"><h2>{listing ? <Link href={`/listings/${listing.id}`}>{listing.title}</Link> : 'Tin không còn hiển thị'}</h2>
        <Badge tone={report.state === 'OPEN' ? 'amber' : 'neutral'}>{reportStates[report.state]}</Badge></div>
      <p>{reportReasons[report.reason]} · <time dateTime={report.createdAt}>{moment(report.createdAt)}</time></p>
      {report.details && <p className="description">{report.details}</p>}
      {report.state === 'OPEN' && <AdminDecision endpoint={`/admin/reports/${report.id}`} decisions={[
        { label: 'Gỡ tin', body: { action: 'REMOVE_LISTING' }, danger: true },
        { label: 'Bỏ qua báo cáo', body: { action: 'DISMISS' } },
      ]} />}
    </article>)}</div> : <Empty title="Không có báo cáo phù hợp" />}
    <Pagination to="/admin/reports" data={data} params={query} />
  </section>;
}
