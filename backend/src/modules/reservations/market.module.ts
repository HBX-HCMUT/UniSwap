import { Module } from '@nestjs/common';
import { AdminController } from '../admin/admin.controller';
import { AdminService } from '../admin/admin.service';
import { ChatController } from '../chat/chat.controller';
import { ChatService } from '../chat/chat.service';
import { ModerationController } from '../moderation/moderation.controller';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { ReviewsController } from '../reviews/reviews.controller';
import { ReviewsService } from '../reviews/reviews.service';
import { SubscriptionsController } from '../subscriptions/subscriptions.controller';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  controllers: [
    ReservationsController,
    ChatController,
    ReviewsController,
    SubscriptionsController,
    NotificationsController,
    ModerationController,
    AdminController,
  ],
  providers: [
    ReservationsService, ChatService, ReviewsService, SubscriptionsService,
    NotificationsService, ModerationService, AdminService,
  ],
})
export class MarketModule {}
