import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { Request, Response, NextFunction } from "express";
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
    Number(process.env.API_PORT || 3001),
    process.env.API_HOST || "127.0.0.1",
  );
}
if (require.main === module) void start();
