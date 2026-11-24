import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Listing, ListingModeration, Prisma, Report, ReportReason, ReportState } from '@prisma/client';
import type { Request } from 'express';
import { requireAdmin } from '../../common/auth';
import { db } from '../../common/db';
import { asSummary, summaryInclude } from '../listings/presentation';
import { isPrismaError, newestFirst, paginate, pageResult, requireStudent, type PageQuery } from '../reservations/market-request';
import { cancelOpenReservations, isPublicListing, lockListings, lockUsers, stateConflict } from '../reservations/reservation-state';
import { publishListing } from '../subscriptions/publication';

type ReportInput = { listingId: string; reason: ReportReason; details?: string };
type ReportDecision = { action: 'DISMISS' | 'REMOVE_LISTING'; reason: string };
type ListingDecision = { action: 'APPROVE' | 'REMOVE'; reason: string };

function reportDto({ id, reporterId, listingId, reason, details, state, createdAt }: Report) {
  return { id, reporterId, listingId, reason, state, createdAt, ...(details === null ? {} : { details }) };
}

async function lockModeratedListing(tx: Prisma.TransactionClient, id: string) {
  const candidate = await tx.listing.findUnique({ where: { id }, select: { sellerId: true } });
  if (!candidate) throw new NotFoundException('Không tìm thấy tin đăng.');
  await lockUsers(tx, [candidate.sellerId]);
  await lockListings(tx, [id]);
  return tx.listing.findUniqueOrThrow({ where: { id } });
}

async function changeListing(
  tx: Prisma.TransactionClient,
  listing: Listing,
  adminId: string,
  { action, reason }: ListingDecision,
) {
  const { id, sellerId } = listing;
  if ((action === 'APPROVE' && listing.moderation !== 'PENDING')
    || (action === 'REMOVE' && listing.moderation === 'REMOVED')) stateConflict();
  const moderation = action === 'APPROVE' ? 'APPROVED' : 'REMOVED';
  if (action === 'REMOVE') await cancelOpenReservations(tx, id);
  const changed = await tx.listing.update({ where: { id }, data: { moderation }, include: summaryInclude });
  if (action === 'APPROVE') await publishListing(tx, changed);
  const decision = await tx.moderationLog.create({
    data: { adminId, targetType: 'LISTING', targetId: id, action, reason },
  });
  await tx.notification.create({
    data: {
      userId: sellerId,
      kind: 'MODERATION',
      resourceId: id,
      eventKey: `moderation:${decision.id}`,
      text: action === 'APPROVE' ? 'Tin của bạn đã được duyệt.' : 'Tin của bạn đã bị gỡ.',
    },
  });
  return asSummary(changed);
}

@Injectable()
export class ModerationService {
  async report(req: Request, input: ReportInput) {
    const student = await requireStudent(req, undefined, false);
    try {
      return await db.$transaction(async (tx) => {
        const { listingId } = input;
        const candidate = await tx.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
        if (!candidate) throw new NotFoundException('Không tìm thấy tin đăng.');
        await lockUsers(tx, [student.id, candidate.sellerId]);
        await lockListings(tx, [listingId]);
        await requireStudent(req, tx);
        const listing = await tx.listing.findUniqueOrThrow({
          where: { id: listingId }, include: { seller: { select: { status: true } } },
        });
        if (!isPublicListing(listing)) throw new NotFoundException('Không tìm thấy tin đăng.');
        if (listing.sellerId === student.id) throw new ForbiddenException('Bạn không thể báo cáo tin của mình.');
        return reportDto(await tx.report.create({
          data: { ...input, reporterId: student.id },
        }));
      });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) stateConflict('Tin này đã có báo cáo đang chờ xử lý của bạn.');
      throw error;
    }
  }

  async reports(req: Request, query: PageQuery & { state?: ReportState }) {
    await requireAdmin(req);
    const paging = paginate(query);
    const where = { state: query.state };
    const [items, total] = await db.$transaction([
      db.report.findMany({ where, orderBy: newestFirst, skip: paging.skip, take: paging.take }),
      db.report.count({ where }),
    ]);
    return pageResult(items.map(reportDto), total, paging);
  }

  async changeReport(req: Request, id: string, decision: ReportDecision) {
    const admin = await requireAdmin(req, undefined, false);
    return db.$transaction(async (tx) => {
      const candidate = await tx.report.findUnique({ where: { id }, select: { listingId: true } });
      if (!candidate) throw new NotFoundException('Không tìm thấy báo cáo.');
      const listing = await lockModeratedListing(tx, candidate.listingId);
      await requireAdmin(req, tx, false);
      const report = await tx.report.findUniqueOrThrow({ where: { id } });
      if (report.state !== 'OPEN') stateConflict('Báo cáo này đã được xử lý.');

      const state = decision.action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED';
      if (state === 'ACTIONED' && listing.moderation !== 'REMOVED') {
        await changeListing(tx, listing, admin.id, { action: 'REMOVE', reason: decision.reason });
      }
      const changed = await tx.report.update({
        where: { id },
        data: { state, resolvedAt: new Date(), resolvedById: admin.id, resolutionNote: decision.reason },
      });
      const log = await tx.moderationLog.create({
        data: {
          adminId: admin.id,
          targetType: 'REPORT',
          targetId: id,
          action: state === 'DISMISSED' ? 'DISMISS' : 'REMOVE',
          reason: decision.reason,
        },
      });
      await tx.notification.create({
        data: {
          userId: report.reporterId,
          kind: 'MODERATION',
          resourceId: listing.id,
          eventKey: `moderation:${log.id}`,
          text: state === 'DISMISSED' ? 'Báo cáo của bạn đã được xử lý.' : 'Tin bạn báo cáo đã được gỡ.',
        },
      });
      return reportDto(changed);
    });
  }

  async listings(req: Request, query: PageQuery & { moderation?: ListingModeration }) {
    await requireAdmin(req);
    const paging = paginate(query);
    const where = { moderation: query.moderation };
    const [items, total] = await db.$transaction([
      db.listing.findMany({ where, include: summaryInclude, orderBy: newestFirst, skip: paging.skip, take: paging.take }),
      db.listing.count({ where }),
    ]);
    return pageResult(items.map(asSummary), total, paging);
  }

  async changeListing(req: Request, id: string, decision: ListingDecision) {
    const admin = await requireAdmin(req, undefined, false);
    return db.$transaction(async (tx) => {
      const listing = await lockModeratedListing(tx, id);
      await requireAdmin(req, tx, false);
      return changeListing(tx, listing, admin.id, decision);
    });
  }
}
