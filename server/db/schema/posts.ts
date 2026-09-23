import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { threads } from "./threads";
import { users } from "./users";

export const posts = pgTable("posts", {
    id: serial("id").primaryKey(),
    threadId: integer("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    authorUserId: integer("author_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    markdown: text("markdown").notNull(),
    htmlSanitized: text("html_sanitized").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    isDeleted: boolean("is_deleted").notNull().default(false)
});
