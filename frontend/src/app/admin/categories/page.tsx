import { Badge, Empty, PageHeader } from '../../../components/ui';
import { CategoryForm } from '../../../features/admin';
import type { Category } from '../../../lib/model';
import { requireUser, serverGet } from '../../../lib/server';

export const metadata = { title: 'Danh mục' };

export default async function AdminCategoriesPage() {
  if ((await requireUser('/admin/categories')).role !== 'ADMIN') return null;
  const categories = await serverGet<Category[]>('/admin/categories');
  return <section className="stack">
    <div><PageHeader title="Danh mục" /></div>
    <section className="panel stack"><h2>Thêm danh mục</h2><CategoryForm /></section>
    {categories.length ? <div className="record-list">{categories.map((category) => <article key={category.id} className="panel record">
      <div className="record-top"><h2>{category.name}</h2><Badge tone={category.active ? 'green' : 'neutral'}>{category.active ? 'Đang sử dụng' : 'Ngừng sử dụng'}</Badge></div>
      <CategoryForm category={category} />
    </article>)}</div> : <Empty title="Chưa có danh mục" />}
  </section>;
}
