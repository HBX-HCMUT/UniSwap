import { Injectable, NotFoundException } from '@nestjs/common';
import type { Review } from '@prisma/client';
import type { Request } from 'express';
import { db } from '../../common/db';
import { isPrismaError, newestFirst, paginate, pageResult, requireStudent, type PageQuery } from '../reservations/market-request';
import { stateConflict } from '../reservations/reservation-state';
import { findMemberReservation } from '../reservations/reservations.service';

function reviewDto({ comment, ...review }: Review) {
  return { ...review, ...(comment === null ? {} : { comment }) };
}

@Injectable()
export class ReviewsService {
  async create(req: Request, id: string, input: { rating: number; comment?: string }) {
    const user = await requireStudent(req);
    const reservation = await findMemberReservation(db, id, user.id);
    if (reservation.state !== 'COMPLETED') stateConflict('Chỉ đánh giá được sau khi hoàn tất giao dịch.');
    try {
      return reviewDto(await db.review.create({
        data: {
          reservationId: id,
          authorId: user.id,
          targetId: user.id === reservation.buyerId ? reservation.listing.sellerId : reservation.buyerId,
          rating: input.rating,
          comment: input.comment?.trim(),
        },
      }));
    } catch (error) {
      if (isPrismaError(error, 'P2002')) stateConflict('Bạn đã đánh giá giao dịch này.');
      throw error;
    }
  }

  async list(userId: string, query: PageQuery) {
    const user = await db.user.findFirst({
      where: { id: userId, role: 'STUDENT', status: 'ACTIVE', verifiedAt: { not: null } },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy hồ sơ.');
    const paging = paginate(query);
    const where = { targetId: userId };
    const [items, total] = await db.$transaction([
      db.review.findMany({ where, orderBy: newestFirst, skip: paging.skip, take: paging.take }),
      db.review.count({ where }),
    ]);
    return pageResult(items.map(reviewDto), total, paging);
  }
}
