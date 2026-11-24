import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/auth";
import { db } from "../../common/db";
import { me, publicProfile } from "./profiles";

@Controller()
export class UsersController {
  @Get("users/:id")
  public(@Param("id") id: string) {
    return publicProfile(id);
  }
  @Get("me")
  async self(@Req() req: Request) {
    return me(await requireUser(req));
  }
  @Patch("me")
  async edit(
    @Req() req: Request,
    @Body()
    data: {
      displayName?: string;
      area?: string;
      schoolId?: string;
      contact?: string;
    },
  ) {
    const user = await requireUser(req);
    if (
      data.schoolId &&
      !(await db.school.count({ where: { id: data.schoolId } }))
    )
      throw new BadRequestException("Trường đã chọn không tồn tại.");
    if (
      (data.displayName !== undefined && !data.displayName.trim()) ||
      (data.area !== undefined && !data.area.trim())
    )
      throw new BadRequestException("Tên hoặc khu vực cần có nội dung.");
    return me(await db.user.update({ where: { id: user.id }, data }));
  }
}
