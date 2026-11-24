import { Controller, Inject, Get, Param, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService, type NotificationsQuery } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: Request, @Query() query: NotificationsQuery) {
    return this.notifications.list(req, query);
  }

  @Put(':id/read')
  read(@Req() req: Request, @Param('id') id: string) {
    return this.notifications.read(req, id);
  }
}
