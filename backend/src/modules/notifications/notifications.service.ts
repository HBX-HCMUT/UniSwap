import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { db } from '../../common/db';
import { newestFirst, paginate, pageResult, requireStudent, type PageQuery } from '../reservations/market-request';

export interface NotificationsQuery extends PageQuery {
  unread?: 'true' | 'false' | boolean;
}

function notificationDto({ id, kind, resourceId, text, createdAt, readAt }: Notification) {
  return { id, kind, resourceId, text, createdAt, readAt };
}

@Injectable()
export class NotificationsService {
  async list(req: Request, query: NotificationsQuery) {
    const user = await requireStudent(req);
    const paging = paginate(query);
    const where: Prisma.NotificationWhereInput = { userId: user.id };
    if (query.unread !== undefined) {
      where.readAt = query.unread === 'true' || query.unread === true ? null : { not: null };
    }
    const [items, total] = await db.$transaction([
      db.notification.findMany({ where, orderBy: newestFirst, skip: paging.skip, take: paging.take }),
      db.notification.count({ where }),
    ]);
    return pageResult(items.map(notificationDto), total, paging);
  }

  async read(req: Request, id: string) {
    const user = await requireStudent(req);
    return db.$transaction(async (tx) => {
      await tx.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
      const notification = await tx.notification.findFirst({ where: { id, userId: user.id } });
      if (!notification) throw new NotFoundException('Không tìm thấy thông báo.');
      return notificationDto(notification);
    });
  }
}
