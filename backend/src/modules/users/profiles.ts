import { NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { db } from "../../common/db";

export async function profile(
  user: Pick<User, "id" | "schoolId" | "displayName">,
) {
  const { _avg, _count } = await db.review.aggregate({
    where: { targetId: user.id },
    _avg: { rating: true },
    _count: true,
  });
  return {
    id: user.id,
    schoolId: user.schoolId,
    displayName: user.displayName,
    averageRating:
      _avg.rating === null ? null : Math.round(_avg.rating * 10) / 10,
    reviewCount: _count,
  };
}
export async function publicProfile(id: string) {
  const user = await db.user.findFirst({ where: { id, status: "ACTIVE" } });
  if (!user) throw new NotFoundException("Không tìm thấy hồ sơ.");
  return profile(user);
}
export async function me(user: User) {
  return {
    ...(await profile(user)),
    email: user.email,
    role: user.role,
    area: user.area ?? undefined,
    contact: user.contact ?? undefined,
  };
}
