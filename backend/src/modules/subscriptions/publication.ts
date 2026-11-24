import { Listing, Prisma } from '@prisma/client';

type Publication = Pick<Listing, 'id' | 'sellerId' | 'categoryId' | 'publishedAt'>;

export async function publishListing(tx: Prisma.TransactionClient, listing: Publication) {
  if (listing.publishedAt !== null) return;
  const { count } = await tx.listing.updateMany({
    where: {
      id: listing.id,
      publishedAt: null,
      state: 'AVAILABLE',
      moderation: 'APPROVED',
      seller: { status: 'ACTIVE' },
    },
    data: { publishedAt: new Date() },
  });
  if (count === 0) return;
  const users = await tx.user.findMany({
    where: {
      id: { not: listing.sellerId },
      role: 'STUDENT',
      status: 'ACTIVE',
      OR: [
        { sellerFollows: { some: { sellerId: listing.sellerId } } },
        { categoryFollows: { some: { categoryId: listing.categoryId } } },
      ],
    },
    select: { id: true },
  });
  await tx.notification.createMany({
    data: users.map(({ id }) => ({
      userId: id,
      kind: 'NEW_LISTING',
      resourceId: listing.id,
      eventKey: `listing:${listing.id}:published`,
      text: 'Có tin đăng mới từ người bán hoặc danh mục bạn theo dõi.',
    })),
    skipDuplicates: true,
  });
}
