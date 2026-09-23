import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";
import { forums } from "./forums";

export const attachments = pgTable("attachments", {
    id: serial("id").primaryKey(),
    forumId: integer("forum_id").notNull().references(() => forums.id, { onDelete: "cascade" }),
    postId: integer("post_id").references(() => posts.id, { onDelete: "set null" }),
    authorUserId: integer("author_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    r2Key: text("r2_key").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
});
