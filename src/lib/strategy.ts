import "server-only";
import { db } from "@/db";
import { competitors, contentPillars } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { fetchChannel, getAccessToken, getStudioVideos } from "@/lib/youtube";
import type { ContentPillar, GeneratedIdea } from "@/lib/types";

export async function listPillars(workspaceId: string): Promise<ContentPillar[]> {
  const rows = await db.select().from(contentPillars).where(eq(contentPillars.workspaceId, workspaceId)).orderBy(desc(contentPillars.createdAt));
  return rows.map((row) => ({ id: row.id, name: row.name, description: row.description, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
}

export async function listCompetitors(workspaceId: string) {
  const rows = await db.select().from(competitors).where(eq(competitors.workspaceId, workspaceId)).orderBy(desc(competitors.lastSyncedAt));
  return rows.map((row) => ({ id: row.id, handle: row.handle, channelId: row.channelId, title: row.title, thumbnail: row.thumbnail, subscribers: row.subscribers, views: row.views, videoCount: row.videoCount, lastSyncedAt: row.lastSyncedAt.toISOString(), createdAt: row.createdAt.toISOString() }));
}

export async function fetchCompetitor(accessToken: string, handle: string) {
  const cleaned = handle.trim().replace(/^https?:\/\/(www\.)?youtube\.com\//, "").replace(/^@/, "").replace(/\/.*$/, "");
  if (!cleaned) throw new Error("invalid_handle");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  if (cleaned.startsWith("UC") && cleaned.length >= 20) url.search = new URLSearchParams({ id: cleaned, part: "snippet,statistics", maxResults: "1" }).toString();
  else url.search = new URLSearchParams({ forHandle: `@${cleaned}`, part: "snippet,statistics", maxResults: "1" }).toString();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "reconnect" : "google_api");
  const data = await response.json() as { items?: { id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } }; statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string } }[] };
  const channel = data.items?.[0];
  if (!channel?.id || !channel.snippet?.title) throw new Error("channel_not_found");
  return {
    handle: `@${cleaned}`,
    channelId: channel.id,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails?.default?.url || null,
    subscribers: channel.statistics?.subscriberCount || "0",
    views: channel.statistics?.viewCount || "0",
    videoCount: channel.statistics?.videoCount || "0",
  };
}

export async function syncCompetitor(workspaceId: string, handle: string) {
  const accessToken = await getAccessToken(workspaceId);
  const info = await fetchCompetitor(accessToken, handle);
  const values = { ...info, lastSyncedAt: new Date() };
  const [saved] = await db.insert(competitors).values({ workspaceId, ...values }).onConflictDoUpdate({
    target: [competitors.workspaceId, competitors.channelId],
    set: { handle: values.handle, title: values.title, thumbnail: values.thumbnail, subscribers: values.subscribers, views: values.views, videoCount: values.videoCount, lastSyncedAt: values.lastSyncedAt },
  }).returning();
  return saved;
}

const SHORT_TEMPLATES = [
  { title: "3 điều bạn chưa biết về {topic}", hook: "Mở đầu bằng sự thật gây bất ngờ trong 3 giây đầu." },
  { title: "Sai lầm phổ biến khi {topic}", hook: "Chỉ ra lỗi khán giả đang mắc và cách sửa ngay." },
  { title: "So sánh nhanh: {topic} — nên chọn cách nào?", hook: "Đưa ra hai lựa chọn và kết luận trong 30 giây." },
  { title: "Mẹo {topic} trong 60 giây", hook: "Demo trực tiếp, không cần giải thích dài." },
  { title: "Hỏi đáp nhanh về {topic}", hook: "Trả lời câu hỏi khán giả hay hỏi nhất." },
];
const LONG_TEMPLATES = [
  { title: "Hướng dẫn toàn diện về {topic} cho người mới", hook: "Mở đầu bằng kết quả khán giả sẽ đạt được." },
  { title: "Câu chuyện đằng sau {topic}", hook: "Bắt đầu bằng khoảnh khắc bước ngoặt." },
  { title: "Phân tích chuyên sâu: {topic} có thực sự hiệu quả?", hook: "Đưa ra bằng chứng và ví dụ thực tế." },
  { title: "Lộ trình 30 ngày để thành thạo {topic}", hook: "Chia nhỏ thành các bước dễ làm theo." },
  { title: "Những điều không ai nói về {topic}", hook: "Chia sẻ góc nhìn ít người biết." },
];

export async function generateIdeas(workspaceId: string): Promise<GeneratedIdea[]> {
  const [pillars, videos] = await Promise.all([listPillars(workspaceId), getStudioVideos(workspaceId).catch(() => [])]);
  const ideas: GeneratedIdea[] = [];
  const topVideos = [...videos].sort((a, b) => Number(b.viewCount) - Number(a.viewCount)).slice(0, 3);
  for (const video of topVideos) {
    ideas.push({ title: `Phần 2: ${video.title}`, format: "video", hook: "Tiếp nối video được xem nhiều nhất, đào sâu phần khán giả hỏi nhiều nhất.", reason: `Video "${video.title}" đang dẫn đầu kênh với ${Number(video.viewCount).toLocaleString("vi-VN")} lượt xem.`, pillarId: null });
    ideas.push({ title: `Tóm tắt 60 giây: ${video.title}`, format: "short", hook: "Chắt lọc điểm giá trị nhất thành một Shorts.", reason: "Tái sử dụng nội dung đã được chứng minh hiệu quả.", pillarId: null });
  }
  const topics = pillars.length ? pillars.map((pillar) => ({ name: pillar.name, pillarId: pillar.id })) : [{ name: "chủ đề kênh của bạn", pillarId: null }];
  for (const topic of topics) {
    const short = SHORT_TEMPLATES[ideas.length % SHORT_TEMPLATES.length];
    const long = LONG_TEMPLATES[ideas.length % LONG_TEMPLATES.length];
    ideas.push({ title: short.title.replace("{topic}", topic.name), format: "short", hook: short.hook, reason: `Thuộc trụ cột "${topic.name}".`, pillarId: topic.pillarId });
    ideas.push({ title: long.title.replace("{topic}", topic.name), format: "video", hook: long.hook, reason: `Thuộc trụ cột "${topic.name}".`, pillarId: topic.pillarId });
  }
  if (videos.length === 0 && pillars.length === 0) {
    ideas.push({ title: "Video đầu tiên: giới thiệu kênh và điều khán giả sẽ nhận được", format: "video", hook: "Nói rõ giá trị kênh trong 30 giây đầu.", reason: "Video giới thiệu giúp khán giả mới hiểu kênh của bạn.", pillarId: null });
    ideas.push({ title: "5 điều tôi sẽ chia sẻ trên kênh này", format: "short", hook: "Liệt kê nhanh, tạo kỳ vọng cho khán giả.", reason: "Video ngắn giới thiệu nội dung kênh.", pillarId: null });
  }
  return ideas.slice(0, 12);
}

export async function ownChannelSnapshot(workspaceId: string) {
  const accessToken = await getAccessToken(workspaceId);
  return fetchChannel(accessToken);
}
