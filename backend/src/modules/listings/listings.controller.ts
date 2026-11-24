import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { optionalUser } from "../../common/auth";
import { requireStudent } from "../reservations/market-request";
import * as listings from "./listings.service";

@Controller()
export class ListingsController {
  @Get("listings") search(@Query() q: listings.Search) {
    return listings.list(q);
  }
  @Get("me/listings") async mine(
    @Req() req: Request,
    @Query() q: listings.Search,
  ) {
    return listings.list(q, (await requireStudent(req)).id);
  }
  @Get("listings/:id") async detail(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return listings.detail(id, await optionalUser(req));
  }
  @Post("listings") add(
    @Req() req: Request,
    @Body() data: listings.ListingInput,
  ) {
    return listings.save(req, data);
  }
  @Put("listings/:id") edit(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() data: listings.ListingInput,
  ) {
    return listings.save(req, data, id);
  }
  @Patch("listings/:id/state") state(
    @Req() req: Request,
    @Param("id") id: string,
    @Body("action") action: "HIDE" | "SHOW" | "MARK_SOLD",
  ) {
    return listings.changeState(req, id, action);
  }
}
