import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TubeFlow — Không gian sáng tạo",
    short_name: "TubeFlow",
    description: "Ghi lại ý tưởng, lên kế hoạch nội dung và kết nối kênh YouTube trong một không gian riêng của bạn.",
    lang: "vi",
    dir: "ltr",
    start_url: "/?view=overview&source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8f7fc",
    theme_color: "#f8f7fc",
    categories: ["productivity", "utilities"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Lịch nội dung", short_name: "Lịch", description: "Mở kế hoạch nội dung của bạn", url: "/?view=planner", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Kho ý tưởng", short_name: "Ý tưởng", description: "Mở những ý tưởng đã lưu", url: "/?view=ideas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
