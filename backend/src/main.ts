import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { Express, Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { Contract, Errors } from "./common/http";
import { appOrigin, secret } from "./common/settings";

export async function createApp() {
  secret();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== appOrigin
    )
      return res
        .status(403)
        .json({
          code: "FORBIDDEN",
          message: "Nguồn gửi yêu cầu không hợp lệ.",
        });
    next();
  });
  app.useGlobalFilters(new Errors());
  app.useGlobalInterceptors(new Contract());
  return app;
}
async function start() {
  const app = await createApp();
  await app.listen(
    Number(process.env.API_PORT || process.env.PORT || 3001),
    process.env.API_HOST || "127.0.0.1",
  );
}
let server: Promise<Express> | undefined;

export default async function handleRequest(req: Request, res: Response) {
  server ??= createApp().then(async (app) => {
    await app.init();
    return app.getHttpAdapter().getInstance() as Express;
  }).catch((error: unknown) => {
    server = undefined;
    throw error;
  });
  const express = await server;
  express(req, res);
}

if (require.main === module && process.env.VERCEL !== "1") void start();
