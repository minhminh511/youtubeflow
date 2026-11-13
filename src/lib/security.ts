import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "tubeflow_workspace";
export const OAUTH_COOKIE = "tubeflow_oauth";
export const sessionHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const secureCookie = (request: NextRequest) => request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase().replace(/:$/, "") === "https";

function encryptionKey() {
  const secret = process.env.YOUTUBE_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error("missing_config");
  return createHash("sha256").update(secret).digest();
}

export function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

export function decrypt<T>(value: string): T {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("invalid_token");
  const [iv, tag, data] = parts.map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")) as T;
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertSameOrigin(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new Error("forbidden");
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
  if (new URL(origin).host !== host && origin !== request.nextUrl.origin && origin !== process.env.APP_URL?.replace(/\/$/, "")) {
    throw new Error("forbidden");
  }
}
