import Link from 'next/link';
import { PageHeader, Rating } from '../../components/ui';
import { Logout } from '../../features/auth';
import { ProfileForm } from '../../features/profile';
import type { School } from '../../lib/model';
import { requireUser, serverGet } from '../../lib/server';

export const metadata = { title: 'Cá nhân', robots: { index: false, follow: false } };

export default async function MyProfilePage() {
  const user = await requireUser('/me');
  const schools = await serverGet<School[]>('/schools');
  return <>
    <PageHeader title="Cá nhân" />
    <div className="columns">
      <ProfileForm user={user} schools={schools} />
      <aside className="panel stack">
        <div className="person"><span className="avatar" aria-hidden="true">{user.displayName.slice(0, 1).toLocaleUpperCase('vi')}</span><div><h2>{user.displayName}</h2><p className="muted">{user.email}</p></div></div>
        <Rating average={user.averageRating} count={user.reviewCount} />
        <nav className="stack compact" aria-label="Quản lý tài khoản">
          {user.role === 'ADMIN' ? <Link href="/admin">Quản trị</Link> : <>
            <Link href={`/users/${user.id}`}>Xem hồ sơ công khai</Link>
            <Link href="/me/listings">Tin của tôi</Link><Link href="/me/reservations">Giao dịch của tôi</Link>
            <Link href="/me/saved">Đã lưu và theo dõi</Link><Link href="/notifications">Thông báo</Link>
          </>}
        </nav>
        <div><Logout /></div>
      </aside>
    </div>
  </>;
}
