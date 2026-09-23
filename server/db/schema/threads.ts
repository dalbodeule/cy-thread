import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { forums } from "./forums";
import { categories } from "./categories";
import { users } from "./users";

export const threads = pgTable("threads", {
    id: serial("id").primaryKey(),
    forumId: integer("forum_id").notNull().references(() => forums.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    authorUserId: integer("author_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    lastPostAt: timestamp("last_post_at", { withTimezone: true }),
    isLocked: boolean("is_locked").notNull().default(false),
    isPinned: boolean("is_pinned").notNull().default(false)
});
