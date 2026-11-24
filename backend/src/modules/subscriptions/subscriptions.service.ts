import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { db } from '../../common/db';
import { asSummary, summaryInclude } from '../listings/presentation';
import { newestFirst, requireStudent } from '../reservations/market-request';
import { publicListingWhere } from '../reservations/reservation-state';

@Injectable()
export class SubscriptionsService {
  async saved(req: Request) {
    const user = await requireStudent(req);
    return db.$transaction(async (tx) => {
      const [listings, followed, categories] = await Promise.all([
        tx.listing.findMany({
          where: {
            AND: [publicListingWhere, { favorites: { some: { userId: user.id } } }],
          },
          include: summaryInclude,
          orderBy: newestFirst,
        }),
        tx.user.findMany({
          where: { status: 'ACTIVE', followers: { some: { userId: user.id } } },
          select: { id: true, displayName: true, schoolId: true },
          orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        }),
        tx.category.findMany({
          where: { follows: { some: { userId: user.id } } },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
      ]);
      const reviews = await tx.review.groupBy({
        by: ['targetId'],
        where: { targetId: { in: followed.map(({ id }) => id) } },
        _avg: { rating: true },
        _count: true,
      });
      const reputation = new Map(reviews.map(({ targetId, _avg, _count }) => [
        targetId, { averageRating: Math.round((_avg.rating ?? 0) * 10) / 10, reviewCount: _count },
      ]));
      return {
        listings: listings.map(asSummary),
        sellers: followed.map((seller) => ({
          ...seller, ...(reputation.get(seller.id) ?? { averageRating: null, reviewCount: 0 }),
        })),
        categories,
      };
    });
  }

  async favorite(req: Request, listingId: string, enabled: boolean) {
    const user = await requireStudent(req);
    const data = { userId: user.id, listingId };
    if (!enabled) {
      await db.favorite.deleteMany({ where: data });
      return;
    }
    const listing = await db.listing.findFirst({ where: { id: listingId, ...publicListingWhere }, select: { id: true } });
    if (!listing) throw new NotFoundException('Không tìm thấy tin đăng.');
    await db.favorite.createMany({ data, skipDuplicates: true });
  }

  async sellerFollow(req: Request, sellerId: string, enabled: boolean) {
    const user = await requireStudent(req);
    const data = { userId: user.id, sellerId };
    if (!enabled) {
      await db.sellerFollow.deleteMany({ where: data });
      return;
    }
    if (sellerId === user.id) throw new ForbiddenException('Bạn không thể theo dõi chính mình.');
    const seller = await db.user.findFirst({
      where: { id: sellerId, role: 'STUDENT', status: 'ACTIVE', verifiedAt: { not: null } },
      select: { id: true },
    });
    if (!seller) throw new NotFoundException('Không tìm thấy người bán.');
    await db.sellerFollow.createMany({ data, skipDuplicates: true });
  }

  async categoryFollow(req: Request, categoryId: string, enabled: boolean) {
    const user = await requireStudent(req);
    const data = { userId: user.id, categoryId };
    if (!enabled) {
      await db.categoryFollow.deleteMany({ where: data });
      return;
    }
    const category = await db.category.findFirst({ where: { id: categoryId, active: true }, select: { id: true } });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục.');
    await db.categoryFollow.createMany({ data, skipDuplicates: true });
  }
}
