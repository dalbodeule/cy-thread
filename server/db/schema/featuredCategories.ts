import { integer, sqliteTable, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { categories } from './categories';

export const featuredCategories = sqliteTable(
  'featured_categories',
  {
    rank: integer('rank').primaryKey(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    activityCount: integer('activity_count').notNull().default(0),
    refreshedAt: integer('refreshed_at').notNull(),
  },
  (table) => ({
    categoryUnique: uniqueIndex('featured_categories_category_idx').on(table.categoryId),
  })
);
