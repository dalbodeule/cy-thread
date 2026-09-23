import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const forums = pgTable("forums", {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    ownerUserId: integer("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    visibility: text("visibility").notNull().default("public"), // public | followers | admins
    cssCustom: text("css_custom"),
    settingsJson: text("settings_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
