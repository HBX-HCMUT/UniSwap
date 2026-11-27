import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { logout } from "../../common/auth";
import * as accounts from "./account.service";
import { googleFinish, googleStart } from "./google.service";

@Controller("auth")
export class AuthController {
  @Post("register")
  @HttpCode(202)
  register(
    @Body() input: Parameters<typeof accounts.register>[0],
    @Req() req: Request,
  ) {
    return accounts.register(input, req);
  }
  @Post("resend")
  @HttpCode(202)
  resend(@Body("email") email: string, @Req() req: Request) {
    return accounts.resend(email, req);
  }
  @Post("verify")
  @HttpCode(200)
  verify(@Body("token") token: string) {
    return accounts.verify(token);
  }
  @Post("login")
  @HttpCode(200)
  login(
    @Body() input: Parameters<typeof accounts.login>[0],
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return accounts.login(input, req, res);
  }
  @Post("logout")
  @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return logout(req, res);
  }
  @Get("google")
  start(@Res() res: Response) {
    return googleStart(res);
  }
  @Get("google/callback")
  finish(
    @Req() req: Request,
    @Res() res: Response,
    @Query("code") code: string,
    @Query("state") state: string,
  ) {
    return googleFinish(req, res, code, state);
  }
}
