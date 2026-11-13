import "server-only";
import { db } from "@/db";
import { studioVideos, youtubeConnections } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireConfiguration } from "@/lib/config";
import { decrypt, encrypt } from "@/lib/security";
import type { StudioVideo, VideoAnalyticsRow, VideoComment } from "@/lib/types";

export const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"];
export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
export const YOUTUBE_MONETARY_SCOPE = "https://www.googleapis.com/auth/yt-analytics-monetary.readonly";
export interface Tokens { accessToken: string; refreshToken: string; expiresAt: number; scope?: string }
export interface OAuthState { nonce: string; verifier: string; workspaceId: string; expiresAt: number; scopes: string[] }
interface GoogleChannel {
  id: string;
  snippet: { title: string; thumbnails?: { default?: { url?: string } } };
  statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}
interface GoogleVideo {
  id: string;
  snippet?: { title?: string; description?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } }; tags?: string[]; categoryId?: string; publishedAt?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  status?: { privacyStatus?: string; publishAt?: string; madeForKids?: boolean };
  contentDetails?: { duration?: string };
}

async function googleGet<T>(url: URL, accessToken: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "reconnect" : "google_api");
  return response.json() as Promise<T>;
}

export async function fetchChannel(accessToken: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.search = new URLSearchParams({ mine: "true", part: "snippet,statistics,contentDetails", maxResults: "1" }).toString();
  const data = await googleGet<{ items?: GoogleChannel[] }>(url, accessToken);
  const channel = data.items?.[0];
  if (!channel?.id || !channel.snippet?.title) throw new Error("no_channel");
  return {
    channelId: channel.id,
    title: channel.snippet.title,
    thumbnail: channel.snippet.thumbnails?.default?.url || null,
    subscribers: channel.statistics?.subscriberCount || "0",
    views: channel.statistics?.viewCount || "0",
    videoCount: channel.statistics?.videoCount || "0",
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || null,
  };
}

export async function storeConnection(workspaceId: string, tokens: Tokens) {
  const channel = await fetchChannel(tokens.accessToken);
  const { uploadsPlaylistId: _uploadsPlaylistId, ...publicChannel } = channel;
  const values = { ...publicChannel, encryptedTokens: encrypt(tokens), updatedAt: new Date() };
  await db.insert(youtubeConnections).values({ workspaceId, ...values }).onConflictDoUpdate({ target: youtubeConnections.workspaceId, set: { ...values, connectedAt: new Date() } });
}

export async function getTokenInfo(workspaceId: string): Promise<{ accessToken: string; scope: string }> {
  const configuration = requireConfiguration();
  const [connection] = await db.select().from(youtubeConnections).where(eq(youtubeConnections.workspaceId, workspaceId)).limit(1);
  if (!connection) throw new Error("not_connected");
  let tokens: Tokens;
  try { tokens = decrypt<Tokens>(connection.encryptedTokens); } catch { throw new Error("reconnect"); }
  if (tokens.expiresAt > Date.now() + 60000) return { accessToken: tokens.accessToken, scope: tokens.scope || "" };
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: configuration.clientId, client_secret: configuration.clientSecret, grant_type: "refresh_token", refresh_token: tokens.refreshToken }),
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(response.status === 400 || response.status === 401 ? "reconnect" : "google_api");
  const refreshed = await response.json() as { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string };
  if (!refreshed.access_token) throw new Error("reconnect");
  const next: Tokens = { accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token || tokens.refreshToken, expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000, scope: refreshed.scope || tokens.scope || "" };
  await db.update(youtubeConnections).set({ encryptedTokens: encrypt(next) }).where(eq(youtubeConnections.workspaceId, workspaceId));
  return { accessToken: next.accessToken, scope: next.scope || "" };
}

export async function getAccessToken(workspaceId: string) {
  return (await getTokenInfo(workspaceId)).accessToken;
}

function mapVideo(video: GoogleVideo) {
  return {
    youtubeVideoId: video.id,
    title: video.snippet?.title || "Video không có tiêu đề",
    description: video.snippet?.description || "",
    thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || null,
    privacyStatus: video.status?.privacyStatus || "public",
    publishAt: video.status?.publishAt ? new Date(video.status.publishAt) : video.snippet?.publishedAt ? new Date(video.snippet.publishedAt) : null,
    duration: video.contentDetails?.duration || null,
    viewCount: video.statistics?.viewCount || "0",
    likeCount: video.statistics?.likeCount || "0",
    commentCount: video.statistics?.commentCount || "0",
    tags: video.snippet?.tags || [],
    categoryId: video.snippet?.categoryId || null,
    madeForKids: video.status?.madeForKids || false,
  };
}

export async function fetchVideoDetails(accessToken: string, videoIds: string[]) {
  const videos: GoogleVideo[] = [];
  for (let index = 0; index < videoIds.length; index += 50) {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.search = new URLSearchParams({ id: videoIds.slice(index, index + 50).join(","), part: "snippet,statistics,status,contentDetails" }).toString();
    const data = await googleGet<{ items?: GoogleVideo[] }>(url, accessToken);
    videos.push(...(data.items || []));
  }
  return videos;
}

export async function syncStudioVideos(workspaceId: string) {
  const accessToken = await getAccessToken(workspaceId);
  const channel = await fetchChannel(accessToken);
  if (!channel.uploadsPlaylistId) throw new Error("google_api");
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    const params = new URLSearchParams({ playlistId: channel.uploadsPlaylistId, part: "contentDetails", maxResults: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    url.search = params.toString();
    const data = await googleGet<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }>(url, accessToken);
    for (const item of data.items || []) if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < 200);
  const videos = await fetchVideoDetails(accessToken, ids.slice(0, 200));
  const now = new Date();
  for (const video of videos) {
    const values = { ...mapVideo(video), lastSyncedAt: now, updatedAt: now };
    await db.insert(studioVideos).values({ workspaceId, ...values }).onConflictDoUpdate({
      target: [studioVideos.workspaceId, studioVideos.youtubeVideoId],
      set: { title: values.title, description: values.description, thumbnail: values.thumbnail, privacyStatus: values.privacyStatus, publishAt: values.publishAt, duration: values.duration, viewCount: values.viewCount, likeCount: values.likeCount, commentCount: values.commentCount, tags: values.tags, categoryId: values.categoryId, madeForKids: values.madeForKids, lastSyncedAt: now, updatedAt: now },
    });
  }
  return getStudioVideos(workspaceId);
}

export async function getStudioVideos(workspaceId: string): Promise<StudioVideo[]> {
  const rows = await db.select().from(studioVideos).where(eq(studioVideos.workspaceId, workspaceId)).orderBy(desc(studioVideos.publishAt));
  return rows.map((row) => ({
    id: row.id, youtubeVideoId: row.youtubeVideoId, title: row.title, description: row.description, thumbnail: row.thumbnail,
    privacyStatus: row.privacyStatus, publishAt: row.publishAt?.toISOString() || null, duration: row.duration,
    viewCount: row.viewCount, likeCount: row.likeCount, commentCount: row.commentCount, tags: row.tags,
    categoryId: row.categoryId, madeForKids: row.madeForKids, localStatus: row.localStatus, planId: row.planId,
    localNotes: row.localNotes, lastSyncedAt: row.lastSyncedAt.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  }));
}

export interface UploadInput { title: string; description: string; privacyStatus: string; publishAt: Date | null; fileName: string; contentType: string; size: number; file: File; format: string }

const UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024;

export async function uploadVideo(workspaceId: string, input: UploadInput) {
  const { accessToken, scope } = await getTokenInfo(workspaceId);
  if (!scope.split(" ").includes(YOUTUBE_UPLOAD_SCOPE)) throw new Error("upload_scope_required");
  const description = input.format === "short" && !input.description.includes("#Shorts") ? `${input.description}\n\n#Shorts` : input.description;
  const initiateUrl = new URL("https://www.googleapis.com/upload/youtube/v3/videos");
  initiateUrl.search = new URLSearchParams({ uploadType: "resumable", part: "snippet,status" }).toString();
  const status: Record<string, unknown> = { privacyStatus: input.privacyStatus, selfDeclaredMadeForKids: false };
  if (input.publishAt) status.publishAt = input.publishAt.toISOString();
  const initiate = await fetch(initiateUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Upload-Content-Type": input.contentType, "X-Upload-Content-Length": String(input.size) },
    body: JSON.stringify({ snippet: { title: input.title, description, tags: [], categoryId: "22" }, status }),
    cache: "no-store", signal: AbortSignal.timeout(20000),
  });
  const sessionUri = initiate.headers.get("location");
  if (!initiate.ok || !sessionUri) throw new Error(initiate.status === 401 || initiate.status === 403 ? "reconnect" : "upload_failed");
  // Stream the file in 8MB chunks so large videos never sit fully in memory.
  let video: { id?: string } = {};
  for (let start = 0; start < input.size; start += UPLOAD_CHUNK_SIZE) {
    const end = Math.min(start + UPLOAD_CHUNK_SIZE, input.size) - 1;
    const chunk = await input.file.slice(start, end + 1).arrayBuffer();
    const upload = await fetch(sessionUri, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": input.contentType, "Content-Range": `bytes ${start}-${end}/${input.size}`, "Content-Length": String(chunk.byteLength) },
      body: chunk,
      cache: "no-store", signal: AbortSignal.timeout(300000),
    });
    if (upload.status === 308) continue;
    if (!upload.ok) throw new Error(upload.status === 401 || upload.status === 403 ? "reconnect" : "upload_failed");
    video = await upload.json() as { id?: string };
    break;
  }
  if (!video.id) throw new Error("upload_failed");
  const details = await fetchVideoDetails(accessToken, [video.id]);
  if (details[0]) {
    const values = { ...mapVideo(details[0]), lastSyncedAt: new Date(), updatedAt: new Date() };
    await db.insert(studioVideos).values({ workspaceId, ...values }).onConflictDoUpdate({
      target: [studioVideos.workspaceId, studioVideos.youtubeVideoId],
      set: { title: values.title, description: values.description, thumbnail: values.thumbnail, privacyStatus: values.privacyStatus, publishAt: values.publishAt, duration: values.duration, viewCount: values.viewCount, likeCount: values.likeCount, commentCount: values.commentCount, tags: values.tags, categoryId: values.categoryId, madeForKids: values.madeForKids, lastSyncedAt: values.lastSyncedAt, updatedAt: values.updatedAt },
    });
  }
  return video.id;
}

export async function fetchComments(accessToken: string, videoId: string): Promise<VideoComment[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/comments");
  url.search = new URLSearchParams({ videoId, part: "snippet", maxResults: "50", order: "time", textFormat: "plainText" }).toString();
  const data = await googleGet<{ items?: { id: string; snippet?: { authorDisplayName?: string; authorChannelUrl?: string; textDisplay?: string; likeCount?: number; publishedAt?: string; updatedAt?: string; totalReplyCount?: number } }[] }>(url, accessToken);
  return (data.items || []).map((item) => ({
    id: item.id,
    author: item.snippet?.authorDisplayName || "Người xem ẩn danh",
    authorChannelUrl: item.snippet?.authorChannelUrl || null,
    text: item.snippet?.textDisplay || "",
    likeCount: item.snippet?.likeCount || 0,
    publishedAt: item.snippet?.publishedAt || "",
    updatedAt: item.snippet?.updatedAt || "",
    replyCount: item.snippet?.totalReplyCount || 0,
  }));
}

export async function fetchAnalyticsTotals(accessToken: string, startDate: string, endDate: string, metrics: string): Promise<number[]> {
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.search = new URLSearchParams({ ids: "channel==MINE", startDate, endDate, metrics }).toString();
  const data = await googleGet<{ rows?: (string | number)[][] }>(url, accessToken);
  const row = data.rows?.[0] || [];
  return row.map((value) => Number(value) || 0);
}

export async function fetchVideoAnalytics(accessToken: string): Promise<{ startDate: string; endDate: string; rows: VideoAnalyticsRow[] }> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.search = new URLSearchParams({ ids: "channel==MINE", startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained", dimensions: "video", sort: "-views", maxResults: "50" }).toString();
  const data = await googleGet<{ rows?: (string | number)[][] }>(url, accessToken);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    rows: (data.rows || []).map((row) => ({ videoId: String(row[0]), views: Number(row[1]) || 0, minutes: Number(row[2]) || 0, averageDuration: Number(row[3]) || 0, subscribers: Number(row[4]) || 0 })),
  };
}
