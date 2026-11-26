import { BadRequestException, ForbiddenException, UnsupportedMediaTypeException } from "@nestjs/common";
import type { AssetPurpose } from "@prisma/client";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import { secret } from "../../common/settings";
import { cloudStorageToken } from "./asset-storage";

export const imageLimit = 5 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const audience = "uniswap-asset-upload";
const ticketLifetime = 10 * 60;

export function stagedImageKey(id: string) {
  return `incoming/${id}`;
}

export async function issueImageUpload(userId: string, purpose: AssetPurpose) {
  const id = randomUUID();
  const pathname = stagedImageKey(id);
  const clientToken = await generateClientTokenFromReadWriteToken({
    token: cloudStorageToken(),
    pathname,
    allowedContentTypes: imageTypes,
    maximumSizeInBytes: imageLimit,
    validUntil: Date.now() + ticketLifetime * 1000,
    ttlDays: 1,
  });
  const ticket = jwt.sign({ purpose }, secret(), {
    algorithm: "HS256",
    audience,
    subject: userId,
    jwtid: id,
    expiresIn: ticketLifetime,
  });
  return { pathname, clientToken, ticket };
}

export function verifyImageUpload(ticket: string, userId: string) {
  let claims;
  try {
    claims = jwt.verify(ticket, secret(), { algorithms: ["HS256"], audience });
  } catch {
    throw new BadRequestException("Phiên tải ảnh không hợp lệ hoặc đã hết hạn.");
  }
  if (typeof claims === "string" || !claims.jti ||
    (claims.purpose !== "LISTING" && claims.purpose !== "PAYMENT_QR")) {
    throw new BadRequestException("Phiên tải ảnh không hợp lệ.");
  }
  if (claims.sub !== userId) throw new ForbiddenException("Bạn không có quyền xác nhận ảnh này.");
  return { id: claims.jti, purpose: claims.purpose as AssetPurpose };
}

export async function decodeImage(input: Buffer, mime: string) {
  try {
    const decoder = sharp(input, { limitInputPixels: 32_000_000, failOn: "error" });
    const format = (await decoder.metadata()).format;
    if (!format || !imageTypes.includes(mime) || mime !== "image/" + format)
      throw Error("format");
    return { bytes: await decoder.rotate().toBuffer(), format };
  } catch {
    throw new UnsupportedMediaTypeException("Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ.");
  }
}
