import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Prisma, type AssetPurpose } from "@prisma/client";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { optionalUser } from "../../common/auth";
import { requireStudent } from "../reservations/market-request";
import { db } from "../../common/db";
import { limit } from "../../common/limits";
import { asAsset } from "./presentation";
import { openImage, openPrivateBlob, removeImage, storeImage } from "./asset-storage";
import { decodeImage, imageLimit, issueImageUpload, stagedImageKey, verifyImageUpload } from "./asset-upload";

@Controller("assets")
export class AssetsController {
  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: imageLimit, files: 1, fields: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("purpose") purpose: AssetPurpose,
    @Req() req: Request,
  ) {
    const user = await requireStudent(req);
    limit("upload:" + user.id, 120);
    if (!file || !["LISTING", "PAYMENT_QR"].includes(purpose))
      throw new BadRequestException("Chọn một ảnh và mục đích sử dụng.");
    return this.saveImage(user.id, purpose, file.buffer, file.mimetype);
  }

  @Post("upload-ticket")
  async uploadTicket(@Body("purpose") purpose: AssetPurpose, @Req() req: Request) {
    const user = await requireStudent(req);
    limit("upload:" + user.id, 120);
    return issueImageUpload(user.id, purpose);
  }

  @Post("upload-complete")
  async uploadComplete(@Body("ticket") ticket: string, @Req() req: Request) {
    const user = await requireStudent(req);
    const { id, purpose } = verifyImageUpload(ticket, user.id);
    const where = { id, ownerId: user.id, purpose };
    const existing = await db.asset.findFirst({ where });
    if (existing) return asAsset(existing);
    const key = stagedImageKey(id);
    const staged = await openPrivateBlob(key);
    if (!staged) {
      const committed = await db.asset.findFirst({ where });
      if (committed) return asAsset(committed);
      throw new NotFoundException("Chưa tìm thấy ảnh đã tải lên.");
    }
    if (staged.blob.size > imageLimit) {
      await staged.stream.cancel();
      throw new PayloadTooLargeException("Mỗi ảnh tối đa 5 MiB.");
    }
    const input = Buffer.from(await new globalThis.Response(staged.stream).arrayBuffer());
    try {
      const saved = await this.saveImage(user.id, purpose, input, staged.blob.contentType, id);
      await removeImage(key);
      return saved;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const committed = await db.asset.findFirst({ where });
        if (committed) return asAsset(committed);
      }
      throw error;
    }
  }

  private async saveImage(ownerId: string, purpose: AssetPurpose, input: Buffer, contentType: string, id?: string) {
    const { bytes, format } = await decodeImage(input, contentType);
    const objectKey = randomUUID() + "." + format;
    const mime = "image/" + format;
    await storeImage(objectKey, bytes, mime);
    try {
      return asAsset(
        await db.asset.create({
          data: {
            id,
            ownerId,
            purpose,
            objectKey,
            mime,
            bytes: bytes.length,
          },
        }),
      );
    } catch (error) {
      await removeImage(objectKey);
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
    const data = await openImage(asset.objectKey);
    if (!data) throw new NotFoundException("Không tìm thấy ảnh.");
    res.type(asset.mime);
    await pipeline(data, res);
  }
}
