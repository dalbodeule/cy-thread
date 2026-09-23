import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { forums } from "./forums";
import { users } from "./users";

export const forumBans = pgTable("forum_bans", {
    forumId: integer("forum_id").notNull().references(() => forums.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (t) => ({
    pk: primaryKey({ columns: [t.forumId, t.userId], name: "forum_bans_pk" })
}));
