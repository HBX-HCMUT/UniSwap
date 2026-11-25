import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Back, ListingBadge, Rating } from '../../../components/ui';
import { Icon } from '../../../components/icons';
import { Gallery, ListingActions } from '../../../features/listings';
import { money } from '../../../lib/format';
import { conditionNames, type Listing, type Saved, type School } from '../../../lib/model';
import { getParam, internalPath, type SearchParams } from '../../../lib/query';
import { optionalGet, serverGet, sessionUser } from '../../../lib/server';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await optionalGet<Listing>(`/listings/${id}`);
  if (!listing) notFound();
  return {
    title: listing.title,
    description: `${money(listing.price)} · ${listing.description.slice(0, 150)}`,
    ...(listing.moderation !== 'APPROVED' || listing.state === 'HIDDEN' ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = getParam(query, 'returnTo');
  const backTo = returnTo.startsWith('/?') ? internalPath(returnTo) : '/';
  const listing = await optionalGet<Listing>(`/listings/${id}`);
  if (!listing) notFound();
  const user = await sessionUser();
  const [schools, saved] = await Promise.all([
    serverGet<School[]>('/schools'),
    user?.role === 'STUDENT' && user.id !== listing.seller.id ? serverGet<Saved>('/me/saved') : undefined,
  ]);
  const school = schools.find((item) => item.id === listing.schoolId)?.name;
  const sellerSchool = schools.find((item) => item.id === listing.seller.schoolId)?.name;
  return <>
    <Back to={backTo}>{backTo === '/' ? 'Về chợ' : 'Về kết quả'}</Back>
    <div className="columns">
      <Gallery listing={listing} />
      <article className="panel stack detail-info">
        <div className="row"><ListingBadge listing={listing} /><span className="muted">{listing.categoryName}</span></div>
        <h1>{listing.title}</h1><p className="price">{money(listing.price)}</p>
        <p className="location"><Icon name="pin" />{[listing.area, school].filter(Boolean).join(' · ')}</p>
        <p className="muted">{conditionNames[listing.condition]}</p>
        <section className="stack compact"><h2>Mô tả</h2><p className="description">{listing.description}</p></section>
        <div className="person">
          <span className="avatar" aria-hidden="true">{listing.seller.displayName.slice(0, 1).toLocaleUpperCase('vi')}</span>
          <div><Link href={`/users/${listing.seller.id}`}><strong>{listing.seller.displayName}</strong></Link>
          {sellerSchool && <p className="muted">{sellerSchool}</p>}<Rating average={listing.seller.averageRating} count={listing.seller.reviewCount} /></div>
        </div>
        <ListingActions listing={listing} user={user} saved={Boolean(saved?.listings.some((item) => item.id === id))} />
      </article>
    </div>
  </>;
}
