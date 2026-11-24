import { BadRequestException, Body, Controller, Inject, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { PageQuery } from '../reservations/market-request';
import { ChatService } from './chat.service';

@Controller('conversations')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Post()
  @HttpCode(200)
  open(@Req() req: Request, @Body() input: { listingId: string }) {
    return this.chat.open(req, input.listingId);
  }

  @Get()
  list(@Req() req: Request, @Query() query: PageQuery) {
    return this.chat.list(req, query);
  }

  @Get(':id/messages')
  messages(@Req() req: Request, @Param('id') id: string, @Query() query: PageQuery) {
    return this.chat.messages(req, id, query);
  }

  @Post(':id/messages')
  send(@Req() req: Request, @Param('id') id: string, @Body() input: { text: string }) {
    const text = input.text.trim();
    if (!text) throw new BadRequestException('Tin nhắn cần có nội dung.');
    return this.chat.send(req, id, text);
  }
}
