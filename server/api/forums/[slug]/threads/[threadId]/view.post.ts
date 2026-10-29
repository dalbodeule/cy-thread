import { eq } from 'drizzle-orm';
import { forums, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import { requireForumReadable } from '~~/server/utils/forumAccess';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  if (!slug || !Number.isSafeInteger(threadId) || threadId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Forum or thread' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const session = await getUserSession(event);
  const sessionUserId = Number(session.user?.id);
  const userId = Number.isInteger(sessionUserId) && sessionUserId > 0 ? sessionUserId : -1;
  const updated = await event.context.cloudflare.env.DB.prepare(
    `UPDATE threads
     SET view_count = view_count + 1
     WHERE id = ? AND is_deleted = 0
       AND EXISTS (
         SELECT 1 FROM forums f
         WHERE f.id = threads.forum_id AND f.slug = ?
           AND (
             f.visibility = 'public'
             OR f.owner_user_id = ?
             OR EXISTS (
               SELECT 1 FROM forum_admins fa
               WHERE fa.forum_id = f.id AND fa.user_id = ?
             )
             OR EXISTS (
               SELECT 1 FROM forum_members fm
               WHERE fm.forum_id = f.id AND fm.user_id = ? AND fm.status = 'approved'
             )
             OR EXISTS (
               SELECT 1 FROM users u WHERE u.id = ? AND u.is_global_admin = 1
             )
           )
       )
     RETURNING view_count AS viewCount`
  )
    .bind(threadId, slug, userId, userId, userId, userId)
    .first<{ viewCount: number }>();

  if (!updated) {
    const [forum, thread] = await Promise.all([
      db.query.forums.findFirst({ where: eq(forums.slug, slug) }),
      db.query.threads.findFirst({ where: eq(threads.id, threadId) }),
    ]);
    if (!forum || !thread || thread.forumId !== forum.id || thread.isDeleted) {
      throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
    }
    await requireForumReadable(event, forum);
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  }

  return { viewCount: Number(updated.viewCount) };
});
