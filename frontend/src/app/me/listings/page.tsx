import Link from 'next/link';
import { Back, Empty, ListingBadge, PageHeader, Pagination } from '../../../components/ui';
import { OwnerActions } from '../../../features/listings';
import { money } from '../../../lib/format';
import type { Listing, Page } from '../../../lib/model';
import { getParam, href, type SearchParams } from '../../../lib/query';
import { requireUser, serverGet } from '../../../lib/server';

export const metadata = { title: 'Tin của tôi' };

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser('/me/listings');
  if (user.role !== 'STUDENT') return <Empty title="Trang dành cho tài khoản sinh viên"><Link href="/">Về chợ</Link></Empty>;
  const page = getParam(await searchParams, 'page');
  const data = await serverGet<Page<Listing>>(href('/me/listings', { page }));
  return <>
    <Back to="/me">Cá nhân</Back><PageHeader title="Tin của tôi"><Link className="button" href="/sell">Đăng tin</Link></PageHeader>
    {data.items.length ? <section className="record-list">{data.items.map((listing) => <article className="panel record" key={listing.id}>
      <div className="record-top"><h2><Link href={`/listings/${listing.id}`}>{listing.title}</Link></h2><ListingBadge listing={listing} /></div>
      <p className="price">{money(listing.price)}</p><OwnerActions listing={listing} />
    </article>)}</section> : <Empty title="Bạn chưa có tin đăng"><Link className="button" href="/sell">Đăng tin</Link></Empty>}
    <Pagination data={data} to="/me/listings" />
  </>;
}
