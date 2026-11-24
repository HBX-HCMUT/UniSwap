import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { UserStatus } from '@prisma/client';
import type { Request } from 'express';
import type { PageQuery } from '../reservations/market-request';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('users')
  users(@Req() req: Request, @Query() query: PageQuery & { q?: string }) {
    return this.admin.users(req, query);
  }

  @Patch('users/:id')
  changeUser(@Req() req: Request, @Param('id') id: string, @Body() input: { status: UserStatus; reason: string }) {
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('Cần nhập lý do đổi trạng thái.');
    return this.admin.changeUser(req, id, { ...input, reason });
  }

  @Get('categories')
  categories(@Req() req: Request) {
    return this.admin.categories(req);
  }

  @Post('categories')
  createCategory(@Req() req: Request, @Body() input: { name: string }) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Cần nhập tên danh mục.');
    return this.admin.createCategory(req, name);
  }

  @Patch('categories/:id')
  changeCategory(@Req() req: Request, @Param('id') id: string, @Body() input: { name?: string; active?: boolean }) {
    const name = input.name?.trim();
    if (name === '') throw new BadRequestException('Cần nhập tên danh mục.');
    return this.admin.changeCategory(req, id, { ...input, name });
  }

  @Get('stats')
  stats(@Req() req: Request, @Query() query: { from: string; to: string }) {
    return this.admin.stats(req, query);
  }
}
