import { and, asc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import {
  forumBans,
  forums,
  notifications,
  posts,
  threadSubscriptions,
  threads,
  users,
} from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import linkInlineAttachments from '~~/server/utils/linkInlineAttachments';
import verifyHuman from '~~/server/utils/verifyHuman';
import { requireForumCommentAccess, requireForumReadable } from '~~/server/utils/forumAccess';
import { findModerationKeyword, readForumAppearance } from '~~/server/utils/forumAppearance';

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
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const body = await readBody<{
    body?: unknown;
    parentPostId?: unknown;
    turnstileToken?: unknown;
    guestName?: unknown;
  }>(event);
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
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [forum, thread] = await Promise.all([
    db.query.forums.findFirst({ where: eq(forums.slug, slug) }),
    db.query.threads.findFirst({ where: eq(threads.id, threadId) }),
  ]);
  if (!forum || !thread || thread.forumId !== forum.id || thread.isDeleted) {
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  }
  await requireForumReadable(event, forum);
  const commentAccess = readForumAppearance(forum.settingsJson, forum.cssCustom).commentAccess;
  const appearance = readForumAppearance(forum.settingsJson, forum.cssCustom);
  if (findModerationKeyword(markdown, appearance.moderationKeywords)) {
    throw createError({
      statusCode: 422,
      statusMessage: '운영진 검토가 필요한 표현이 포함되어 있어 댓글을 등록할 수 없습니다.',
    });
  }
  const viewer = await requireForumCommentAccess(event, forum, commentAccess);
  await verifyHuman(event, body?.turnstileToken);
  const authorUserId = viewer?.userId ?? null;
  const guestIp = viewer
    ? null
    : getRequestHeader(event, 'cf-connecting-ip') ||
      getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      null;
  const guestName = viewer
    ? null
    : String(body?.guestName ?? '')
        .trim()
        .slice(0, 40) || '비회원';
  if (thread.isLocked)
    throw createError({ statusCode: 423, statusMessage: 'This thread is locked' });

  const ban = authorUserId
    ? await db.query.forumBans.findFirst({
        where: and(
          eq(forumBans.forumId, forum.id),
          eq(forumBans.userId, authorUserId),
          or(isNull(forumBans.expiresAt), gt(forumBans.expiresAt, new Date()))
        ),
      })
    : null;
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
      guestIp,
      guestName,
      markdown,
      htmlSanitized: `<p>${escapeHtml(markdown).replace(/\r\n?|\n/g, '<br>')}</p>`,
      createdAt: now,
    })
    .returning({ id: posts.id });
  if (!reply) throw createError({ statusCode: 500, statusMessage: 'Unable to create reply' });

  try {
    if (authorUserId)
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
  const recipients = new Set<number>(
    [Number(thread.authorUserId), Number(parent.authorUserId)].filter(
      (id) => Number.isInteger(id) && id > 0
    )
  );
  if (authorUserId) recipients.delete(authorUserId);
  const subscribers = await db
    .select({ userId: threadSubscriptions.userId })
    .from(threadSubscriptions)
    .where(eq(threadSubscriptions.threadId, threadId));
  for (const subscriber of subscribers) {
    if (Number(subscriber.userId) !== authorUserId) recipients.add(Number(subscriber.userId));
  }
  const mentionNames = [...markdown.matchAll(/@([\p{L}\p{N}_-]{2,40})/gu)].map(
    (match) => match[1]!
  );
  if (mentionNames.length) {
    const mentioned = await db
      .select({ id: users.id })
      .from(users)
      .where(
        sql`lower(${users.name}) in (${sql.join(
          mentionNames.map((name) => sql`lower(${name})`),
          sql`, `
        )})`
      );
    for (const user of mentioned)
      if (Number(user.id) !== authorUserId) recipients.add(Number(user.id));
  }
  if (recipients.size) {
    await db.insert(notifications).values(
      [...recipients].map((userId) => ({
        userId,
        actorUserId: authorUserId,
        forumId: forum.id,
        threadId,
        postId: reply.id,
        kind: mentionNames.length ? 'reply_or_mention' : 'reply',
        message: mentionNames.length
          ? '답글 또는 멘션이 도착했어요.'
          : '게시글에 새 답글이 달렸어요.',
        createdAt: now,
      }))
    );
  }
  setResponseStatus(event, 201);
  return { id: reply.id };
});
