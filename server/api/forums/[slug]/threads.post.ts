import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { categories, forumBans, forums, posts, threads } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import linkInlineAttachments from '~~/server/utils/linkInlineAttachments';
import verifyHuman from '~~/server/utils/verifyHuman';
import { requireForumReadable } from '~~/server/utils/forumAccess';
import { normalizeThreadTags } from '~~/server/utils/threadTags';
import { findModerationKeyword, readForumAppearance } from '~~/server/utils/forumAppearance';
import { normalizePollOptions, normalizeThreadFormat } from '~~/server/utils/threadFormat';

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
    tags?: unknown;
    format?: unknown;
    pollOptions?: unknown;
    turnstileToken?: unknown;
  }>(event);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.body === 'string' ? body.body.trim() : '';
  const categorySlug = typeof body?.categorySlug === 'string' ? body.categorySlug.trim() : '';
  const tags = normalizeThreadTags(body?.tags);
  const format = normalizeThreadFormat(body?.format);
  const pollOptions = normalizePollOptions(body?.pollOptions);
  if (format === 'poll' && pollOptions.length < 2) {
    throw createError({ statusCode: 400, statusMessage: '투표 항목을 2개 이상 입력해 주세요.' });
  }
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
  if (!forum) {
    throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  }
  await requireForumReadable(event, forum);
  const matchedKeyword = findModerationKeyword(
    `${title}\n${content}`,
    readForumAppearance(forum.settingsJson, forum.cssCustom).moderationKeywords
  );
  if (matchedKeyword) {
    throw createError({
      statusCode: 422,
      statusMessage: '운영진 검토가 필요한 표현이 포함되어 있어 게시할 수 없습니다.',
    });
  }

  const [category, ban] = await Promise.all([
    db.query.categories.findFirst({
      where: and(eq(categories.forumId, forum.id), eq(categories.slug, categorySlug)),
    }),
    db.query.forumBans.findFirst({
      where: and(
        eq(forumBans.forumId, forum.id),
        eq(forumBans.userId, authorUserId),
        or(isNull(forumBans.expiresAt), gt(forumBans.expiresAt, new Date()))
      ),
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
      tagsJson: JSON.stringify(tags),
      format,
      pollJson: JSON.stringify(format === 'poll' ? pollOptions : []),
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
