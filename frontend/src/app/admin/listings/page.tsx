import Link from 'next/link';
import { Empty, Field, ListingBadge, PageHeader, Pagination } from '../../../components/ui';
import { AdminDecision } from '../../../features/admin';
import { moment, money } from '../../../lib/format';
import { moderationStates, type Listing, type Page } from '../../../lib/model';
import { getParam, href, type SearchParams } from '../../../lib/query';
import { requireUser, serverGet } from '../../../lib/server';

export const metadata = { title: 'Tin đăng' };

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = { moderation: getParam(params, 'moderation'), page: getParam(params, 'page') };
  if ((await requireUser(href('/admin/listings', query))).role !== 'ADMIN') return null;
  const data = await serverGet<Page<Listing>>(href('/admin/listings', query));
  return <section className="stack">
    <div><PageHeader title="Tin đăng" /></div>
    <form action="/admin/listings" className="panel filter-row">
      <Field name="moderation" label="Trạng thái kiểm duyệt"><select name="moderation" id="moderation" defaultValue={query.moderation}>
        <option value="">Tất cả</option>
        {Object.entries(moderationStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></Field>
      <button type="submit" className="secondary">Lọc tin</button>
    </form>
    {data.items.length ? <div className="record-list">{data.items.map((listing) => <article key={listing.id} className="panel record">
      <div className="record-top"><h2><Link href={`/listings/${listing.id}`}>{listing.title}</Link></h2><ListingBadge listing={listing} /></div>
      <p>{listing.seller.displayName} · {money(listing.price)} · <time dateTime={listing.createdAt}>{moment(listing.createdAt)}</time></p>
      {listing.moderation !== 'REMOVED' && <AdminDecision endpoint={`/admin/listings/${listing.id}`} decisions={[
        ...(listing.moderation === 'PENDING' ? [{ label: 'Duyệt tin', body: { action: 'APPROVE' } }] : []),
        { label: 'Gỡ tin', body: { action: 'REMOVE' }, danger: true },
      ]} />}
    </article>)}</div> : <Empty title="Không có tin phù hợp" />}
    <Pagination to="/admin/listings" data={data} params={query} />
  </section>;
}
