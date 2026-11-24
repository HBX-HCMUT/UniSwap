import { Asset, Prisma } from "@prisma/client";

export const summaryInclude = {
  category: { select: { name: true } },
  seller: {
    select: {
      id: true,
      displayName: true,
      schoolId: true,
      receivedReviews: { select: { rating: true } },
    },
  },
  assets: { orderBy: { position: "asc" } },
} satisfies Prisma.ListingInclude;
export const asAsset = ({ id, purpose }: Pick<Asset, "id" | "purpose">) => ({
  id,
  purpose,
  url: "/api/v1/assets/" + id,
});
type Row = Prisma.ListingGetPayload<{ include: typeof summaryInclude }>;
export function asSummary(row: Row) {
  const {
    id,
    categoryId,
    schoolId,
    area,
    title,
    description,
    price,
    condition,
    state,
    moderation,
    createdAt,
    seller,
    assets,
  } = row;
  const reviewCount = seller.receivedReviews.length;
  const total = seller.receivedReviews.reduce((sum, r) => sum + r.rating, 0);
  return {
    id,
    categoryId,
    categoryName: row.category.name,
    schoolId,
    area,
    title,
    description,
    price,
    condition,
    state,
    moderation,
    createdAt,
    images: assets.map(asAsset),
    seller: {
      id: seller.id,
      displayName: seller.displayName,
      schoolId: seller.schoolId,
      reviewCount,
      averageRating: reviewCount
        ? Math.round((total * 10) / reviewCount) / 10
        : null,
    },
  };
}
