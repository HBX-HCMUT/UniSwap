import Link from 'next/link';
import type { ReactNode } from 'react';
import { Empty } from '../../components/ui';
import { requireUser } from '../../lib/server';

export const metadata = { robots: { index: false, follow: false } };

const sections = [
  { path: '/admin', title: 'Thống kê' },
  { path: '/admin/reports', title: 'Báo cáo' },
  { path: '/admin/listings', title: 'Tin đăng' },
  { path: '/admin/users', title: 'Tài khoản' },
  { path: '/admin/categories', title: 'Danh mục' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await requireUser('/admin');
  if (viewer.role !== 'ADMIN') return <Empty title="Bạn không có quyền quản trị"><Link className="button" href="/">Về chợ</Link></Empty>;
  return <>
    <nav className="row admin-nav" aria-label="Điều hướng quản trị">
      {sections.map(({ path, title }) => <Link className="button secondary" key={path} href={path}>{title}</Link>)}
    </nav>
    {children}
  </>;
}
