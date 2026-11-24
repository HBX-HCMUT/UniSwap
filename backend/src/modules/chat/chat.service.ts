import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Conversation, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { db } from '../../common/db';
import { limit } from '../../common/limits';
import { newestFirst, paginate, pageResult, requireStudent, type PageQuery } from '../reservations/market-request';
import { isPublicListing, lockListings, lockUsers, stateConflict } from '../reservations/reservation-state';

const includeSeller = { listing: { select: { sellerId: true } } };

function conversationDto({ listing, ...conversation }: Conversation & { listing: { sellerId: string } }) {
  return { ...conversation, sellerId: listing.sellerId };
}

function memberWhere(userId: string): Prisma.ConversationWhereInput {
  return { OR: [{ buyerId: userId }, { listing: { sellerId: userId } }] };
}

export async function findMemberConversation(tx: Prisma.TransactionClient, id: string, userId: string) {
  const conversation = await tx.conversation.findFirst({
    where: { id, ...memberWhere(userId) },
    include: includeSeller,
  });
  if (!conversation) throw new NotFoundException('Không tìm thấy hội thoại.');
  return conversation;
}

@Injectable()
export class ChatService {
  async open(req: Request, listingId: string) {
    const buyer = await requireStudent(req, undefined, false);
    return db.$transaction(async (tx) => {
      const source = await tx.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
      if (!source) throw new NotFoundException('Không tìm thấy tin đăng.');
      await lockUsers(tx, [buyer.id, source.sellerId]);
      await lockListings(tx, [listingId]);
      await requireStudent(req, tx);
      const listing = await tx.listing.findUniqueOrThrow({
        where: { id: listingId },
        include: { seller: { select: { status: true } } },
      });
      if (listing.sellerId === buyer.id) throw new ForbiddenException('Bạn không thể mở hội thoại cho tin của mình.');
      const existing = await tx.conversation.findUnique({
        where: { listingId_buyerId: { listingId, buyerId: buyer.id } },
        include: includeSeller,
      });
      if (existing) return conversationDto(existing);
      if (!isPublicListing(listing)) throw new NotFoundException('Không tìm thấy tin đăng.');
      const accepted = listing.state === 'RESERVED' && await tx.reservation.findFirst({
        where: { listingId, buyerId: buyer.id, state: 'ACCEPTED' },
        select: { id: true },
      });
      if (listing.state !== 'AVAILABLE' && !accepted) stateConflict('Tin này không còn mở hội thoại mới.');
      const created = await tx.conversation.create({
        data: { listingId, buyerId: buyer.id },
        include: includeSeller,
      });
      return conversationDto(created);
    });
  }

  async list(req: Request, query: PageQuery) {
    const user = await requireStudent(req);
    const paging = paginate(query);
    const where = memberWhere(user.id);
    const [items, total] = await db.$transaction([
      db.conversation.findMany({
        where, include: includeSeller, orderBy: newestFirst, skip: paging.skip, take: paging.take,
      }),
      db.conversation.count({ where }),
    ]);
    return pageResult(items.map(conversationDto), total, paging);
  }

  async messages(req: Request, id: string, query: PageQuery) {
    const user = await requireStudent(req);
    const paging = paginate(query);
    const where = { conversationId: id };
    return db.$transaction(async (tx) => {
      await findMemberConversation(tx, id, user.id);
      const [items, total] = await Promise.all([
        tx.message.findMany({ where, orderBy: newestFirst, skip: paging.skip, take: paging.take }),
        tx.message.count({ where }),
      ]);
      return pageResult(items, total, paging);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async send(req: Request, conversationId: string, text: string) {
    const sender = await requireStudent(req, undefined, false);
    return db.$transaction(async (tx) => {
      const conversation = await findMemberConversation(tx, conversationId, sender.id);
      const recipientId = conversation.buyerId === sender.id ? conversation.listing.sellerId : conversation.buyerId;
      await lockUsers(tx, [sender.id, recipientId]);
      await requireStudent(req, tx);
      limit(`message:${sender.id}`, 30);

      const message = await tx.message.create({ data: { conversationId, senderId: sender.id, text } });
      await tx.notification.create({
        data: {
          userId: recipientId,
          kind: 'MESSAGE',
          resourceId: conversationId,
          eventKey: `message:${message.id}`,
          text: 'Bạn có tin nhắn mới.',
        },
      });
      return message;
    });
  }
}
