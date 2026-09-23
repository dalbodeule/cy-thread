import { and, asc, eq } from 'drizzle-orm';
import { forumBans, forums, posts, threads } from '~~/server/db/schema';
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

  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const body = await readBody<{ body?: unknown; parentPostId?: unknown; turnstileToken?: unknown }>(
    event
  );
  const markdown = String(body?.body ?? '').trim();
  if (!slug || !Number.isInteger(threadId) || threadId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or thread' });
  }
  if (!markdown || markdown.length > 20_000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Reply must contain 1 to 20000 characters',
    });
  }
  await verifyHuman(event, body?.turnstileToken);

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
  if (thread.isLocked)
    throw createError({ statusCode: 423, statusMessage: 'This thread is locked' });

  const ban = await db.query.forumBans.findFirst({
    where: and(eq(forumBans.forumId, forum.id), eq(forumBans.userId, authorUserId)),
  });
  if (ban)
    throw createError({ statusCode: 403, statusMessage: 'You cannot reply in this community' });

  const [starter] = await db
    .select({ id: posts.id, depth: posts.depth })
    .from(posts)
    .where(and(eq(posts.threadId, threadId), eq(posts.isDeleted, false)))
    .orderBy(asc(posts.createdAt), asc(posts.id))
    .limit(1);
  if (!starter) throw createError({ statusCode: 409, statusMessage: 'Thread has no starter post' });
  const parentPostId = body?.parentPostId == null ? starter.id : Number(body.parentPostId);
  if (!Number.isInteger(parentPostId) || parentPostId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid reply target' });
  }
  const parent = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, parentPostId),
      eq(posts.threadId, threadId),
      eq(posts.isDeleted, false)
    ),
  });
  if (!parent) throw createError({ statusCode: 404, statusMessage: 'Reply target not found' });
  if (parent.depth >= 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Replies are limited to two nested levels',
    });
  }

  const now = new Date();
  const [reply] = await db
    .insert(posts)
    .values({
      threadId,
      parentPostId,
      depth: parent.depth + 1,
      authorUserId,
      markdown,
      htmlSanitized: `<p>${escapeHtml(markdown).replace(/\r\n?|\n/g, '<br>')}</p>`,
      createdAt: now,
    })
    .returning({ id: posts.id });
  if (!reply) throw createError({ statusCode: 500, statusMessage: 'Unable to create reply' });

  try {
    await linkInlineAttachments(db, markdown, {
      forumId: forum.id,
      authorUserId,
      postId: reply.id,
    });
    await db.update(threads).set({ lastPostAt: now }).where(eq(threads.id, threadId));
  } catch (error) {
    await db.delete(posts).where(eq(posts.id, reply.id));
    throw error;
  }
  setResponseStatus(event, 201);
  return { id: reply.id };
});
