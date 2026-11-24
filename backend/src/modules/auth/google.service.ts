import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { cookie, cookieOptions, createSession } from "../../common/auth";
import { db } from "../../common/db";
import { secret, appOrigin } from "../../common/settings";
import { studentEmail } from "./account.service";

const random = () => randomBytes(32).toString("base64url");
function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL;
  if (!clientId || !clientSecret || !redirectUri)
    throw new ServiceUnavailableException(
      "Đăng nhập Google chưa được cấu hình.",
    );
  let issuer = "https://accounts.google.com";
  if (process.env.NODE_ENV === "test" && process.env.GOOGLE_OAUTH_ISSUER) {
    const fixture = new URL(process.env.GOOGLE_OAUTH_ISSUER);
    if (fixture.protocol !== "http:" || fixture.hostname !== "127.0.0.1")
      throw new Error("OAuth fixture cần dùng loopback.");
    issuer = fixture.origin;
  }
  return { issuer, clientId, clientSecret, redirectUri };
}
async function discovery(issuer: string) {
  const response = await fetch(issuer + "/.well-known/openid-configuration", {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new ServiceUnavailableException(
      "Không thể kết nối nhà cung cấp đăng nhập.",
    );
  const metadata = (await response.json()) as Record<string, string>;
  if (metadata.issuer !== issuer)
    throw new BadRequestException("Nhà phát hành danh tính không hợp lệ.");
  return metadata;
}
const tempCookie = "uniswap_google";
export async function googleStart(res: Response) {
  const { issuer, clientId, redirectUri } = config();
  const meta = await discovery(issuer),
    state = random(),
    nonce = random(),
    verifier = random();
  res.cookie(
    tempCookie,
    jwt.sign({ state, nonce, verifier }, secret(), {
      expiresIn: "10m",
      audience: "google-login",
    }),
    { ...cookieOptions, maxAge: 600000 },
  );
  const url = new URL(meta.authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  res.redirect(url.toString());
}
export async function googleFinish(
  req: Request,
  res: Response,
  code: string,
  state: string,
) {
  const { issuer, clientId, clientSecret, redirectUri } = config();
  const signed = cookie(req, tempCookie);
  res.clearCookie(tempCookie, cookieOptions);
  let context;
  try {
    context = jwt.verify(signed || "", secret(), {
      algorithms: ["HS256"],
      audience: "google-login",
    });
  } catch {
    throw new BadRequestException("Phiên đăng nhập Google không còn hiệu lực.");
  }
  if (typeof context === "string" || context.state !== state)
    throw new BadRequestException("Mã xác nhận phiên không khớp.");
  const meta = await discovery(issuer);
  const exchange = await fetch(meta.token_endpoint, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: context.verifier,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!exchange.ok)
    throw new BadRequestException("Mã đăng nhập không còn hiệu lực.");
  const token = (await exchange.json()) as { id_token: string };
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  let claims;
  try {
    const result = await jwtVerify(
      token.id_token,
      createRemoteJWKSet(new URL(meta.jwks_uri)),
      {
        algorithms: ["RS256"],
        issuer,
        audience: clientId,
        requiredClaims: ["exp", "iat", "sub", "nonce"],
      },
    );
    claims = result.payload;
  } catch {
    throw new BadRequestException(
      "Chữ ký hoặc thời hạn của danh tính không hợp lệ.",
    );
  }
  if (claims.nonce !== context.nonce)
    throw new BadRequestException("Mã xác nhận danh tính không khớp.");
  if (
    !claims.sub ||
    claims.email_verified !== true ||
    typeof claims.email !== "string"
  )
    throw new ForbiddenException("Google chưa xác minh email.");
  let email: string;
  try {
    email = studentEmail(claims.email);
  } catch {
    throw new ForbiddenException("Email Google phải thuộc miền sinh viên.");
  }
  const sub = claims.sub,
    displayName = String(claims.name || email.split("@")[0]).slice(0, 100);
  const user = await db.$transaction(async (tx) => {
    // Google xác nhận quyền sở hữu email. Loại mật khẩu đã đăng ký trước khi email được xác thực.
    await tx.user.createMany({
      data: [{ email, displayName, googleSub: sub, verifiedAt: new Date() }],
      skipDuplicates: true,
    });
    const existing = await tx.user.findUnique({ where: { email } });
    if (
      !existing ||
      (existing.googleSub && existing.googleSub !== sub) ||
      existing.status !== "ACTIVE"
    )
      throw new ForbiddenException("Không thể liên kết tài khoản này.");
    const changed = await tx.user.updateMany({
      where: { id: existing.id, OR: [{ googleSub: null }, { googleSub: sub }] },
      data: {
        googleSub: sub,
        verifiedAt: existing.verifiedAt ?? new Date(),
        ...(!existing.verifiedAt ? { passwordHash: null } : {}),
      },
    });
    if (!changed.count)
      throw new ForbiddenException("Danh tính đã liên kết với tài khoản khác.");
    return tx.user.findUniqueOrThrow({ where: { id: existing.id } });
  });
  await createSession(res, user);
  res.redirect(appOrigin + "/login?oauth=success");
}
