import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { optionalUser } from "../../common/auth";
import { requireStudent } from "../reservations/market-request";
import { db } from "../../common/db";
import { limit } from "../../common/limits";
import { uploadDir } from "../../common/settings";
import { asAsset } from "./presentation";

@Controller("assets")
export class AssetsController {
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("purpose") purpose: "LISTING" | "PAYMENT_QR",
    @Req() req: Request,
  ) {
    const user = await requireStudent(req);
    limit("upload:" + user.id, 120);
    if (!file || !["LISTING", "PAYMENT_QR"].includes(purpose))
      throw new BadRequestException("Chọn một ảnh và mục đích sử dụng.");
    let bytes: Buffer, format: string;
    try {
      const decoder = sharp(file.buffer, {
        limitInputPixels: 32_000_000,
        failOn: "error",
      });
      format = (await decoder.metadata()).format || "";
      if (
        !["jpeg", "png", "webp"].includes(format) ||
        file.mimetype !== "image/" + format
      )
        throw Error("format");
      bytes = await decoder.rotate().toBuffer();
    } catch {
      throw new UnsupportedMediaTypeException(
        "Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ.",
      );
    }
    const objectKey = randomUUID() + "." + format;
    const path = join(uploadDir, objectKey);
    await mkdir(uploadDir, { recursive: true, mode: 0o700 });
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    try {
      return asAsset(
        await db.asset.create({
          data: {
            ownerId: user.id,
            purpose,
            objectKey,
            mime: "image/" + format,
            bytes: bytes.length,
          },
        }),
      );
    } catch (error) {
      await unlink(path);
      throw error;
    }
  }
  @Get(":id")
  async read(
    @Req() req: Request,
    @Res() res: Response,
    @Param("id") id: string,
  ) {
    const user = await optionalUser(req);
    const asset = await db.asset.findUnique({
      where: { id },
      include: {
        listing: { include: { seller: { select: { status: true } } } },
      },
    });
    let visible = asset && user?.id === asset.ownerId;
    if (asset && !visible) {
      if (asset.purpose === "LISTING") {
        const listing = asset.listing;
        visible =
          user?.role === "ADMIN" ||
          (!!listing &&
            listing.moderation === "APPROVED" &&
            listing.state !== "HIDDEN" &&
            listing.seller.status === "ACTIVE");
      } else if (user)
        visible = !!(await db.reservation.count({
          where: {
            qrAssetId: id,
            buyerId: user.id,
            state: { in: ["ACCEPTED", "COMPLETED"] },
          },
        }));
    }
    if (!asset || !visible) throw new NotFoundException("Không tìm thấy ảnh.");
    let data;
    try {
      data = await readFile(join(uploadDir, asset.objectKey));
    } catch {
      throw new NotFoundException("Không tìm thấy ảnh.");
    }
    res.type(asset.mime).send(data);
  }
}
