import { pgTable, integer, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { forums } from "./forums";
import { users } from "./users";

export const forumFollowers = pgTable("forum_followers", {
    forumId: integer("forum_id").notNull().references(() => forums.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("internal"), // internal | provider
    provider: text("provider"),
    providerUserId: text("provider_user_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (t) => ({
    pk: primaryKey({ columns: [t.forumId, t.userId], name: "forum_followers_pk" })
}));
