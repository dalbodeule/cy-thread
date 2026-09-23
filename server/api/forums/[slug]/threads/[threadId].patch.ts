import { and, asc, eq, isNull } from 'drizzle-orm';
import { categories, forumAdmins, forums, posts, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import linkInlineAttachments from '~~/server/utils/linkInlineAttachments';

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  );
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const body = await readBody<{ title?: unknown; body?: unknown; categorySlug?: unknown }>(event);
  if (
    !slug ||
    !Number.isInteger(userId) ||
    userId < 1 ||
    !Number.isInteger(threadId) ||
    threadId < 1
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or thread' });
  }
  const title = typeof body?.title === 'string' ? body.title.trim() : undefined;
  const markdown = typeof body?.body === 'string' ? body.body.trim() : undefined;
  const categorySlug =
    typeof body?.categorySlug === 'string' ? body.categorySlug.trim() : undefined;
  if (title !== undefined && (!title || title.length > 120)) {
    throw createError({ statusCode: 400, statusMessage: 'Title must contain 1 to 120 characters' });
  }
  if (markdown !== undefined && (!markdown || markdown.length > 20_000)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Body must contain 1 to 20000 characters',
    });
  }
  if (title === undefined && markdown === undefined && categorySlug === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Provide at least one field to update' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [forum, thread] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.slug, slug) }),
    db.query.threads.findFirst({ where: eq(threads.id, threadId) }),
  ]);
  if (
    !forum ||
    forum.visibility !== 'public' ||
    !thread ||
    thread.forumId !== forum.id ||
    thread.isDeleted
  ) {
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  }
  const isAuthor = thread.authorUserId === userId;
  const moderator =
    forum.ownerUserId === userId ||
    Boolean(
      await db.query.forumAdmins.findFirst({
        where: and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, userId)),
      })
    );
  if (!isAuthor && !moderator)
    throw createError({ statusCode: 403, statusMessage: 'You cannot edit this thread' });
  if (thread.isLocked && !moderator)
    throw createError({ statusCode: 423, statusMessage: 'This thread is locked' });

  const updates: { title?: string; categoryId?: number; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (title !== undefined) updates.title = title;
  if (categorySlug !== undefined) {
    const category = await db.query.categories.findFirst({
      where: and(eq(categories.forumId, forum.id), eq(categories.slug, categorySlug)),
    });
    if (!category)
      throw createError({ statusCode: 400, statusMessage: 'Choose a category in this community' });
    updates.categoryId = category.id;
  }
  await db
    .update(threads)
    .set(updates)
    .where(and(eq(threads.id, threadId), eq(threads.forumId, forum.id)));

  if (markdown !== undefined) {
    const [starter] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.threadId, threadId), isNull(posts.parentPostId)))
      .orderBy(asc(posts.createdAt), asc(posts.id))
      .limit(1);
    if (!starter)
      throw createError({ statusCode: 409, statusMessage: 'Thread has no starter post' });
    await db
      .update(posts)
      .set({
        markdown,
        htmlSanitized: `<p>${escapeHtml(markdown).replace(/\r\n?|\n/g, '<br>')}</p>`,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, starter.id));
    await linkInlineAttachments(db, markdown, {
      forumId: forum.id,
      authorUserId: userId,
      postId: starter.id,
    });
  }
  return { id: threadId, updated: true };
});
