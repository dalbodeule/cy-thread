import { and, eq } from 'drizzle-orm';
import { categories, forumBans, forums, posts, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import linkInlineAttachments from '~~/server/utils/linkInlineAttachments';
import verifyHuman from '~~/server/utils/verifyHuman';

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
  const authorUserId = Number(session.user.id);
  if (!Number.isInteger(authorUserId) || authorUserId < 1) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in is required' });
  }

  const body = await readBody<{
    title?: unknown;
    body?: unknown;
    categorySlug?: unknown;
    turnstileToken?: unknown;
  }>(event);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.body === 'string' ? body.body.trim() : '';
  const categorySlug = typeof body?.categorySlug === 'string' ? body.categorySlug.trim() : '';
  if (!title || title.length > 120 || !content || content.length > 20_000 || !categorySlug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Enter a title, category, and body within the length limits',
    });
  }
  await verifyHuman(event, body?.turnstileToken);

  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Forum slug is required' });
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum || forum.visibility !== 'public') {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }

  const [category, ban] = await Promise.all([
    db.query.categories.findFirst({
      where: and(eq(categories.forumId, forum.id), eq(categories.slug, categorySlug)),
    }),
    db.query.forumBans.findFirst({
      where: and(eq(forumBans.forumId, forum.id), eq(forumBans.userId, authorUserId)),
    }),
  ]);
  if (!category)
    throw createError({ statusCode: 400, statusMessage: 'Choose a category in this community' });
  if (ban)
    throw createError({ statusCode: 403, statusMessage: 'You cannot post in this community' });

  const now = new Date();
  const [thread] = await db
    .insert(threads)
    .values({
      forumId: forum.id,
      categoryId: category.id,
      title,
      authorUserId,
      createdAt: now,
      lastPostAt: now,
    })
    .returning({ id: threads.id });
  if (!thread) throw createError({ statusCode: 500, statusMessage: 'Unable to create thread' });

  try {
    const [initialPost] = await db
      .insert(posts)
      .values({
        threadId: thread.id,
        authorUserId,
        markdown: content,
        htmlSanitized: `<p>${escapeHtml(content).replace(/\r\n?|\n/g, '<br>')}</p>`,
        createdAt: now,
      })
      .returning({ id: posts.id });
    if (!initialPost)
      throw createError({ statusCode: 500, statusMessage: 'Unable to create first post' });
    await linkInlineAttachments(db, content, {
      forumId: forum.id,
      authorUserId,
      postId: initialPost.id,
    });
  } catch (error) {
    await db.delete(threads).where(eq(threads.id, thread.id));
    throw error;
  }

  setResponseStatus(event, 201);
  return { id: thread.id };
});
