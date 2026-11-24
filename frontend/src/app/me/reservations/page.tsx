import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Back, Badge, Empty, Field, PageHeader, Pagination } from '../../../components/ui';
import { moment, money } from '../../../lib/format';
import { reservationStates, type Page, type Reservation } from '../../../lib/model';
import { getParam, href, type SearchParams } from '../../../lib/query';
import { optionalGet, requireUser } from '../../../lib/server';
import { tradeSummary } from '../../../lib/trade-server';

export const metadata = { title: 'Giao dịch của tôi', robots: { index: false, follow: false } };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = Object.fromEntries(['conversationId', 'role', 'state', 'page'].map((key) => [key, getParam(params, key)]));
  const viewer = await requireUser(href('/me/reservations', query));
  if (viewer.role !== 'STUDENT') notFound();

  const data = await optionalGet<Page<Reservation>>(href('/reservations', query));
  if (!data) notFound();
  const { conversationId, role, state } = query;
  const rows = await Promise.all(data.items.map(async (reservation) => {
    const buyer = viewer.id === reservation.buyerId;
    const summary = await tradeSummary(reservation.listingId, buyer ? reservation.sellerId : reservation.buyerId);
    return { reservation, buyer, summary };
  }));

  return <section className="stack">
    <div>
      {conversationId && <Back to={`/inbox/${conversationId}`}>Về hội thoại</Back>}
      <PageHeader title="Giao dịch của tôi" description={conversationId ? 'Yêu cầu giữ của hội thoại này.' : undefined} />
    </div>
    <form action="/me/reservations" className="panel filter-row">
      {conversationId && <input name="conversationId" type="hidden" value={conversationId} />}
      <Field name="role" label="Vai trò"><select id="role" name="role" defaultValue={role}>
        <option value="">Tất cả</option><option value="BUYER">Mua</option><option value="SELLER">Bán</option>
      </select></Field>
      <Field name="state" label="Trạng thái"><select id="state" name="state" defaultValue={state}>
        <option value="">Tất cả</option>
        {Object.entries(reservationStates).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></Field>
      <button type="submit" className="secondary">Lọc giao dịch</button>
    </form>
    {rows.length ? <div className="record-list">{rows.map(({ reservation, buyer, summary }) => <article className="panel record" key={reservation.id}>
      <div className="record-top"><h2><Link href={`/reservations/${reservation.id}`}>{summary.title}</Link></h2><Badge>{reservationStates[reservation.state]}</Badge></div>
      <p>{buyer ? 'Mua từ' : 'Bán cho'} {summary.partner?.displayName ?? 'người dùng UniSwap'}</p>
      <div className="row muted">
        {reservation.finalPrice !== undefined && <span>{money(reservation.finalPrice)}</span>}
        <time dateTime={reservation.meetingAt ?? reservation.createdAt}>{moment(reservation.meetingAt ?? reservation.createdAt)}</time>
        {reservation.meetingPlace && <span>{reservation.meetingPlace}</span>}
      </div>
    </article>)}</div> : <Empty title="Chưa có yêu cầu giữ"><p>{role || state ? 'Thử đổi bộ lọc để xem giao dịch khác.' : 'Yêu cầu giữ sẽ xuất hiện tại đây.'}</p></Empty>}
    <Pagination data={data} to="/me/reservations" params={query} />
  </section>;
}
