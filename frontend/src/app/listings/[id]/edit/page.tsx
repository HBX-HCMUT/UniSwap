import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Back, Empty, PageHeader } from '../../../../components/ui';
import { ListingForm } from '../../../../features/listings';
import type { Category, Listing, School } from '../../../../lib/model';
import { optionalGet, requireUser, serverGet } from '../../../../lib/server';

export const metadata = { title: 'Sửa tin' };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/listings/${id}/edit`);
  const listing = await optionalGet<Listing>(`/listings/${id}`);
  if (!listing) notFound();
  if (listing.seller.id !== user.id) return <Empty title="Bạn không có quyền sửa tin này"><Link href={`/listings/${id}`}>Về chi tiết tin</Link></Empty>;
  if (listing.state !== 'AVAILABLE' || listing.moderation === 'REMOVED') return <Empty title="Tin không thể sửa ở trạng thái hiện tại"><Link href={`/listings/${id}`}>Về chi tiết tin</Link></Empty>;
  const [categories, schools] = await Promise.all([serverGet<Category[]>('/categories'), serverGet<School[]>('/schools')]);
  return <section className="narrow"><Back to="/me/listings">Tin của tôi</Back><PageHeader title="Sửa tin" /><ListingForm key={listing.id} listing={listing} categories={categories} schools={schools} user={user} /></section>;
}
