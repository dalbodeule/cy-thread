import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import {
  categories,
  forumAdmins,
  forums,
  posts,
  pollVotes,
  reactions,
  threadReads,
  threadSubscriptions,
  threadBookmarks,
  threads,
  users,
} from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import isGlobalAdmin from '~~/server/utils/isGlobalAdmin';
import { getForumViewer, requireForumReadable } from '~~/server/utils/forumAccess';
import { readForumAppearance } from '~~/server/utils/forumAppearance';
import { parseThreadTags } from '~~/server/utils/threadTags';
import { parsePollOptions } from '~~/server/utils/threadFormat';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const threadId = Number(getRouterParam(event, 'threadId'));
  const query = getQuery(event);
  const replyLimit = Math.min(200, Math.max(20, Number(query.limit) || 100));
  const replyOffset = Math.max(0, Number(query.offset) || 0);
  if (!slug || !Number.isInteger(threadId) || threadId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid community or thread' });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [thread] = await db
    .select({
      id: threads.id,
      title: threads.title,
      tagsJson: threads.tagsJson,
      format: threads.format,
      pollJson: threads.pollJson,
      acceptedPostId: threads.acceptedPostId,
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
  const hasMoreReplies = replies.length > replyOffset + replyLimit;
  const visibleReplies = replies.slice(replyOffset, replyOffset + replyLimit);

  const session = await getUserSession(event);
  const viewerId = Number(session.user?.id);
  const [readState, subscriptionState] =
    Number.isInteger(viewerId) && viewerId > 0
      ? await Promise.all([
          db.query.threadReads.findFirst({
            where: and(eq(threadReads.threadId, threadId), eq(threadReads.userId, viewerId)),
          }),
          db.query.threadSubscriptions.findFirst({
            where: and(
              eq(threadSubscriptions.threadId, threadId),
              eq(threadSubscriptions.userId, viewerId)
            ),
          }),
        ])
      : [null, null];
  const [threadReaction, postReactionRows, pollVoteRows, myPollVote] = await Promise.all([
    db
      .select({
        count: count(),
        reacted: sql<boolean>`exists (select 1 from ${reactions} viewer_reaction where viewer_reaction.thread_id = ${threadId} and viewer_reaction.user_id = ${Number.isInteger(viewerId) && viewerId > 0 ? viewerId : -1} and viewer_reaction.kind = 'like')`,
      })
      .from(reactions)
      .where(and(eq(reactions.threadId, threadId), eq(reactions.kind, 'like'))),
    visibleReplies.length
      ? db
          .select({
            postId: reactions.postId,
            count: count(),
            reacted: sql<boolean>`max(case when ${reactions.userId} = ${Number.isInteger(viewerId) && viewerId > 0 ? viewerId : -1} then 1 else 0 end) = 1`,
          })
          .from(reactions)
          .where(
            and(
              inArray(
                reactions.postId,
                visibleReplies.map((reply) => Number(reply.id))
              ),
              eq(reactions.kind, 'like')
            )
          )
          .groupBy(reactions.postId)
      : Promise.resolve([]),
    db
      .select({ optionIndex: pollVotes.optionIndex, count: count() })
      .from(pollVotes)
      .where(eq(pollVotes.threadId, threadId))
      .groupBy(pollVotes.optionIndex),
    Number.isInteger(viewerId) && viewerId > 0
      ? db.query.pollVotes.findFirst({
          where: and(eq(pollVotes.threadId, threadId), eq(pollVotes.userId, viewerId)),
        })
      : Promise.resolve(null),
  ]);
  const postReactionById = new Map(
    postReactionRows.map((reaction) => [Number(reaction.postId), reaction])
  );
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

  const replyById = new Map(visibleReplies.map((reply) => [Number(reply.id), reply]));
  const children = new Map<number, typeof replies>();
  for (const reply of visibleReplies) {
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
  if (visibleReplies[0]) appendTree(Number(visibleReplies[0].id));
  for (const reply of visibleReplies) appendTree(Number(reply.id));

  return {
    ...thread,
    tags: parseThreadTags(thread.tagsJson),
    pollOptions: parsePollOptions(thread.pollJson),
    pollCounts: parsePollOptions(thread.pollJson).map((_, index) =>
      Number(pollVoteRows.find((row) => row.optionIndex === index)?.count || 0)
    ),
    myPollOption: myPollVote?.optionIndex ?? null,
    lastReadPostId: readState?.lastReadPostId ?? null,
    subscribed: Boolean(subscriptionState),
    commentAccess,
    canComment,
    isAuthor,
    canModerate,
    isBookmarked,
    reactionCount: Number(threadReaction[0]?.count || 0),
    reacted: Boolean(threadReaction[0]?.reacted),
    replies: orderedReplies.map((reply) => ({
      ...reply,
      isAuthor: Number(reply.authorId) === viewerId,
      reactionCount: Number(postReactionById.get(Number(reply.id))?.count || 0),
      reacted: Boolean(postReactionById.get(Number(reply.id))?.reacted),
    })),
    hasMoreReplies,
  };
});
