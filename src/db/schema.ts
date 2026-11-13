import { pgTable, pgEnum, uuid, text, varchar, timestamp, jsonb, date, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const planStatus = pgEnum("plan_status", ["idea", "planned", "published"]);
export const planFormat = pgEnum("plan_format", ["video", "short", "live"]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionHash: text("session_hash").notNull().unique(),
  name: varchar("name", { length: 80 }).notNull().default("Không gian của tôi"),
  completedSteps: jsonb("completed_steps").$type<number[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  format: planFormat("format").notNull().default("video"),
  status: planStatus("status").notNull().default("idea"),
  scheduledDate: date("scheduled_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const youtubeConnections = pgTable("youtube_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().unique().references(() => workspaces.id, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull(),
  title: text("title").notNull(),
  thumbnail: text("thumbnail"),
  subscribers: text("subscribers").notNull().default("0"),
  views: text("views").notNull().default("0"),
  videoCount: text("video_count").notNull().default("0"),
  encryptedTokens: text("encrypted_tokens").notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studioVideos = pgTable("studio_videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  youtubeVideoId: text("youtube_video_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  thumbnail: text("thumbnail"),
  privacyStatus: text("privacy_status").notNull().default("public"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  duration: text("duration"),
  viewCount: text("view_count").notNull().default("0"),
  likeCount: text("like_count").notNull().default("0"),
  commentCount: text("comment_count").notNull().default("0"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  categoryId: text("category_id"),
  madeForKids: boolean("made_for_kids").notNull().default(false),
  localStatus: text("local_status").notNull().default("published"),
  planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
  localNotes: text("local_notes").notNull().default(""),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("studio_videos_workspace_video_unique").on(table.workspaceId, table.youtubeVideoId)]);

export const contentPillars = pgTable("content_pillars", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const competitors = pgTable("competitors", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  handle: text("handle").notNull(),
  channelId: text("channel_id").notNull(),
  title: text("title").notNull(),
  thumbnail: text("thumbnail"),
  subscribers: text("subscribers").notNull().default("0"),
  views: text("views").notNull().default("0"),
  videoCount: text("video_count").notNull().default("0"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("competitors_workspace_channel_unique").on(table.workspaceId, table.channelId)]);

export const monetization = pgTable("monetization", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().unique().references(() => workspaces.id, { onDelete: "cascade" }),
  checklist: jsonb("checklist").$type<Record<string, boolean>>().notNull().default({}),
  revenueGoal: text("revenue_goal").notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const revenueEntries = pgTable("revenue_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 7 }).notNull(),
  amount: text("amount").notNull().default("0"),
  source: text("source").notNull().default("Quảng cáo"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uploads = pgTable("uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  privacyStatus: text("privacy_status").notNull().default("private"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  status: text("status").notNull().default("uploading"),
  youtubeVideoId: text("youtube_video_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
