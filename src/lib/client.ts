export async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin", headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  } catch {
    throw new Error(typeof navigator !== "undefined" && !navigator.onLine ? "Bạn đang ngoại tuyến. Nội dung chưa được lưu; hãy kết nối mạng rồi thử lại." : "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Không thể kết nối máy chủ. Vui lòng thử lại.");
  return data as T;
}
export const formatNumber = (value: string | number) => new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
export const formatDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
