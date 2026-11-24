import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import nodemailer from "nodemailer";
import { db } from "../../common/db";
import { createSession } from "../../common/auth";
import { limit } from "../../common/limits";
import { appOrigin } from "../../common/settings";
import { me } from "../users/profiles";

export function studentEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  const domains = (process.env.STUDENT_EMAIL_DOMAINS || "student.example.test")
    .toLowerCase()
    .split(",")
    .map((d) => d.trim());
  if (!domains.includes(email.split("@")[1]))
    throw new BadRequestException(
      "Vui lòng dùng email thuộc miền sinh viên của trường.",
    );
  return email;
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
async function sendVerification(id: string, email: string) {
  const token = randomBytes(32).toString("hex");
  await db.verificationToken.create({
    data: {
      userId: id,
      tokenHash: digest(token),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });
  try {
    await nodemailer
      .createTransport(process.env.SMTP_URL || "smtp://127.0.0.1:51025")
      .sendMail({
        from:
          process.env.SMTP_FROM || "UniSwap <no-reply@uniswap.example.test>",
        to: email,
        subject: "Xác thực email UniSwap",
        text:
          "Mở liên kết sau và bấm xác nhận trong vòng 30 phút để xác thực email của bạn.\n" +
          appOrigin +
          "/verify?token=" +
          token,
      });
  } catch {
    throw new ServiceUnavailableException(
      "Hộp thư tạm thời gián đoạn. Bạn có thể yêu cầu gửi lại thư.",
    );
  }
}
export async function register(
  input: { email: string; password: string; displayName: string },
  req: Request,
) {
  const email = studentEmail(input.email);
  limit("register:" + req.ip, 24);
  if (!input.displayName.trim())
    throw new BadRequestException("Vui lòng nhập tên hiển thị.");
  const hash = await argon2.hash(input.password, { type: argon2.argon2id });
  const { count } = await db.user.createMany({
    data: [
      { email, passwordHash: hash, displayName: input.displayName.trim() },
    ],
    skipDuplicates: true,
  });
  if (count) {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    await sendVerification(user.id, email);
  }
  return { ok: true };
}
export async function resend(raw: string, req: Request) {
  const email = studentEmail(raw);
  limit("resend:" + req.ip, 20);
  limit("resend:" + email, 4);
  const user = await db.user.findFirst({
    where: { email, status: "ACTIVE", verifiedAt: null },
  });
  if (user) await sendVerification(user.id, email);
  return { ok: true };
}
export async function verify(token: string) {
  await db.$transaction(async (tx) => {
    const value = await tx.verificationToken.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!value)
      throw new GoneException("Liên kết xác thực không còn hiệu lực.");
    const updated = await tx.user.updateMany({
      where: { id: value.userId, verifiedAt: null },
      data: { verifiedAt: new Date() },
    });
    const consumed = await tx.verificationToken.updateMany({
      where: { id: value.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!updated.count || !consumed.count)
      throw new GoneException("Liên kết đã dùng hoặc hết hạn.");
  });
  return { ok: true };
}
export async function login(
  input: { email: string; password: string },
  req: Request,
  res: Response,
) {
  const email = input.email.toLowerCase().trim();
  limit("login:" + req.ip, 160);
  limit("login:" + req.ip + ":" + email, 40);
  const user = await db.user.findUnique({ where: { email } });
  if (
    !user?.passwordHash ||
    !(await argon2.verify(user.passwordHash, input.password))
  )
    throw new UnauthorizedException("Email hoặc mật khẩu không đúng.");
  if (!user.verifiedAt || user.status !== "ACTIVE")
    throw new ForbiddenException("Tài khoản chưa xác thực hoặc đã bị khóa.");
  await createSession(res, user);
  return me(user);
}
