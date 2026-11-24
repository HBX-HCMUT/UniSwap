import { BadRequestException, Body, Controller, Inject, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { ListingModeration, ReportReason, ReportState } from '@prisma/client';
import type { Request } from 'express';
import type { PageQuery } from '../reservations/market-request';
import { ModerationService } from './moderation.service';

@Controller()
export class ModerationController {
  constructor(@Inject(ModerationService) private readonly moderation: ModerationService) {}

  @Post('reports')
  report(@Req() req: Request, @Body() input: { listingId: string; reason: ReportReason; details?: string }) {
    return this.moderation.report(req, { ...input, details: input.details?.trim() || undefined });
  }

  @Get('admin/reports')
  reports(@Req() req: Request, @Query() query: PageQuery & { state?: ReportState }) {
    return this.moderation.reports(req, query);
  }

  @Patch('admin/reports/:id')
  changeReport(@Req() req: Request, @Param('id') id: string, @Body() input: { action: 'DISMISS' | 'REMOVE_LISTING'; reason: string }) {
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('Cần nhập lý do xử lý.');
    return this.moderation.changeReport(req, id, { ...input, reason });
  }

  @Get('admin/listings')
  listings(@Req() req: Request, @Query() query: PageQuery & { moderation?: ListingModeration }) {
    return this.moderation.listings(req, query);
  }

  @Patch('admin/listings/:id')
  changeListing(@Req() req: Request, @Param('id') id: string, @Body() input: { action: 'APPROVE' | 'REMOVE'; reason: string }) {
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('Cần nhập lý do xử lý.');
    return this.moderation.changeListing(req, id, { ...input, reason });
  }
}
