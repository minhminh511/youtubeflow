import "server-only";
import type { PublicConfig } from "@/lib/types";

export function getConfiguration(): PublicConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const tokenSecret = process.env.YOUTUBE_TOKEN_SECRET || "";
  const rawUrl = process.env.APP_URL?.trim() || "";
  let appUrl = "http://localhost:3000";
  let validUrl = false;
  try {
    const url = new URL(rawUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    validUrl = (url.protocol === "https:" || (local && url.protocol === "http:")) && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/";
    if (validUrl) appUrl = url.origin;
  } catch { /* An unset URL is reported as missing, not silently configured. */ }
  const checks = [
    { name: "GOOGLE_CLIENT_ID" as const, label: "Google Client ID", configured: clientId.endsWith(".apps.googleusercontent.com"), hint: "Client ID của OAuth Client loại Web application, kết thúc bằng .apps.googleusercontent.com." },
    { name: "GOOGLE_CLIENT_SECRET" as const, label: "Google Client Secret", configured: clientSecret.length > 0, hint: "Client Secret của cùng OAuth Client. Chỉ lưu trên máy chủ." },
    { name: "YOUTUBE_TOKEN_SECRET" as const, label: "YouTube Token Secret", configured: tokenSecret.length >= 32, hint: "Chuỗi ngẫu nhiên ít nhất 32 ký tự, dùng để mã hóa token." },
    { name: "APP_URL" as const, label: "App URL", configured: validUrl, hint: "URL gốc của ứng dụng, không có đường dẫn. Bản triển khai phải dùng HTTPS; localhost có thể dùng HTTP." },
  ];
  return { runtimeMode: process.env.NODE_ENV === "development" ? "development" : process.env.NODE_ENV === "test" ? "test" : "production", ready: checks.every((check) => check.configured), appUrl, redirectUri: `${appUrl}/api/youtube/callback`, checks };
}

export function requireConfiguration() {
  const configuration = getConfiguration();
  if (!configuration.ready) throw new Error("missing_config");
  return { ...configuration, clientId: process.env.GOOGLE_CLIENT_ID!.trim(), clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim() };
}
