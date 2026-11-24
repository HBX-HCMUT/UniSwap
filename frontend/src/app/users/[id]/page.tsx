import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Back, Empty, ListingGrid, PageHeader, Pagination, Rating } from '../../../components/ui';
import { Toggle } from '../../../features/toggle';
import { moment } from '../../../lib/format';
import type { Listing, Page, PublicProfile, Review, Saved, School } from '../../../lib/model';
import { getParam, href, type SearchParams } from '../../../lib/query';
import { optionalGet, serverGet, sessionUser } from '../../../lib/server';

export const metadata = { title: 'Hồ sơ người bán' };

export default async function PublicProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const profile = await optionalGet<PublicProfile>(`/users/${id}`);
  if (!profile) notFound();
  const page = getParam(await searchParams, 'page');
  const user = await sessionUser();
  const path = `/users/${id}`;
  const [schools, reviews, listings, saved] = await Promise.all([
    serverGet<School[]>('/schools'),
    serverGet<Page<Review>>(href(`/users/${id}/reviews`, { page })),
    serverGet<Page<Listing>>(href('/listings', { sellerId: id })),
    user?.role === 'STUDENT' && user.id !== id ? serverGet<Saved>('/me/saved') : undefined,
  ]);
  return <>
    <Back to="/">Về chợ</Back>
    <PageHeader title={profile.displayName} description={schools.find((school) => school.id === profile.schoolId)?.name}>
      {saved && <Toggle endpoint={`/me/seller-follows/${id}`} active={saved.sellers.some((seller) => seller.id === id)} add="Theo dõi người bán" remove="Bỏ theo dõi người bán" />}
      {!user && <Link className="button secondary" href={href('/login', { returnTo: path })}>Đăng nhập để theo dõi</Link>}
    </PageHeader>
    <div className="stack">
      <section className="panel stack"><div className="row"><h2>Đánh giá</h2><Rating average={profile.averageRating} count={profile.reviewCount} /></div>
        {reviews.items.length > 0 && <ul className="review-list">{reviews.items.map((review) => <li key={review.id}>
          <strong className="rating" aria-label={`${review.rating} sao`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong> <time dateTime={review.createdAt} className="muted">{moment(review.createdAt)}</time>
          {review.comment && <p className="description">{review.comment}</p>}
        </li>)}</ul>}
        <Pagination data={reviews} to={path} />
      </section>
      <h2>Tin đang bán</h2>
      {listings.items.length ? <ListingGrid listings={listings.items} /> : <Empty title="Chưa có tin đang bán" />}
      {listings.total > listings.pageSize && <Link href={href('/', { sellerId: id })}>Xem tất cả tin</Link>}
    </div>
  </>;
}
