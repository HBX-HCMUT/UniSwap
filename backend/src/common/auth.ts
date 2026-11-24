import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { appOrigin, secret } from "./settings";

const cookieName = "uniswap_session";
const twoHours = 2 * 60 * 60 * 1000;
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: appOrigin.startsWith("https:"),
  path: "/",
};
export function cookie(req: Request, name: string) {
  return req.headers.cookie
    ?.split(";")
    .map((piece) => piece.trim())
    .find((piece) => piece.startsWith(name + "="))
    ?.slice(name.length + 1);
}
export function sessionId(req: Request) {
  const token = cookie(req, cookieName);
  if (token) {
    try {
      const claims = jwt.verify(token, secret(), {
        algorithms: ["HS256"],
        issuer: "uniswap",
      });
      if (typeof claims !== "string" && typeof claims.sid === "string")
        return claims.sid;
    } catch {
      /* Phiên hết hạn hoặc chữ ký không hợp lệ. */
    }
  }
  throw new UnauthorizedException("Bạn cần đăng nhập.");
}
export async function requireUser(
  req: Request,
  tx: Prisma.TransactionClient = db,
  touch = true,
) {
  const session = await tx.session.findUnique({
    where: { id: sessionId(req) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    throw new UnauthorizedException("Phiên đã hết hạn.");
  if (session.user.status !== "ACTIVE" || !session.user.verifiedAt)
    throw new ForbiddenException("Tài khoản chưa xác thực hoặc đã khóa.");
  if (touch)
    await tx.user.update({
      where: { id: session.userId },
      data: { lastActiveAt: new Date() },
    });
  return session.user;
}
export async function optionalUser(req: Request) {
  try {
    return await requireUser(req);
  } catch (error) {
    if (
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException
    )
      return null;
    throw error;
  }
}
export async function requireAdmin(
  req: Request,
  tx: Prisma.TransactionClient = db,
  touch = true,
) {
  const user = await requireUser(req, tx, touch);
  if (user.role !== "ADMIN")
    throw new ForbiddenException("Cần quyền quản trị.");
  return user;
}
export async function createSession(res: Response, user: User) {
  const session = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR NO KEY UPDATE`;
    const active = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (active.status !== "ACTIVE" || !active.verifiedAt)
      throw new ForbiddenException("Tài khoản chưa xác thực hoặc đã khóa.");
    return tx.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + twoHours) },
    });
  });
  res.cookie(
    cookieName,
    jwt.sign({ sid: session.id }, secret(), {
      algorithm: "HS256",
      issuer: "uniswap",
      expiresIn: "2h",
    }),
    { ...cookieOptions, maxAge: twoHours },
  );
}
export async function logout(req: Request, res: Response) {
  await requireUser(req);
  await db.session.update({
    where: { id: sessionId(req) },
    data: { revokedAt: new Date() },
  });
  res.clearCookie(cookieName, cookieOptions);
  return { ok: true };
}
