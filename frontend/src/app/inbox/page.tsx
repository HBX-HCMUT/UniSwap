import Link from 'next/link';
import { Empty, PageHeader, Pagination } from '../../components/ui';
import type { Conversation, Page } from '../../lib/model';
import { getParam, href, type SearchParams } from '../../lib/query';
import { requireUser, serverGet } from '../../lib/server';
import { tradeSummary } from '../../lib/trade-server';
import { moment } from '../../lib/format';

export const metadata = { title: 'Hộp thư', robots: { index: false, follow: false } };

export default async function InboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requireUser('/inbox');
  if (viewer.role !== 'STUDENT') return <Empty title="Hộp thư dành cho tài khoản sinh viên"><Link href="/">Về chợ</Link></Empty>;
  const page = getParam(await searchParams, 'page');
  const data = await serverGet<Page<Conversation>>(href('/conversations', { page }));
  const rows = await Promise.all(data.items.map(async (item) => ({ item, summary: await tradeSummary(item.listingId, viewer.id === item.buyerId ? item.sellerId : item.buyerId) })));
  return <>
    <PageHeader title="Hộp thư" />
    {rows.length ? <div className="record-list">{rows.map(({ item, summary }) => <Link className="panel record" key={item.id} href={`/inbox/${item.id}`}><div className="record-top"><h2>{summary.title}</h2><time dateTime={item.createdAt} className="muted">{moment(item.createdAt)}</time></div><p className="muted">{summary.partner?.displayName ?? 'Người dùng UniSwap'}</p></Link>)}</div> :
    <Empty title="Chưa có hội thoại"><p>Mở một tin trên chợ để nhắn tin hỏi người bán.</p><Link className="button secondary" href="/">Về chợ</Link></Empty>}
    <Pagination data={data} to="/inbox" />
  </>;
}
