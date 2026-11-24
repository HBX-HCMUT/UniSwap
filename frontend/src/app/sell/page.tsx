import { Empty, PageHeader } from '../../components/ui';
import { ListingForm } from '../../features/listings';
import type { Category, School } from '../../lib/model';
import { requireUser, serverGet } from '../../lib/server';
import Link from 'next/link';

export const metadata = { title: 'Đăng tin' };

export default async function SellPage() {
  const user = await requireUser('/sell');
  if (user.role !== 'STUDENT') return <Empty title="Đăng tin dành cho tài khoản sinh viên"><Link href="/">Về chợ</Link></Empty>;
  const [categories, schools] = await Promise.all([serverGet<Category[]>('/categories'), serverGet<School[]>('/schools')]);
  return <section className="narrow"><PageHeader title="Đăng tin" description="Thêm ảnh và thông tin để người mua dễ tìm món của bạn." /><ListingForm user={user} categories={categories} schools={schools} /></section>;
}
