export const VIEWS = ["connections", "overview", "planner", "ideas", "analytics", "settings", "studio", "strategy", "monetization", "editor"] as const;
export type View = typeof VIEWS[number];
export function isView(value: unknown): value is View {
  return typeof value === "string" && VIEWS.some((view) => view === value);
}
export type EnvironmentKey = "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "YOUTUBE_TOKEN_SECRET" | "APP_URL";
export interface EnvironmentCheck {
  name: EnvironmentKey;
  label: string;
  configured: boolean;
  hint: string;
}
export interface PublicConfig {
  runtimeMode: "development" | "production" | "test";
  ready: boolean;
  appUrl: string;
  redirectUri: string;
  checks: EnvironmentCheck[];
}
export interface Plan {
  id: string;
  title: string;
  description: string;
  format: "video" | "short" | "live";
  status: "idea" | "planned" | "published";
  scheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
}
export type PlanInput = Pick<Plan, "title" | "description" | "format" | "status" | "scheduledDate">;
export interface Channel {
  channelId: string;
  title: string;
  thumbnail: string | null;
  subscribers: string;
  views: string;
  videoCount: string;
  connectedAt: string;
  updatedAt: string;
}
export interface StudioVideo {
  id: string;
  youtubeVideoId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  privacyStatus: string;
  publishAt: string | null;
  duration: string | null;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  tags: string[];
  categoryId: string | null;
  madeForKids: boolean;
  localStatus: string;
  planId: string | null;
  localNotes: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}
export interface UploadRecord {
  id: string;
  title: string;
  description: string;
  privacyStatus: string;
  publishAt: string | null;
  status: string;
  youtubeVideoId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface VideoComment {
  id: string;
  author: string;
  authorChannelUrl: string | null;
  text: string;
  likeCount: number;
  publishedAt: string;
  updatedAt: string;
  replyCount: number;
}
export interface VideoAnalyticsRow {
  videoId: string;
  views: number;
  minutes: number;
  averageDuration: number;
  subscribers: number;
}
export interface WorkspaceData {
  name: string;
  completedSteps: number[];
  plans: Plan[];
  channel: Channel | null;
  videos: StudioVideo[];
}
export interface ContentPillar {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
export interface Competitor {
  id: string;
  handle: string;
  channelId: string;
  title: string;
  thumbnail: string | null;
  subscribers: string;
  views: string;
  videoCount: string;
  lastSyncedAt: string;
  createdAt: string;
}
export interface GeneratedIdea {
  title: string;
  format: "video" | "short";
  hook: string;
  reason: string;
  pillarId: string | null;
}
export interface RevenueEntry {
  id: string;
  month: string;
  amount: string;
  source: string;
  note: string;
  createdAt: string;
}
export interface MonetizationData {
  connected: boolean;
  subscribers: string;
  watchHours: number;
  watchHoursEstimated: boolean;
  shortsViews: number;
  shortsEstimated: boolean;
  eligible: boolean;
  checklist: Record<string, boolean>;
  revenueGoal: string;
  revenue28Days: number | null;
  canRequestRevenue: boolean;
  entries: RevenueEntry[];
}
export interface AnalyticsData {
  startDate: string;
  endDate: string;
  rows: { day: string; views: number; minutes: number; subscribers: number }[];
}
