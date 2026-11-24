import Link from 'next/link';
import { Back, Empty, ListingGrid, PageHeader, Rating } from '../../../components/ui';
import { Toggle } from '../../../features/toggle';
import type { Saved } from '../../../lib/model';
import { href } from '../../../lib/query';
import { requireUser, serverGet } from '../../../lib/server';

export const metadata = { title: 'Đã lưu và theo dõi', robots: { index: false, follow: false } };

export default async function SavedPage() {
  const user = await requireUser('/me/saved');
  if (user.role !== 'STUDENT') return <Empty title="Trang dành cho tài khoản sinh viên"><Link href="/">Về chợ</Link></Empty>;
  const data = await serverGet<Saved>('/me/saved');
  return <>
    <Back to="/me">Cá nhân</Back><PageHeader title="Đã lưu và theo dõi" />
    <div className="stack">
      <section className="stack"><h2>Tin đã lưu</h2>{data.listings.length ? <ListingGrid listings={data.listings} /> : <Empty title="Chưa lưu tin nào"><Link href="/">Khám phá chợ</Link></Empty>}</section>
      <div className="columns">
        <section className="panel stack"><h2>Người bán đang theo dõi</h2>
          {data.sellers.length ? data.sellers.map((seller) => <div className="record-top" key={seller.id}><div><Link href={`/users/${seller.id}`}>{seller.displayName}</Link><div><Rating average={seller.averageRating} count={seller.reviewCount} /></div></div>
          <Toggle endpoint={`/me/seller-follows/${seller.id}`} active add="Theo dõi người bán" remove="Bỏ theo dõi người bán" /></div>) : <p className="muted">Chưa theo dõi người bán nào.</p>}
        </section>
        <section className="panel stack"><h2>Danh mục đang theo dõi</h2>
          {data.categories.length ? data.categories.map((category) => <div className="record-top" key={category.id}><Link href={href('/', { categoryId: category.id })}>{category.name}</Link>
          <Toggle endpoint={`/me/category-follows/${category.id}`} active add="Theo dõi danh mục" remove="Bỏ theo dõi danh mục" /></div>) : <p className="muted">Chưa theo dõi danh mục nào.</p>}
        </section>
      </div>
    </div>
  </>;
}
