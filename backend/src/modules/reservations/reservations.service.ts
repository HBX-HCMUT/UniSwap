import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, ReservationState } from '@prisma/client';
import type { Request } from 'express';
import { db } from '../../common/db';
import { asAsset } from '../listings/presentation';
import { findMemberConversation } from '../chat/chat.service';
import { newestFirst, paginate, pageResult, requireStudent, type PageQuery } from './market-request';
import { isPublicListing, lockListings, lockUsers, openReservationStates, stateConflict } from './reservation-state';

export type ReservationAction =
  | { action: 'ACCEPT'; finalPrice: number; meetingAt: string; meetingPlace: string; paymentMethod: 'COD' }
  | { action: 'ACCEPT'; finalPrice: number; meetingAt: string; meetingPlace: string; paymentMethod: 'QR_MANUAL'; qrAssetId: string }
  | { action: 'CANCEL' | 'COMPLETE' | 'REJECT' };

export interface ReservationQuery extends PageQuery {
  role?: 'BUYER' | 'SELLER';
  state?: ReservationState;
  conversationId?: string;
}

const listingWithSeller = { seller: { select: { status: true } } };

function viewInclude(viewerId: string) {
  return {
    listing: { select: { sellerId: true } },
    qrAsset: true,
    reviews: { where: { authorId: viewerId }, select: { id: true } },
  } satisfies Prisma.ReservationInclude;
}

type ReservationView = Prisma.ReservationGetPayload<{ include: ReturnType<typeof viewInclude> }>;

function reservationDto(reservation: ReservationView) {
  const { id, listingId, buyerId, listing, state, createdAt, finalPrice, meetingAt, meetingPlace, paymentMethod,
    qrAsset, completedAt, reviews } = reservation;
  return {
    id, listingId, buyerId, sellerId: listing.sellerId, state, createdAt,
    ...(paymentMethod === null ? {} : { finalPrice, meetingAt, meetingPlace, paymentMethod }),
    ...(qrAsset && (state === 'ACCEPTED' || state === 'COMPLETED') ? { qrAsset: asAsset(qrAsset) } : {}),
    ...(completedAt === null ? {} : { completedAt, viewerHasReviewed: reviews.length > 0 }),
  };
}

export async function findMemberReservation(tx: Prisma.TransactionClient, id: string, userId: string) {
  const reservation = await tx.reservation.findFirst({
    where: { id, OR: [{ buyerId: userId }, { listing: { sellerId: userId } }] },
    include: viewInclude(userId),
  });
  if (!reservation) throw new NotFoundException('Không tìm thấy yêu cầu giữ món.');
  return reservation;
}

const reservationTexts: Record<ReservationState, string> = {
  PENDING: 'Bạn có yêu cầu giữ món mới.',
  ACCEPTED: 'Người bán đã chấp thuận yêu cầu giữ món.',
  REJECTED: 'Yêu cầu giữ món đã bị từ chối.',
  CANCELLED: 'Yêu cầu giữ món đã bị hủy.',
  COMPLETED: 'Người mua đã xác nhận nhận món.',
};

async function notifyReservation(tx: Prisma.TransactionClient, id: string, userId: string, state: ReservationState) {
  await tx.notification.create({
    data: {
      userId,
      kind: 'RESERVATION',
      resourceId: id,
      eventKey: `reservation:${id}:${state}`,
      text: reservationTexts[state],
    },
  });
}

async function appointmentData(
  tx: Prisma.TransactionClient,
  buyerId: string,
  sellerId: string,
  input: Extract<ReservationAction, { action: 'ACCEPT' }>,
) {
  const meetingAt = new Date(input.meetingAt);
  if (Number.isNaN(meetingAt.getTime())) {
    throw new UnprocessableEntityException('Giờ hẹn không hợp lệ.');
  }
  if (meetingAt <= new Date()) {
    throw new UnprocessableEntityException('Giờ hẹn phải ở tương lai.');
  }
  const buyer = await tx.user.findUniqueOrThrow({ where: { id: buyerId }, select: { status: true } });
  if (buyer.status !== 'ACTIVE') stateConflict('Tài khoản của người mua đã bị khóa.');
  const qrAssetId = input.paymentMethod === 'QR_MANUAL' ? input.qrAssetId : null;
  if (qrAssetId) {
    const qr = await tx.asset.findFirst({ where: { id: qrAssetId, ownerId: sellerId } });
    if (!qr) throw new UnprocessableEntityException('Ảnh QR không thuộc quyền sử dụng của người bán.');
    if (qr.purpose !== 'PAYMENT_QR') throw new UnprocessableEntityException('Ảnh phải có mục đích thanh toán QR.');
  }
  return {
    finalPrice: input.finalPrice,
    meetingAt,
    meetingPlace: input.meetingPlace,
    paymentMethod: input.paymentMethod,
    qrAssetId,
  };
}

function checkTransition(reservation: ReservationView, viewerId: string, action: ReservationAction['action']) {
  const isBuyer = reservation.buyerId === viewerId;
  if (((action === 'ACCEPT' || action === 'REJECT') && isBuyer)
    || (action === 'COMPLETE' && !isBuyer)
    || (action === 'CANCEL' && !isBuyer && reservation.state === 'PENDING')) {
    throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này cho yêu cầu giữ món.');
  }
  const allowedStates = {
    ACCEPT: ['PENDING'],
    REJECT: ['PENDING'],
    CANCEL: ['PENDING', 'ACCEPTED'],
    COMPLETE: ['ACCEPTED'],
  };
  if (!allowedStates[action].includes(reservation.state)) stateConflict();
}

@Injectable()
export class ReservationsService {
  async create(req: Request, listingId: string) {
    const buyer = await requireStudent(req, undefined, false);
    return db.$transaction(async (tx) => {
      const source = await tx.listing.findUnique({ where: { id: listingId }, select: { sellerId: true } });
      if (!source) throw new NotFoundException('Không tìm thấy tin đăng.');
      await lockUsers(tx, [buyer.id, source.sellerId]);
      await lockListings(tx, [listingId]);
      await requireStudent(req, tx);
      const listing = await tx.listing.findUniqueOrThrow({ where: { id: listingId }, include: listingWithSeller });
      if (listing.sellerId === buyer.id) throw new ForbiddenException('Bạn không thể giữ món của chính mình.');
      if (!isPublicListing(listing)) throw new NotFoundException('Không tìm thấy tin đăng.');
      if (listing.state !== 'AVAILABLE') stateConflict('Món này không còn nhận yêu cầu giữ.');

      const include = viewInclude(buyer.id);
      const existing = await tx.reservation.findFirst({ where: { listingId, buyerId: buyer.id, state: 'PENDING' }, include });
      if (existing) return reservationDto(existing);
      const created = await tx.reservation.create({ data: { listingId, buyerId: buyer.id }, include });
      await notifyReservation(tx, created.id, listing.sellerId, 'PENDING');
      return reservationDto(created);
    });
  }

  async list(req: Request, query: ReservationQuery) {
    const user = await requireStudent(req);
    const paging = paginate(query);
    return db.$transaction(async (tx) => {
      const conversation = query.conversationId ? await findMemberConversation(tx, query.conversationId, user.id) : null;
      const membership = {
        BUYER: { buyerId: user.id },
        SELLER: { listing: { sellerId: user.id } },
      };
      const where: Prisma.ReservationWhereInput = {
        AND: [
          query.role ? membership[query.role] : { OR: Object.values(membership) },
          conversation ? { listingId: conversation.listingId, buyerId: conversation.buyerId } : {},
          { state: query.state },
        ],
      };
      const whereOpen = { AND: [where, { state: { in: [...openReservationStates] } }] };
      const whereClosed = { AND: [where, { state: { notIn: [...openReservationStates] } }] };
      const [total, openCount] = await Promise.all([
        tx.reservation.count({ where }),
        tx.reservation.count({ where: whereOpen }),
      ]);
      const fragment = { include: viewInclude(user.id), orderBy: newestFirst };
      const open = paging.skip < openCount ? await tx.reservation.findMany({
        ...fragment, where: whereOpen, skip: paging.skip, take: paging.take,
      }) : [];
      const closed = open.length < paging.take ? await tx.reservation.findMany({
        ...fragment,
        where: whereClosed,
        skip: Math.max(0, paging.skip - openCount),
        take: paging.take - open.length,
      }) : [];
      return pageResult([...open, ...closed].map(reservationDto), total, paging);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async get(req: Request, id: string) {
    const user = await requireStudent(req);
    return reservationDto(await findMemberReservation(db, id, user.id));
  }

  async change(req: Request, id: string, input: ReservationAction) {
    const actor = await requireStudent(req, undefined, false);
    return db.$transaction(async (tx) => {
      const source = await findMemberReservation(tx, id, actor.id);
      await lockUsers(tx, [source.buyerId, source.listing.sellerId]);
      await lockListings(tx, [source.listingId]);
      await requireStudent(req, tx);
      const reservation = await findMemberReservation(tx, id, actor.id);
      checkTransition(reservation, actor.id, input.action);

      const { listingId, buyerId, listing: { sellerId }, state: currentState } = reservation;
      const nextState = {
        ACCEPT: 'ACCEPTED', REJECT: 'REJECTED', CANCEL: 'CANCELLED', COMPLETE: 'COMPLETED',
      } as const;
      const state = nextState[input.action];
      const update: Prisma.ReservationUncheckedUpdateInput = { state };
      if (input.action === 'ACCEPT') {
        const listing = await tx.listing.findUniqueOrThrow({ where: { id: listingId }, include: listingWithSeller });
        if (listing.state !== 'AVAILABLE' || !isPublicListing(listing)) stateConflict('Món này không còn nhận yêu cầu giữ.');
        Object.assign(update, await appointmentData(tx, buyerId, sellerId, input));
        const competing = await tx.reservation.findMany({
          where: { listingId, id: { not: id }, state: 'PENDING' },
          select: { id: true, buyerId: true },
        });
        await tx.reservation.updateMany({
          where: { id: { in: competing.map((item) => item.id) } },
          data: { state: 'REJECTED' },
        });
        for (const other of competing) await notifyReservation(tx, other.id, other.buyerId, 'REJECTED');
        await tx.listing.update({ where: { id: listingId }, data: { state: 'RESERVED' } });
      }
      if (input.action === 'CANCEL' && currentState === 'ACCEPTED') {
        await tx.listing.update({ where: { id: listingId }, data: { state: 'AVAILABLE' } });
      }
      if (input.action === 'COMPLETE') {
        update.completedAt = new Date();
        await tx.listing.update({ where: { id: listingId }, data: { state: 'SOLD' } });
      }

      const changed = await tx.reservation.update({ where: { id }, data: update, include: viewInclude(actor.id) });
      await notifyReservation(tx, id, actor.id === buyerId ? sellerId : buyerId, state);
      return reservationDto(changed);
    });
  }
}
