import { resolve } from "node:path";

export const appOrigin = new URL(
  process.env.APP_ORIGIN || "http://127.0.0.1:3000",
).origin;
export const uploadDir = resolve(
  process.env.UPLOAD_DIR || resolve(__dirname, "../../uploads"),
);
export function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32)
    throw Error("JWT_SECRET cần ít nhất 32 ký tự");
  return value;
}
