import { and, eq } from 'drizzle-orm';
import {
  forumAdmins,
  forumBans,
  forumFollowers,
  forums,
  mailOutbox,
  users,
} from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';
import requireForumModerator from '~~/server/utils/requireForumModerator';
import { recipientAddress, sanctionMail } from '~~/server/utils/mail';
import {
  calculateSuspensionExpiry,
  suspensionDurations,
  type SuspensionDuration,
} from '~~/server/utils/suspensionDuration';

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug');
  const body = await readBody<{
    userId?: unknown;
    banned?: unknown;
    reason?: unknown;
    duration?: unknown;
  }>(event);
  const userId = Number(body?.userId);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (
    !slug ||
    !Number.isInteger(userId) ||
    userId < 1 ||
    typeof body?.banned !== 'boolean' ||
    reason.length > 500 ||
    (body.banned &&
      (reason.length < 2 || !suspensionDurations.includes(body.duration as SuspensionDuration)))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide a valid user, banned flag, and reason under 500 characters',
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const forum = await db.query.forums.findFirst({ where: eq(forums.slug, slug) });
  if (!forum) throw createError({ statusCode: 404, statusMessage: 'Community not found' });
  const actor = await requireForumModerator(event, forum.id);
  if (forum.ownerUserId === userId) {
    throw createError({ statusCode: 400, statusMessage: 'The community owner cannot be banned' });
  }
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Member not found' });
  if (target.isGlobalAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Global admins cannot be banned in a forum',
    });
  }
  const targetRole = await db.query.forumAdmins.findFirst({
    where: and(eq(forumAdmins.forumId, forum.id), eq(forumAdmins.userId, userId)),
  });
  if (targetRole?.role === 'admin' && actor.role !== 'owner' && actor.role !== 'global') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the owner can manage an admin account',
    });
  }
  if (targetRole?.role === 'mod' && actor.role === 'mod') {
    throw createError({ statusCode: 403, statusMessage: 'Admins manage moderator accounts' });
  }

  let notificationQueued = false;
  if (body.banned) {
    const now = new Date();
    const duration = body.duration as SuspensionDuration;
    const expiresAt = calculateSuspensionExpiry(now, duration);
    const ban = db
      .insert(forumBans)
      .values({ forumId: forum.id, userId, reason, duration, expiresAt, createdAt: now })
      .onConflictDoUpdate({
        target: [forumBans.forumId, forumBans.userId],
        set: { reason, duration, expiresAt, createdAt: now },
      });
    const unfollow = db
      .delete(forumFollowers)
      .where(and(eq(forumFollowers.forumId, forum.id), eq(forumFollowers.userId, userId)));
    const email = recipientAddress(target);
    if (email) {
      notificationQueued = true;
      await db.batch([
        ban,
        unfollow,
        db
          .insert(mailOutbox)
          .values(sanctionMail(userId, email, `${forum.name} Forum`, duration, reason, expiresAt)),
      ]);
    } else {
      await db.batch([ban, unfollow]);
    }
  } else {
    await db
      .delete(forumBans)
      .where(and(eq(forumBans.forumId, forum.id), eq(forumBans.userId, userId)));
  }
  return { userId, banned: body.banned, notificationQueued };
});
