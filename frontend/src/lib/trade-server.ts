import { optionalGet, serverGet } from './server';
import type { Conversation, Listing, Page, PublicProfile } from './model';
import { href } from './query';

export async function tradeSummary(listingId: string, partnerId: string) {
  const [listing, partner] = await Promise.all([
    optionalGet<Listing>(`/listings/${listingId}`),
    optionalGet<PublicProfile>(`/users/${partnerId}`),
  ]);
  return { title: listing?.title ?? 'Tin không còn hiển thị', available: Boolean(listing), partner };
}

export async function findConversation(id: string) {
  let page = 1;
  for (;;) {
    const data = await serverGet<Page<Conversation>>(href('/conversations', { page: String(page), pageSize: '100' }));
    const conversation = data.items.find((item) => item.id === id);
    if (conversation || page * data.pageSize >= data.total) return conversation;
    page++;
  }
}
