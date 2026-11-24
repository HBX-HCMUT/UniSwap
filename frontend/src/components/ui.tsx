import Link from 'next/link';
import type { ReactNode } from 'react';
import { assetPath } from '../lib/api';
import { money } from '../lib/format';
import { conditionNames, listingStates, moderationStates, type Asset, type Listing, type Page } from '../lib/model';
import { href, type SearchParams } from '../lib/query';
import { Icon } from './icons';

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</header>;
}

export function Back({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="back" href={to}><Icon name="back" />{children}</Link>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <section className="empty panel"><div className="empty-icon"><Icon name="shop" /></div><h2>{title}</h2>{children}</section>;
}

export function Notice({ text, error = false }: { text?: string; error?: boolean }) {
  return text ? <p role={error ? 'alert' : 'status'} className={error ? 'notice error' : 'notice'}>{text}</p> : null;
}

export function Field({ name, label, error, children }: { name: string; label: string; error?: string; children: ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}</label>{children}{error && <p className="field-error" id={`${name}-error`}>{error}</p>}</div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function ListingBadge({ listing }: { listing: Listing }) {
  if (listing.moderation !== 'APPROVED') return <Badge tone={listing.moderation === 'REMOVED' ? 'red' : 'amber'}>{moderationStates[listing.moderation]}</Badge>;
  return <Badge tone={listing.state === 'AVAILABLE' ? 'green' : listing.state === 'RESERVED' ? 'amber' : 'neutral'}>{listingStates[listing.state]}</Badge>;
}

export function AssetImage({ asset, alt, eager = false }: { asset?: Asset; alt: string; eager?: boolean }) {
  if (!asset) return <div className="image-placeholder" aria-hidden="true"><Icon name="image" width={36} height={36}/></div>;
  // Files are served through the authenticated API. Browser delivery preserves its access checks.
  return <img src={assetPath(asset)} alt={alt} loading={eager ? 'eager' : 'lazy'} />;
}

export function ListingCard({ listing }: { listing: Listing }) {
  return <article className="listing-card"><Link href={`/listings/${listing.id}`}>
    <div className="listing-image"><AssetImage asset={listing.images[0]} alt="" /><span className="image-badge"><ListingBadge listing={listing} /></span></div>
    <div className="listing-copy"><p className="card-condition">{conditionNames[listing.condition]}</p><h3>{listing.title}</h3><strong className="price">{money(listing.price)}</strong>
      <p className="location"><Icon name="pin" width={16} height={16} />{listing.area}</p></div>
  </Link></article>;
}

export function ListingGrid({ listings }: { listings: Listing[] }) {
  return <div className="listing-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>;
}

export function Pagination({ data, to, params = {} }: { data: Page<unknown>; to: string; params?: SearchParams }) {
  const count = Math.ceil(data.total / data.pageSize);
  if (count <= 1 && data.page <= 1) return null;
  return <nav className="pagination" aria-label="Phân trang">
    {data.page > 1 && <Link className="button secondary" href={href(to, { ...params, page: String(data.page - 1) })}>Trang trước</Link>}
    <span>Trang {data.page} / {Math.max(count, 1)}</span>
    {data.page < count && <Link className="button secondary" href={href(to, { ...params, page: String(data.page + 1) })}>Trang sau</Link>}
  </nav>;
}

export function Rating({ average, count }: { average: number | null; count: number }) {
  return average === null || count === 0 ? <span className="muted">Chưa có đánh giá</span> : <span className="rating">★ {average.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} <span className="muted">({count} đánh giá)</span></span>;
}
