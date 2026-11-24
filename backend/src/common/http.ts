import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import Ajv, { AnySchemaObject, ValidateFunction } from "ajv";
import formats from "ajv-formats";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { appOrigin } from "./settings";
import { resolve } from "node:path";

const codes: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "STATE_CONFLICT",
  410: "TOKEN_EXPIRED",
  413: "FILE_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "INVALID_VALUE",
  429: "RATE_LIMITED",
  503: "UNAVAILABLE",
};
@Catch()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const http = error instanceof HttpException;
    const status = http ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = http ? error.getResponse() : undefined;
    const info =
      typeof raw === "object"
        ? (raw as { code?: string; message?: string; fields?: unknown })
        : undefined;
    const message =
      info?.message ||
      (http ? error.message : "Hệ thống gặp lỗi khi xử lý yêu cầu.");
    if (!http)
      console.error(
        "API_ERROR",
        error instanceof Error ? error.name : typeof error,
      );
    if (res.headersSent) return;
    const req = host.switchToHttp().getRequest<Request>();
    if (req.path.startsWith("/api/v1/auth/google") && req.headers.accept?.includes("text/html")) {
      const reason = status === 403 ? "Email Google chưa xác minh hoặc không thuộc miền trường." :
        status === 503 ? "Đăng nhập Google hiện chưa khả dụng." : "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn.";
      res.status(status).type("html").send('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đăng nhập UniSwap</title><main><h1>Đăng nhập UniSwap</h1><p>'+reason+'</p><a href="'+appOrigin+'/login">Quay lại đăng nhập</a></main></html>');
      return;
    }
    res
      .status(status)
      .json({
        code: info?.code ?? codes[status] ?? "INTERNAL_ERROR",
        message,
        ...(info?.fields ? { fields: info.fields } : {}),
      });
  }
}

type Param = {
  in: string;
  name: string;
  required?: boolean;
  schema: AnySchemaObject;
};
type Operation = {
  parameters?: Param[];
  requestBody?: { content: Record<string, { schema: AnySchemaObject }> };
};
type Spec = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, AnySchemaObject> };
};
type Rule = {
  query?: ValidateFunction;
  params?: ValidateFunction;
  body?: ValidateFunction;
};
@Injectable()
export class Contract implements NestInterceptor {
  private rules = new Map<string, Rule>();
  constructor() {
    const spec = parse(
      readFileSync(resolve(__dirname, "../../../docs/openapi.yaml"), "utf8"),
    ) as Spec;
    const validator = (coerceTypes: boolean) => {
      const ajv = formats(
        new Ajv({ strict: false, coerceTypes, allErrors: false }),
      );
      ajv.addFormat("password", true);
      ajv.addSchema({ $id: "contract", components: spec.components });
      return (s: AnySchemaObject) =>
        ajv.compile(
          JSON.parse(
            JSON.stringify(s).replaceAll(
              '"#/components/',
              '"contract#/components/',
            ),
          ),
        );
    };
    const data = validator(false),
      params = validator(true);
    for (const [path, methods] of Object.entries(spec.paths))
      for (const [method, op] of Object.entries(methods)) {
        const rule: Rule = {};
        for (const source of ["query", "path"]) {
          const fields = op.parameters?.filter((p) => p.in === source) ?? [];
          const schema = {
            type: "object",
            properties: Object.fromEntries(
              fields.map((p) => [p.name, p.schema]),
            ),
            required: fields.filter((p) => p.required).map((p) => p.name),
            additionalProperties: source === "query" && path === "/auth/google/callback",
          };
          if (source === "query") rule.query = params(schema);
          else rule.params = params(schema);
        }
        const body = op.requestBody?.content["application/json"]?.schema;
        if (body) rule.body = data(body);
        this.rules.set(
          method.toUpperCase() + " /api/v1" + path.replace(/\{(\w+)\}/g, ":$1"),
          rule,
        );
      }
  }
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const rule = this.rules.get(req.method + " " + req.route.path);
    if (rule)
      for (const key of ["params", "query", "body"] as const) {
        // Express 5 trả một object mới mỗi lần đọc query. Controller tự chuyển số.
        const validate = rule[key];
        if (validate && !validate(req[key])) {
          const err = validate.errors?.[0];
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Dữ liệu gửi lên không hợp lệ.",
            fields: {
              [err?.instancePath.slice(1) || key]: "Kiểm tra giá trị đã nhập.",
            },
          });
        }
      }
    return next.handle();
  }
}
