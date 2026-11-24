import { Body, Controller, Inject, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { PageQuery } from '../reservations/market-request';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Post('reservations/:id/reviews')
  create(@Req() req: Request, @Param('id') id: string, @Body() input: { rating: number; comment?: string }) {
    return this.reviews.create(req, id, input);
  }

  @Get('users/:id/reviews')
  list(@Param('id') id: string, @Query() query: PageQuery) {
    return this.reviews.list(id, query);
  }
}
