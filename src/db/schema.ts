import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () => text("created_at").default(sql`CURRENT_TIMESTAMP`);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const brands = sqliteTable(
  "brands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    ownerBrandId: text("owner_brand_id"),
    name: text("name").notNull(),
    aliases: text("aliases").default("[]"),
    website: text("website"),
    industry: text("industry"),
    autoTrack: integer("auto_track").notNull().default(0),
    trackFrequency: text("track_frequency").default("daily"),
    deletedAt: text("deleted_at"),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_brands_user").on(table.userId),
    index("idx_brands_owner").on(table.ownerBrandId),
  ],
);

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  name: text("name").notNull(),
});

export const prompts = sqliteTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    topicId: text("topic_id"),
    text: text("text").notNull(),
    status: text("status").notNull().default("active"),
    locale: text("locale").default("global"),
    createdAt: createdAt(),
  },
  (table) => [index("idx_prompts_brand").on(table.brandId)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("idx_tags_user_name").on(table.userId, table.name)],
);

export const promptTags = sqliteTable(
  "prompt_tags",
  {
    promptId: text("prompt_id").notNull(),
    tagId: text("tag_id").notNull(),
  },
  (table) => [primaryKey({ columns: [table.promptId, table.tagId] })],
);

export const trackingRuns = sqliteTable(
  "tracking_runs",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    startedAt: text("started_at").default(sql`CURRENT_TIMESTAMP`),
    finishedAt: text("finished_at"),
    status: text("status").notNull().default("running"),
    trigger: text("trigger").default("manual"),
    label: text("label"),
    totalExpected: integer("total_expected").notNull().default(0),
  },
  (table) => [index("idx_runs_brand").on(table.brandId)],
);

export const chats = sqliteTable(
  "chats",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    promptId: text("prompt_id").notNull(),
    brandId: text("brand_id").notNull(),
    platform: text("platform").notNull(),
    locale: text("locale").default("global"),
    isSimulated: integer("is_simulated").notNull().default(0),
    rawResponse: text("raw_response"),
    mentioned: integer("mentioned").notNull().default(0),
    position: integer("position"),
    sentiment: text("sentiment"),
    sentimentScore: real("sentiment_score"),
    brandsFound: text("brands_found").default("[]"),
    citedSources: text("cited_sources").default("[]"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (table) => [
    index("idx_chats_run").on(table.runId),
    index("idx_chats_brand").on(table.brandId),
    index("idx_chats_prompt").on(table.promptId),
  ],
);

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    domain: text("domain").notNull().unique(),
    type: text("type").notNull().default("other"),
  },
);

export const chatSources = sqliteTable(
  "chat_sources",
  {
    chatId: text("chat_id").notNull(),
    sourceId: text("source_id").notNull(),
    citationCount: integer("citation_count").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.sourceId] })],
);

export const recommendations = sqliteTable(
  "recommendations",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    runId: text("run_id"),
    category: text("category").notNull(),
    priority: text("priority").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    evidence: text("evidence"),
    basis: text("basis"),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (table) => [index("idx_recs_brand").on(table.brandId)],
);

export const discoveryItems = sqliteTable(
  "discovery_items",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    promptId: text("prompt_id"),
    platform: text("platform").notNull().default("reddit"),
    title: text("title").notNull(),
    url: text("url").notNull(),
    subreddit: text("subreddit"),
    score: integer("score").default(0),
    numComments: integer("num_comments").default(0),
    relevance: real("relevance").default(0),
    status: text("status").notNull().default("new"),
    foundAt: text("found_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_discovery_brand").on(table.brandId),
    uniqueIndex("idx_discovery_brand_url").on(table.brandId, table.url),
  ],
);

export const crawlAudits = sqliteTable(
  "crawl_audits",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    url: text("url").notNull(),
    result: text("result").notNull(),
    score: integer("score"),
    createdAt: createdAt(),
  },
);

export const contentScores = sqliteTable(
  "content_scores",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    label: text("label"),
    content: text("content").notNull(),
    features: text("features").notNull(),
    score: integer("score").notNull(),
    createdAt: createdAt(),
  },
);

export const contentBriefs = sqliteTable("content_briefs", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  promptId: text("prompt_id"),
  brief: text("brief").notNull(),
  createdAt: createdAt(),
});

export const alertRules = sqliteTable("alert_rules", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  type: text("type").notNull(),
  threshold: real("threshold").notNull(),
  enabled: integer("enabled").notNull().default(1),
});

export const alerts = sqliteTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    ruleId: text("rule_id"),
    message: text("message").notNull(),
    read: integer("read").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("idx_alerts_brand").on(table.brandId)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull(),
    token: text("token").notNull().unique(),
    snapshot: text("snapshot").notNull(),
    dateFrom: text("date_from"),
    dateTo: text("date_to"),
    createdAt: createdAt(),
  },
);

export const publicCheckCache = sqliteTable("public_check_cache", {
  cacheKey: text("cache_key").primaryKey(),
  result: text("result").notNull(),
  createdAt: createdAt(),
});

export const publicCheckLog = sqliteTable(
  "public_check_log",
  {
    id: text("id").primaryKey(),
    ip: text("ip").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("idx_pubcheck_ip").on(table.ip, table.createdAt)],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    label: text("label"),
    lastUsedAt: text("last_used_at"),
    createdAt: createdAt(),
  },
);

export const schema = {
  users,
  brands,
  topics,
  prompts,
  tags,
  promptTags,
  trackingRuns,
  chats,
  sources,
  chatSources,
  recommendations,
  discoveryItems,
  crawlAudits,
  contentScores,
  contentBriefs,
  alertRules,
  alerts,
  reports,
  publicCheckCache,
  publicCheckLog,
  apiKeys,
};
