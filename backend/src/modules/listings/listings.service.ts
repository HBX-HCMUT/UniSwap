import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ListingCondition, Prisma, User } from "@prisma/client";
import type { Request } from "express";
import { requireStudent } from "../reservations/market-request";
import { db } from "../../common/db";
import {
  lockListings,
  lockUsers,
  cancelOpenReservations,
} from "../reservations/reservation-state";
import { publishListing } from "../subscriptions/publication";
import { asSummary, summaryInclude } from "./presentation";

export interface ListingInput {
  title: string;
  description: string;
  area: string;
  price: number;
  condition: ListingCondition;
  categoryId: string;
  schoolId: string;
  imageIds: string[];
}
export interface Search {
  q?: string;
  sellerId?: string;
  categoryId?: string;
  schoolId?: string;
  area?: string;
  condition?: ListingCondition;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}
export async function list(query: Search, owner?: string) {
  const page = Number(query.page ?? 1),
    pageSize = Number(query.pageSize ?? 20);
  const floor =
    query.minPrice !== undefined ? Number(query.minPrice) : undefined;
  const ceiling =
    query.maxPrice !== undefined ? Number(query.maxPrice) : undefined;
  if (floor !== undefined && ceiling !== undefined && floor > ceiling)
    throw new BadRequestException("Giá tối thiểu vượt giá tối đa.");
  const contains = (value: string) => ({
    contains: value.replace(/[\\%_]/g, "\\$&"),
    mode: "insensitive" as const,
  });
  const where: Prisma.ListingWhereInput = owner
    ? { sellerId: owner }
    : {
        state: "AVAILABLE",
        moderation: "APPROVED",
        seller: { status: "ACTIVE" },
        sellerId: query.sellerId,
        schoolId: query.schoolId,
        categoryId: query.categoryId,
        condition: query.condition,
        price: { gte: floor, lte: ceiling },
        area: query.area ? contains(query.area) : undefined,
        OR: query.q
          ? [{ title: contains(query.q) }, { description: contains(query.q) }]
          : undefined,
      };
  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    query.sort?.startsWith("PRICE_")
      ? [{ price: query.sort === "PRICE_ASC" ? "asc" : "desc" }, { id: "asc" }]
      : [{ createdAt: "desc" }, { id: "asc" }];
  const total = await db.listing.count({ where });
  const items =
    (page - 1) * pageSize >= total
      ? []
      : await db.listing.findMany({
          where,
          include: summaryInclude,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        });
  return { items: items.map(asSummary), page, pageSize, total };
}
const publicWhere: Prisma.ListingWhereInput = {
  state: { not: "HIDDEN" },
  moderation: "APPROVED",
  seller: { status: "ACTIVE" },
};
export async function detail(id: string, viewer: User | null) {
  const row = await db.listing.findFirst({
    where: {
      id,
      ...(viewer?.role === "ADMIN"
        ? {}
        : { OR: [publicWhere, ...(viewer ? [{ sellerId: viewer.id }] : [])] }),
    },
    include: summaryInclude,
  });
  if (!row) throw new NotFoundException("Tin không còn hiển thị.");
  return asSummary(row);
}
function checkContent(input: ListingInput) {
  if (!input.title.trim() || !input.description.trim() || !input.area.trim())
    throw new BadRequestException(
      "Vui lòng nhập đủ tên món, mô tả và khu vực.",
    );
  const normalize = (s: string) =>
    s.normalize("NFC").toLocaleLowerCase("vi").trim();
  const text = normalize(input.title + " " + input.description);
  const words = (process.env.MODERATION_KEYWORDS || "hangcam-mau")
    .split(",")
    .map(normalize)
    .filter(Boolean);
  return words.some((w) => text.includes(w)) ? "PENDING" : "APPROVED";
}
async function owned(tx: Prisma.TransactionClient, id: string, userId: string) {
  await lockListings(tx, [id]);
  const row = await tx.listing.findUnique({ where: { id } });
  if (!row) throw new NotFoundException("Không tìm thấy tin.");
  if (row.sellerId !== userId)
    throw new ForbiddenException("Chỉ chủ tin được quản lý tin này.");
  if (row.moderation === "REMOVED")
    throw new ConflictException("Tin đã bị gỡ.");
  return row;
}
async function lockOwner(
  req: Request,
  tx: Prisma.TransactionClient,
  id: string,
) {
  await lockUsers(tx, [id]);
  return requireStudent(req, tx);
}
export async function save(req: Request, input: ListingInput, id?: string) {
  const actor = await requireStudent(req, db, false);
  return db.$transaction(async (tx) => {
    await lockOwner(req, tx, actor.id);
    const existing = id ? await owned(tx, id, actor.id) : null;
    if (existing && existing.state !== "AVAILABLE")
      throw new ConflictException("Chỉ sửa được tin còn bán.");
    const { imageIds, ...data } = input;
    const moderation = checkContent(input);
    const category = await tx.$queryRaw<
      { active: boolean }[]
    >`SELECT active FROM categories WHERE id=${input.categoryId}::uuid FOR SHARE`;
    if (
      !category[0]?.active ||
      !(await tx.school.count({ where: { id: input.schoolId } }))
    )
      throw new UnprocessableEntityException(
        "Danh mục hoặc trường đã chọn không khả dụng.",
      );
    const images = await tx.asset.findMany({ where: { id: { in: imageIds } } });
    if (
      images.length !== imageIds.length ||
      images.some(
        (a) =>
          a.ownerId !== actor.id ||
          a.purpose !== "LISTING" ||
          (a.listingId !== null && a.listingId !== id),
      )
    )
      throw new UnprocessableEntityException(
        "Ảnh phải thuộc bạn, dành cho tin đăng và còn khả dụng.",
      );
    const listing = existing
      ? await tx.listing.update({
          where: { id: existing.id },
          data: { ...data, moderation },
        })
      : await tx.listing.create({
          data: { ...data, sellerId: actor.id, moderation },
        });
    if (existing)
      await tx.asset.updateMany({
        where: { listingId: listing.id },
        data: { listingId: null, position: null },
      });
    for (const [position, image] of imageIds.entries())
      await tx.asset.update({
        where: { id: image },
        data: { listingId: listing.id, position },
      });
    if (moderation === "APPROVED") await publishListing(tx, listing);
    else if (existing) await cancelOpenReservations(tx, listing.id, actor.id);
    return asSummary(
      await tx.listing.findUniqueOrThrow({
        where: { id: listing.id },
        include: summaryInclude,
      }),
    );
  });
}
export async function changeState(
  req: Request,
  id: string,
  action: "HIDE" | "SHOW" | "MARK_SOLD",
) {
  const actor = await requireStudent(req, db, false);
  return db.$transaction(async (tx) => {
    await lockOwner(req, tx, actor.id);
    const row = await owned(tx, id, actor.id);
    if (
      action === "SHOW"
        ? row.state !== "HIDDEN" || row.moderation !== "APPROVED"
        : row.state !== "AVAILABLE"
    )
      throw new ConflictException("Trạng thái tin đã thay đổi.");
    const state = {
      HIDE: "HIDDEN",
      SHOW: "AVAILABLE",
      MARK_SOLD: "SOLD",
    } as const;
    const listing = await tx.listing.update({
      where: { id },
      data: { state: state[action] },
      include: summaryInclude,
    });
    if (action === "SHOW") await publishListing(tx, listing);
    else await cancelOpenReservations(tx, id, actor.id);
    return asSummary(listing);
  });
}
