import { and, desc, eq, not, sql } from 'drizzle-orm';
import {
  categories,
  forumFollowers,
  forumMutes,
  forums,
  posts,
  threads,
  userBlocks,
  users,
} from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const limit = Math.min(50, Math.max(1, Number(getQuery(event).limit) || 30));
  return db
    .select({
      id: threads.id,
      title: threads.title,
      excerpt: sql<string>`coalesce((select substr(${posts.markdown}, 1, 240) from ${posts} where ${posts.threadId} = ${threads.id} and ${posts.isDeleted} = 0 order by ${posts.createdAt} asc limit 1), '')`,
      forumSlug: forums.slug,
      forumName: forums.name,
      category: categories.name,
      author: users.name,
      createdAt: threads.createdAt,
      lastPostAt: threads.lastPostAt,
    })
    .from(forumFollowers)
    .innerJoin(forums, eq(forumFollowers.forumId, forums.id))
    .innerJoin(threads, eq(threads.forumId, forums.id))
    .innerJoin(categories, eq(threads.categoryId, categories.id))
    .innerJoin(users, eq(threads.authorUserId, users.id))
    .where(
      and(
        eq(forumFollowers.userId, userId),
        eq(forums.visibility, 'public'),
        eq(threads.isDeleted, false),
        not(
          sql`exists (select 1 from ${forumMutes} where ${forumMutes.userId} = ${userId} and ${forumMutes.forumId} = ${forums.id})`
        ),
        not(
          sql`exists (select 1 from ${userBlocks} where ${userBlocks.blockerUserId} = ${userId} and ${userBlocks.blockedUserId} = ${users.id})`
        )
      )
    )
    .orderBy(desc(threads.lastPostAt), desc(threads.id))
    .limit(limit);
});
