'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '../components/icons';
import { request } from '../lib/api';
import type { Me, Notification, Page } from '../lib/model';

const links = [
  { href: '/', label: 'Chợ', icon: 'shop' },
  { href: '/sell', label: 'Đăng tin', icon: 'plus' },
  { href: '/inbox', label: 'Hộp thư', icon: 'chat' },
  { href: '/me', label: 'Cá nhân', icon: 'user' },
] as const;

export function Navigation({ user }: { user: Me | null }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState({ total: 0, messages: 0 });
  const student = user?.role === 'STUDENT';
  useEffect(() => {
    if (!student) return;
    const controller = new AbortController();
    async function update() {
      if (document.hidden) return;
      try {
        const data = await request<Page<Notification>>('/notifications?unread=true&pageSize=100', 'GET', undefined, controller.signal);
        setUnread({ total: data.total, messages: data.items.filter((item) => item.kind === 'MESSAGE').length });
      } catch { /* Polling resumes automatically when the API is available. */ }
    }
    void update();
    const interval = setInterval(update, 5000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('uniswap:notification-read', update);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('uniswap:notification-read', update);
    };
  }, [student, user?.id]);
  return <header className="site-header">
    <div className="header-inner">
      <Link className="brand" href="/"><span className="brand-mark"><Icon name="swap" /></span>UniSwap</Link>
      <nav className="site-nav" aria-label="Điều hướng chính">
        {links.map((link) => {
          const active = link.href === '/' ? pathname === '/' || pathname.startsWith('/listings/') : pathname.startsWith(link.href);
          return <Link className={active ? 'active' : ''} key={link.href} href={link.href} aria-current={active ? 'page' : undefined}><Icon name={link.icon} />{link.label}{student && link.href === '/inbox' && unread.messages > 0 && <span className="nav-count" aria-label={`${unread.messages} tin nhắn mới`}>{unread.messages}</span>}</Link>;
        })}
      </nav>
      <div className="header-actions">
        {student && <Link href="/notifications" className="icon-button" aria-label={`Thông báo${unread.total > 0 ? ` (${unread.total} chưa đọc)` : ''}`} title="Thông báo"><Icon name="bell" />{unread.total > 0 && <span className="nav-count">{unread.total > 99 ? '99+' : unread.total}</span>}</Link>}
        {user?.role === 'ADMIN' && <Link className="button secondary" href="/admin">Quản trị</Link>}
        {!user && <Link href="/login" className="button secondary">Đăng nhập</Link>}
      </div>
    </div>
  </header>;
}
