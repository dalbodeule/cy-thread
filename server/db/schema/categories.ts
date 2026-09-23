import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { forums } from "./forums";

export const categories = pgTable("categories", {
    id: serial("id").primaryKey(),
    forumId: integer("forum_id").notNull().references(() => forums.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
