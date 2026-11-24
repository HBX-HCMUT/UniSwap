import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const openReservationStates = ['PENDING', 'ACCEPTED'] as const;

export function stateConflict(message = 'Trạng thái đã thay đổi. Vui lòng tải lại dữ liệu.'): never {
  throw new ConflictException({ code: 'STATE_CONFLICT', message });
}

export async function lockUsers(tx: Prisma.TransactionClient, ids: string[]) {
  if (ids.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM users WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id FOR NO KEY UPDATE
  `;
}

export async function lockListings(tx: Prisma.TransactionClient, ids: string[]) {
  if (ids.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM listings WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id FOR UPDATE
  `;
}

export async function cancelOpenReservations(
  tx: Prisma.TransactionClient,
  listingId: string,
  actorId?: string,
  buyerId?: string,
) {
  const open = await tx.reservation.findMany({
    where: { listingId, buyerId, state: { in: [...openReservationStates] } },
    include: { listing: { select: { sellerId: true } } },
  });
  if (open.length === 0) return;

  await tx.reservation.updateMany({
    where: { id: { in: open.map(({ id }) => id) } },
    data: { state: 'CANCELLED' },
  });
  if (open.some(({ state }) => state === 'ACCEPTED')) {
    await tx.listing.update({ where: { id: listingId }, data: { state: 'AVAILABLE' } });
  }
  await tx.notification.createMany({
    data: open.flatMap(({ id, buyerId: recipientId, listing }) =>
      [recipientId, listing.sellerId].filter((userId) => userId !== actorId).map((userId) => ({
        userId,
        kind: 'RESERVATION' as const,
        resourceId: id,
        eventKey: `reservation:${id}:CANCELLED`,
        text: 'Yêu cầu giữ món đã bị hủy.',
      })),
    ),
    skipDuplicates: true,
  });
}

export const publicListingWhere: Prisma.ListingWhereInput = {
  moderation: 'APPROVED',
  state: { not: 'HIDDEN' },
  seller: { status: 'ACTIVE' },
};

export function isPublicListing(listing: {
  state: string;
  moderation: string;
  seller: { status: string };
}) {
  return listing.state !== 'HIDDEN' && listing.moderation === 'APPROVED'
    && listing.seller.status === 'ACTIVE';
}
