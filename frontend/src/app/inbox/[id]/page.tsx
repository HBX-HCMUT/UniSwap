import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Back, PageHeader } from '../../../components/ui';
import { Chat, ConversationTrade } from '../../../features/chat';
import type { Message, Page } from '../../../lib/model';
import { optionalGet, requireUser } from '../../../lib/server';
import { findConversation, tradeSummary } from '../../../lib/trade-server';

export const metadata = { title: 'Hội thoại', robots: { index: false, follow: false } };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser(`/inbox/${id}`);
  if (viewer.role !== 'STUDENT') notFound();
  const initial = await optionalGet<Page<Message>>(`/conversations/${id}/messages`);
  if (!initial) notFound();
  const conversation = await findConversation(id);
  if (!conversation) notFound();
  const info = await tradeSummary(conversation.listingId, viewer.id === conversation.buyerId ? conversation.sellerId : conversation.buyerId);
  const partner = info.partner?.displayName ?? 'Người dùng UniSwap';
  return <section className="narrow">
    <Back to="/inbox">Hộp thư</Back><PageHeader title={partner} description={info.title}><ConversationTrade id={id} /></PageHeader>
    {info.available && <p className="chat-listing"><Link href={`/listings/${conversation.listingId}`}>Xem tin đăng</Link></p>}
    <Chat key={id} id={id} viewerId={viewer.id} partner={partner} initial={initial} />
  </section>;
}
