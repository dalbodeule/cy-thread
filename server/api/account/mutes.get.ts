import { desc, eq } from 'drizzle-orm';
import { forumMutes, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const db = useDrizzle(event.context.cloudflare.env.DB);
  return db
    .select({
      id: forums.id,
      slug: forums.slug,
      name: forums.name,
      createdAt: forumMutes.createdAt,
    })
    .from(forumMutes)
    .innerJoin(forums, eq(forumMutes.forumId, forums.id))
    .where(eq(forumMutes.userId, Number(session.user.id)))
    .orderBy(desc(forumMutes.createdAt));
});
