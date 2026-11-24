import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Navigation } from '../features/navigation';
import { sessionUser } from '../lib/server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'UniSwap · Chợ đồ cũ sinh viên', template: '%s · UniSwap' },
  description: 'Mua bán giáo trình, đồ ký túc xá và đồ dùng sinh viên gần trường.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await sessionUser();
  return <html lang="vi"><body>
    <a href="#main" className="skip-link">Đến nội dung chính</a>
    <Navigation user={user} />
    <main id="main" className="container" tabIndex={-1}>{children}</main>
    <footer className="site-footer">UniSwap <span>Chợ đồ cũ sinh viên</span></footer>
  </body></html>;
}
