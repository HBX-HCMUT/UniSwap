import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { requireAdmin } from '../../common/auth';
import { db } from '../../common/db';
import { isPrismaError, newestFirst, paginate, pageResult, type PageQuery } from '../reservations/market-request';
import { cancelOpenReservations, lockListings, lockUsers, openReservationStates, stateConflict } from '../reservations/reservation-state';
import { publishListing } from '../subscriptions/publication';

const adminUserSelect = {
  id: true, email: true, displayName: true, status: true, role: true,
} satisfies Prisma.UserSelect;

async function closeAccountReservations(tx: Prisma.TransactionClient, id: string) {
  const listings = await tx.listing.findMany({
    where: {
      reservations: { some: { state: { in: [...openReservationStates] } } },
      OR: [
        { sellerId: id },
        { reservations: { some: { buyerId: id, state: { in: [...openReservationStates] } } } },
      ],
    },
    select: { id: true, sellerId: true },
    orderBy: { id: 'asc' },
  });
  await lockListings(tx, listings.map((listing) => listing.id));
  for (const listing of listings) {
    await cancelOpenReservations(tx, listing.id, undefined, listing.sellerId === id ? undefined : id);
  }
}

@Injectable()
export class AdminService {
  async users(req: Request, query: PageQuery & { q?: string }) {
    await requireAdmin(req);
    const paging = paginate(query);
    const search = query.q?.trim();
    const match = { contains: search, mode: 'insensitive' as const };
    const where: Prisma.UserWhereInput = search ? { OR: [{ email: match }, { displayName: match }] } : {};
    const [items, total] = await db.$transaction([
      db.user.findMany({ where, select: adminUserSelect, orderBy: newestFirst, skip: paging.skip, take: paging.take }),
      db.user.count({ where }),
    ]);
    return pageResult(items, total, paging);
  }

  async changeUser(req: Request, id: string, input: { status: UserStatus; reason: string }) {
    const admin = await requireAdmin(req, undefined, false);
    return db.$transaction(async (tx) => {
      await lockUsers(tx, [id]);
      await requireAdmin(req, tx, false);
      const user = await tx.user.findFirst({ where: { id, role: 'STUDENT' }, select: adminUserSelect });
      if (!user) throw new NotFoundException('Không tìm thấy tài khoản sinh viên.');
      if (user.status === input.status) stateConflict('Tài khoản đã ở trạng thái yêu cầu.');

      const changed = await tx.user.update({ where: { id }, data: { status: input.status }, select: adminUserSelect });
      if (input.status === 'LOCKED') {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
        await closeAccountReservations(tx, id);
      } else {
        const firstPublications = await tx.listing.findMany({
          where: { sellerId: id, moderation: 'APPROVED', state: 'AVAILABLE', publishedAt: null },
          select: { id: true, sellerId: true, categoryId: true, publishedAt: true },
          orderBy: { id: 'asc' },
        });
        await lockListings(tx, firstPublications.map((listing) => listing.id));
        for (const listing of firstPublications) await publishListing(tx, listing);
      }
      await tx.moderationLog.create({
        data: {
          adminId: admin.id,
          targetType: 'USER',
          targetId: id,
          action: input.status === 'LOCKED' ? 'LOCK' : 'UNLOCK',
          reason: input.reason,
        },
      });
      return changed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async categories(req: Request) {
    await requireAdmin(req);
    return db.category.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }

  async createCategory(req: Request, name: string) {
    await requireAdmin(req);
    try {
      return await db.category.create({ data: { name } });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) stateConflict('Tên danh mục đã được sử dụng.');
      throw error;
    }
  }

  async changeCategory(req: Request, id: string, data: { name?: string; active?: boolean }) {
    await requireAdmin(req);
    try {
      return await db.category.update({ where: { id }, data });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) throw new NotFoundException('Không tìm thấy danh mục.');
      if (isPrismaError(error, 'P2002')) stateConflict('Tên danh mục đã được sử dụng.');
      throw error;
    }
  }

  async stats(req: Request, query: { from: string; to: string }) {
    await requireAdmin(req);
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (!(from < to)) throw new BadRequestException('Thời điểm bắt đầu phải trước thời điểm kết thúc.');
    const period = { gte: from, lt: to };
    const [listingCount, completedCount, activeStudentCount] = await db.$transaction([
      db.listing.count({ where: { createdAt: period } }),
      db.reservation.count({ where: { state: 'COMPLETED', completedAt: period } }),
      db.user.count({ where: { role: 'STUDENT', lastActiveAt: period } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { from, to, listingCount, completedCount, activeStudentCount };
  }
}
