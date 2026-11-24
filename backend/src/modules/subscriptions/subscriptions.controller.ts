import { Controller, Inject, Delete, Get, HttpCode, Param, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';

@Controller('me')
export class SubscriptionsController {
  constructor(@Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService) {}

  @Get('saved')
  saved(@Req() req: Request) {
    return this.subscriptions.saved(req);
  }

  @Put('favorites/:id')
  @HttpCode(204)
  favorite(@Req() req: Request, @Param('id') id: string) {
    return this.subscriptions.favorite(req, id, true);
  }

  @Delete('favorites/:id')
  @HttpCode(204)
  unfavorite(@Req() req: Request, @Param('id') id: string) {
    return this.subscriptions.favorite(req, id, false);
  }

  @Put('seller-follows/:id')
  @HttpCode(204)
  followSeller(@Req() req: Request, @Param('id') id: string) {
    return this.subscriptions.sellerFollow(req, id, true);
  }

  @Delete('seller-follows/:id')
  @HttpCode(204)
  unfollowSeller(@Req() req: Request, @Param('id') id: string) {
    return this.subscriptions.sellerFollow(req, id, false);
  }

  @Put('category-follows/:id')
  @HttpCode(204)
  followCategory(@Req() req: Request, @Param('id') id: string) {
    return this.subscriptions.categoryFollow(req, id, true);
  }

  @Delete('category-follows/:id')
  @HttpCode(204)
  unfollowCategory(@Req() req: Request, @Param('id') id: string) {
    return this.subscriptions.categoryFollow(req, id, false);
  }
}
