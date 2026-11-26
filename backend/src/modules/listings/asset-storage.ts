import { ServiceUnavailableException } from "@nestjs/common";
import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { uploadDir } from "../../common/settings";

export function cloudStorageToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new ServiceUnavailableException("Kho ảnh cloud chưa được cấu hình.");
  return token;
}

function useBlob() {
  return process.env.VERCEL === "1" || Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function openPrivateBlob(key: string) {
  const result = await get(key, { access: "private", token: cloudStorageToken() });
  return result?.statusCode === 200 ? result : null;
}

export async function storeImage(key: string, data: Buffer, mime: string, reuseExisting = false) {
  if (useBlob()) {
    await put(key, data, {
      contentType: mime,
      access: "private",
      token: cloudStorageToken(),
      allowOverwrite: reuseExisting,
    });
    return;
  }
  const path = join(uploadDir, key);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  try {
    await writeFile(path, data, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (!reuseExisting || (error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export async function openImage(key: string) {
  if (useBlob()) {
    const blob = await openPrivateBlob(key);
    return blob ? Readable.from(blob.stream) : null;
  }
  try {
    return Readable.from([await readFile(join(uploadDir, key))]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return null;
  }
}

export async function removeImage(key: string) {
  try {
    if (useBlob()) await del(key, { token: cloudStorageToken() });
    else await unlink(join(uploadDir, key));
  } catch {
    console.error("ASSET_CLEANUP_FAILED");
  }
}
