import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

export const oauthAccounts = pgTable("oauth_accounts", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'google' | 'chzzk'
    providerUserId: text("provider_user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (t) => ({
    providerUserUniq: uniqueIndex("oauth_provider_user_uidx").on(t.provider, t.providerUserId)
}));
