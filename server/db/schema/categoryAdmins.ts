import { pgTable, integer, text, primaryKey } from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { users } from "./users";

export const categoryAdmins = pgTable("category_admins", {
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("admin") // admin | mod
}, (t) => ({
    pk: primaryKey({ columns: [t.categoryId, t.userId], name: "category_admins_pk" })
}));
