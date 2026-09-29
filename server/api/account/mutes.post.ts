import { and, eq } from 'drizzle-orm';
import { forumMutes, forums } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const body = await readBody<{ forumSlug?: unknown; muted?: unknown }>(event);
  const slug = typeof body?.forumSlug === 'string' ? body.forumSlug.trim() : '';
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Forum not found' });
  if (body?.muted === false) {
    await db
      .delete(forumMutes)
      .where(and(eq(forumMutes.userId, userId), eq(forumMutes.forumId, forum.id)));
  } else {
    await db.insert(forumMutes).values({ userId, forumId: forum.id }).onConflictDoNothing();
  }
  return { muted: body?.muted !== false };
});
