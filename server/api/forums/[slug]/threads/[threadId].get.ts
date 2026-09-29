import { and, asc, eq } from 'drizzle-orm';
import {
  categories,
  forumAdmins,
  forums,
  posts,
  threadBookmarks,
  threads,
  users,
} from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import isGlobalAdmin from '~~/server/utils/isGlobalAdmin';
import { getForumViewer, requireForumReadable } from '~~/server/utils/forumAccess';
import { readForumAppearance } from '~~/server/utils/forumAppearance';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  if (!slug || !Number.isInteger(threadId) || threadId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or thread' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [thread] = await db
    .select({
      id: threads.id,
      title: threads.title,
      isLocked: threads.isLocked,
      isPinned: threads.isPinned,
      category: categories.name,
      categorySlug: categories.slug,
      forumId: forums.id,
      authorId: users.id,
      author: users.name,
      authorAvatarUrl: users.avatarUrl,
      createdAt: threads.createdAt,
    })
    .from(threads)
    .innerJoin(forums, eq(threads.forumId, forums.id))
    .innerJoin(categories, eq(threads.categoryId, categories.id))
    .innerJoin(users, eq(threads.authorUserId, users.id))
    .where(
      and(
        eq(forums.slug, slug),
        eq(threads.id, threadId),
        eq(threads.isDeleted, false),
        eq(forums.slug, slug)
      )
    )
    .limit(1);

  if (!thread) throw createError({ statusCode: 404, statusMessage: 'Thread not found' });

  const forumForAccess = await db.query.forums.findFirst({ where: eq(forums.id, thread.forumId) });
  if (!forumForAccess) throw createError({ statusCode: 404, statusMessage: 'Thread not found' });
  await requireForumReadable(event, forumForAccess);
  const viewer = await getForumViewer(event, forumForAccess.id);
  const commentAccess = readForumAppearance(
    forumForAccess.settingsJson,
    forumForAccess.cssCustom
  ).commentAccess;
  const canComment =
    commentAccess === 'guest' ||
    Boolean(
      viewer &&
      (commentAccess === 'members' ||
        viewer.isMember ||
        viewer.isModerator ||
        viewer.userId === forumForAccess.ownerUserId)
    );

  const replies = await db
    .select({
      id: posts.id,
      authorId: users.id,
      author: users.name,
      authorAvatarUrl: users.avatarUrl,
      guestName: posts.guestName,
      markdown: posts.markdown,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      parentPostId: posts.parentPostId,
      depth: posts.depth,
      isDeleted: posts.isDeleted,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorUserId, users.id))
    .where(eq(posts.threadId, threadId))
    .orderBy(asc(posts.createdAt), asc(posts.id));

  const session = await getUserSession(event);
  const viewerId = Number(session.user?.id);
  const isBookmarked =
    Number.isInteger(viewerId) && viewerId > 0
      ? Boolean(
          await db.query.threadBookmarks.findFirst({
            where: and(
              eq(threadBookmarks.threadId, threadId),
              eq(threadBookmarks.userId, viewerId)
            ),
          })
        )
      : false;
  const isAuthor = Number(thread.authorId) === viewerId;
  let canModerate = false;
  if (Number.isInteger(viewerId) && viewerId > 0) {
    const [forum, admin] = await Promise.all([
      db.query.forums.findFirst({ where: eq(forums.id, thread.forumId) }),
      db.query.forumAdmins.findFirst({
        where: and(eq(forumAdmins.forumId, thread.forumId), eq(forumAdmins.userId, viewerId)),
      }),
    ]);
    canModerate =
      forum?.ownerUserId === viewerId || Boolean(admin) || (await isGlobalAdmin(db, viewerId));
  }

  const replyById = new Map(replies.map((reply) => [Number(reply.id), reply]));
  const children = new Map<number, typeof replies>();
  for (const reply of replies) {
    if (reply.parentPostId == null) continue;
    const parentId = Number(reply.parentPostId);
    children.set(parentId, [...(children.get(parentId) || []), reply]);
  }
  const orderedReplies: typeof replies = [];
  const visited = new Set<number>();
  const appendTree = (postId: number) => {
    if (visited.has(postId)) return;
    const post = replyById.get(postId);
    if (!post) return;
    visited.add(postId);
    orderedReplies.push(post);
    for (const child of children.get(postId) || []) appendTree(Number(child.id));
  };
  if (replies[0]) appendTree(Number(replies[0].id));
  for (const reply of replies) appendTree(Number(reply.id));

  return {
    ...thread,
    commentAccess,
    canComment,
    isAuthor,
    canModerate,
    isBookmarked,
    replies: orderedReplies.map((reply) => ({
      ...reply,
      isAuthor: Number(reply.authorId) === viewerId,
    })),
  };
});
