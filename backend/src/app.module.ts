import { Module } from "@nestjs/common";
import { AuthController } from "./modules/auth/auth.controller";
import { UsersController } from "./modules/users/users.controller";
import { CatalogController } from "./modules/catalog/catalog.controller";
import { ListingsController } from "./modules/listings/listings.controller";
import { AssetsController } from "./modules/listings/assets.controller";
import { MarketModule } from "./modules/reservations/market.module";
@Module({
  imports: [MarketModule],
  controllers: [
    AuthController,
    UsersController,
    CatalogController,
    ListingsController,
    AssetsController,
  ],
})
export class AppModule {}
