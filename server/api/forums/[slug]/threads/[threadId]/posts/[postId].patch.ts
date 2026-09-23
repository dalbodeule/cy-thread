import { and, eq } from 'drizzle-orm';
import { forumAdmins, forums, posts, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import linkInlineAttachments from '~~/server/utils/linkInlineAttachments';

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const postId = Number(getRouterParam(event, 'postId'));
  const body = await readBody<{ body?: unknown }>(event);
  const markdown = typeof body?.body === 'string' ? body.body.trim() : '';
  if (
    !slug ||
    !Number.isInteger(userId) ||
    userId < 1 ||
    !Number.isInteger(threadId) ||
    threadId < 1 ||
    !Number.isInteger(postId) ||
    postId < 1
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community, thread, or post' });
  }
  if (!markdown || markdown.length > 20_000)
    throw createError({
      statusCode: 400,
      statusMessage: 'Post must contain 1 to 20000 characters',
    });

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [forum, thread, post] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.slug, slug) }),
    db.query.threads.findFirst({ where: eq(threads.id, threadId) }),
    db.query.posts.findFirst({
      where: and(eq(posts.id, postId), eq(posts.threadId, threadId), eq(posts.isDeleted, false)),
    }),
  ]);
  if (
    !forum ||
    forum.visibility !== 'public' ||
    !thread ||
    thread.forumId !== forum.id ||
    thread.isDeleted ||
    !post
  ) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' });
  }
  const moderator =
    forum.ownerUserId === userId ||
    Boolean(
      await db.query.forumAdmins.findFirst({
        where: and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, userId)),
      })
    );
  if (post.authorUserId !== userId && !moderator)
    throw createError({ statusCode: 403, statusMessage: 'You cannot edit this post' });
  if (thread.isLocked && !moderator)
    throw createError({ statusCode: 423, statusMessage: 'This thread is locked' });

  await db
    .update(posts)
    .set({
      markdown,
      htmlSanitized: `<p>${escapeHtml(markdown).replace(/\r\n?|\n/g, '<br>')}</p>`,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));
  await linkInlineAttachments(db, markdown, { forumId: forum.id, authorUserId: userId, postId });
  return { id: postId, updated: true };
});
