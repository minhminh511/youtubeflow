export const GOOGLE_READ_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
] as const;

export function normalizeSetupUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return url.origin;
  } catch { return null; }
}

export function isQuickTunnelUrl(input: string): boolean {
  try { return new URL(input).hostname.endsWith(".trycloudflare.com"); }
  catch { return false; }
}

export function isLocalSetupUrl(input: string): boolean {
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(input).hostname); }
  catch { return false; }
}

export function setupEnvironmentTemplate(appUrl: string, generatedSecret = "") {
  const origin = normalizeSetupUrl(appUrl);
  if (!origin) throw new Error("URL ứng dụng chưa hợp lệ.");
  return [
    "# Điền Client ID và Client Secret từ cùng một OAuth Client Web application.",
    "# Các dòng để trống bên dưới PHẢI được điền trước khi kết nối.",
    "# Chỉ lưu ở máy chủ. Không commit hoặc gửi file này cho người khác.",
    "GOOGLE_CLIENT_ID=",
    "GOOGLE_CLIENT_SECRET=",
    `YOUTUBE_TOKEN_SECRET=${generatedSecret}`,
    `APP_URL=${origin}`,
    "# Giữ nguyên DATABASE_URL hiện có trong .env hoặc cấu hình máy chủ.",
    "",
  ].join("\n");
}

// Deliberately accepts no credential values. Safe to share with a deployer.
export function setupHandoff(appUrl: string) {
  const origin = normalizeSetupUrl(appUrl);
  if (!origin) throw new Error("URL ứng dụng chưa hợp lệ.");
  return `CHECKLIST KẾT NỐI YOUTUBE — TUBEFLOW\n\nTài liệu này không chứa Client ID, Client Secret hoặc khóa mã hóa.\n\n1. URL ứng dụng: ${origin}\nAuthorized redirect URI: ${origin}/api/youtube/callback\n\n2. Trong cùng một dự án Google Cloud, bật YouTube Data API v3 và YouTube Analytics API.\nhttps://console.cloud.google.com/apis/library\n\n3. Google Auth Platform:\n- Branding: tên TubeFlow, email hỗ trợ và liên hệ.\n- Audience: External nếu dùng Gmail cá nhân; thêm email quản lý kênh vào Test users khi đang Testing.\n- Data Access: thêm ${GOOGLE_READ_SCOPES.join(", ")}. Hai quyền đầu dùng để đọc dữ liệu; quyền youtube.upload dùng để đăng video từ TubeFlow.\n- Clients: tạo Web application và thêm đúng Authorized redirect URI ở trên.\nhttps://console.cloud.google.com/auth/overview\n\n4. Trong Environment Variables / Secrets của dịch vụ đang chạy TubeFlow (KHÔNG phải Google Cloud), thêm:\nGOOGLE_CLIENT_ID: Client ID thật của OAuth Client.\nGOOGLE_CLIENT_SECRET: Client Secret của cùng OAuth Client.\nYOUTUBE_TOKEN_SECRET: khóa ngẫu nhiên ít nhất 32 ký tự; giữ nguyên nếu đã có.\nAPP_URL: ${origin}\nGiữ nguyên DATABASE_URL. Không dùng NEXT_PUBLIC_ cho các biến này.\n\n5. Lưu biến đúng môi trường, triển khai lại / khởi động lại máy chủ.\nMở đúng URL ứng dụng ở trên, chọn Kiểm tra lại cấu hình, rồi Kết nối kênh.\n\nLưu ý: localhost chỉ dùng trên máy cá nhân. URL preview có thể đổi; ưu tiên tên miền triển khai ổn định. Các quyền Google chỉ được xác nhận thật sau khi hoàn tất OAuth.\n`;
}
