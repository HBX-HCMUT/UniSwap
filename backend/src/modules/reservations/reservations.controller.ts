import { Body, Controller, Inject, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ReservationsService, type ReservationAction, type ReservationQuery } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(@Inject(ReservationsService) private readonly reservations: ReservationsService) {}

  @Post()
  @HttpCode(200)
  create(@Req() req: Request, @Body() input: { listingId: string }) {
    return this.reservations.create(req, input.listingId);
  }

  @Get()
  list(@Req() req: Request, @Query() query: ReservationQuery) {
    return this.reservations.list(req, query);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.reservations.get(req, id);
  }

  @Patch(':id')
  change(@Req() req: Request, @Param('id') id: string, @Body() input: ReservationAction) {
    return this.reservations.change(req, id, input);
  }
}
