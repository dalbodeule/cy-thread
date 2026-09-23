import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").unique(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    isGlobalAdmin: boolean("is_global_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
