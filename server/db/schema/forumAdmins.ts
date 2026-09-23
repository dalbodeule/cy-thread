import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { forums } from './forums';
import { users } from './users';

export const forumAdmins = sqliteTable(
  'forum_admins',
  {
    forumId: integer('forum_id')
      .notNull()
      .references(() => forums.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('admin'), // owner | admin | mod
  },
  (t) => ({
    pk: primaryKey({ columns: [t.forumId, t.userId], name: 'forum_admins_pk' }),
  })
);
