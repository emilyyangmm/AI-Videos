import { pgTable, serial, varchar, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

// 系统健康检查表
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 项目表
export const projects = pgTable(
	"projects",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		industry: varchar("industry", { length: 100 }).notNull(),
		industryAnalysis: jsonb("industry_analysis"),
		selectedWordRoots: jsonb("selected_word_roots"),
		selectedTopicId: varchar("selected_topic_id", { length: 36 }),
		status: varchar("status", { length: 20 }).default("draft").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("projects_status_idx").on(table.status),
		index("projects_created_at_idx").on(table.createdAt),
	]
);

// 词根组合推荐表
export const wordRoots = pgTable(
	"word_roots",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		projectId: varchar("project_id", { length: 36 }).notNull(),
		combination: jsonb("combination").notNull(),
		isSelected: boolean("is_selected").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("word_roots_project_id_idx").on(table.projectId),
	]
);

// 选题表
export const topics = pgTable(
	"topics",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		projectId: varchar("project_id", { length: 36 }).notNull(),
		title: text("title").notNull(),
		conflictPoint: text("conflict_point").notNull(),
		emotionHook: text("emotion_hook").notNull(),
		isSelected: boolean("is_selected").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("topics_project_id_idx").on(table.projectId),
	]
);

// 素材表
export const materials = pgTable(
	"materials",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		projectId: varchar("project_id", { length: 36 }).notNull(),
		type: varchar("type", { length: 20 }).notNull(),
		url: text("url"),
		fileKey: varchar("file_key", { length: 500 }),
		description: text("description"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("materials_project_id_idx").on(table.projectId),
	]
);

// 脚本表
export const scripts = pgTable(
	"scripts",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		projectId: varchar("project_id", { length: 36 }).notNull(),
		title: text("title").notNull(),
		duration: integer("duration").notNull(),
		persona: text("persona").notNull(),
		conflict: text("conflict").notNull(),
		emotionLine: text("emotion_line").notNull(),
		openingHook: jsonb("opening_hook").notNull(),
		middleContent: jsonb("middle_content").notNull(),
		endingGuide: jsonb("ending_guide").notNull(),
		shotList: jsonb("shot_list"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("scripts_project_id_idx").on(table.projectId),
	]
);

// 视频表
export const videos = pgTable(
	"videos",
	{
		id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
		projectId: varchar("project_id", { length: 36 }).notNull(),
		scriptId: varchar("script_id", { length: 36 }),
		status: varchar("status", { length: 20 }).default("pending").notNull(),
		veoOperationId: varchar("veo_operation_id", { length: 200 }),
		videoUrl: text("video_url"),
		duration: integer("duration"),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	},
	(table) => [
		index("videos_project_id_idx").on(table.projectId),
		index("videos_status_idx").on(table.status),
	]
);

// Zod schemas
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
	coerce: { date: true },
});

// Project schemas
export const insertProjectSchema = createCoercedInsertSchema(projects).pick({
	industry: true,
});

export const updateProjectSchema = createCoercedInsertSchema(projects)
	.pick({
		industryAnalysis: true,
		selectedWordRoots: true,
		selectedTopicId: true,
		status: true,
	})
	.partial();

// Topic schemas
export const insertTopicSchema = createCoercedInsertSchema(topics).pick({
	projectId: true,
	title: true,
	conflictPoint: true,
	emotionHook: true,
});

// Material schemas
export const insertMaterialSchema = createCoercedInsertSchema(materials).pick({
	projectId: true,
	type: true,
	url: true,
	fileKey: true,
	description: true,
});

// Script schemas
export const insertScriptSchema = createCoercedInsertSchema(scripts).pick({
	projectId: true,
	title: true,
	duration: true,
	persona: true,
	conflict: true,
	emotionLine: true,
	openingHook: true,
	middleContent: true,
	endingGuide: true,
	shotList: true,
});

// TypeScript types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;

export type WordRoot = typeof wordRoots.$inferSelect;

export type Topic = typeof topics.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;

export type Material = typeof materials.$inferSelect;
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;

export type Script = typeof scripts.$inferSelect;
export type InsertScript = z.infer<typeof insertScriptSchema>;

export type Video = typeof videos.$inferSelect;
