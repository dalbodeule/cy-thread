import { relations } from 'drizzle-orm';

// 테이블 모음 import
import { users } from './users';
import { oauthAccounts } from './oauthAccounts';
import { forums } from './forums';
import { forumAdmins } from './forumAdmins';
import { forumFollowers } from './forumFollowers';
import { forumMembers } from './forumMembers';
import { forumBans } from './forumBans';
import { categories } from './categories';
import { categoryAdmins } from './categoryAdmins';
import { forumRequests } from './forumRequests';
import { featuredCategories } from './featuredCategories';
import { threads } from './threads';
import { posts } from './posts';
import { attachments } from './attachments';
import { sessions } from './sessions';
import { threadBookmarks } from './threadBookmarks';
import { reports } from './reports';
import { userSuspensions } from './userSuspensions';
import { mailCampaigns, mailOutbox } from './mail';
import { notifications } from './notifications';
import { reactions } from './reactions';
import { pollVotes } from './pollVotes';
import { userBlocks } from './userBlocks';
import { forumMutes } from './forumMutes';
import { moderationLogs } from './moderationLogs';
import { threadReads } from './threadReads';
import { threadSubscriptions } from './threadSubscriptions';

export {
  users,
  oauthAccounts,
  forums,
  forumAdmins,
  forumFollowers,
  forumMembers,
  forumBans,
  categories,
  categoryAdmins,
  forumRequests,
  featuredCategories,
  threads,
  posts,
  attachments,
  sessions,
  threadBookmarks,
  reports,
  userSuspensions,
  mailCampaigns,
  mailOutbox,
  notifications,
  reactions,
  pollVotes,
  userBlocks,
  forumMutes,
  moderationLogs,
  threadReads,
  threadSubscriptions,
};

// 개별 relations
export const usersRelations = relations(users, ({ many }) => ({
  oauthAccounts: many(oauthAccounts),
  forumsOwned: many(forums),
  forumAdminRoles: many(forumAdmins),
  categoryAdminRoles: many(categoryAdmins),
  posts: many(posts),
  threads: many(threads),
  attachments: many(attachments),
  sessions: many(sessions),
  threadBookmarks: many(threadBookmarks),
  submittedReports: many(reports),
  reactions: many(reactions),
  pollVotes: many(pollVotes),
  blocksGiven: many(userBlocks, { relationName: 'blocksGiven' }),
  blocksReceived: many(userBlocks, { relationName: 'blocksReceived' }),
  forumMutes: many(forumMutes),
  moderationLogs: many(moderationLogs),
  threadReads: many(threadReads),
  threadSubscriptions: many(threadSubscriptions),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, { fields: [oauthAccounts.userId], references: [users.id] }),
}));

export const forumsRelations = relations(forums, ({ one, many }) => ({
  owner: one(users, { fields: [forums.ownerUserId], references: [users.id] }),
  admins: many(forumAdmins),
  followers: many(forumFollowers),
  members: many(forumMembers),
  bans: many(forumBans),
  categories: many(categories),
  threads: many(threads),
  attachments: many(attachments),
  reports: many(reports),
  forumMutes: many(forumMutes),
  moderationLogs: many(moderationLogs),
}));

export const forumAdminsRelations = relations(forumAdmins, ({ one }) => ({
  forum: one(forums, { fields: [forumAdmins.forumId], references: [forums.id] }),
  user: one(users, { fields: [forumAdmins.userId], references: [users.id] }),
}));

export const forumFollowersRelations = relations(forumFollowers, ({ one }) => ({
  forum: one(forums, { fields: [forumFollowers.forumId], references: [forums.id] }),
  user: one(users, { fields: [forumFollowers.userId], references: [users.id] }),
}));

export const forumMembersRelations = relations(forumMembers, ({ one }) => ({
  forum: one(forums, { fields: [forumMembers.forumId], references: [forums.id] }),
  user: one(users, { fields: [forumMembers.userId], references: [users.id] }),
  reviewer: one(users, { fields: [forumMembers.reviewedByUserId], references: [users.id] }),
}));

export const forumBansRelations = relations(forumBans, ({ one }) => ({
  forum: one(forums, { fields: [forumBans.forumId], references: [forums.id] }),
  user: one(users, { fields: [forumBans.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  forum: one(forums, { fields: [categories.forumId], references: [forums.id] }),
  admins: many(categoryAdmins),
  threads: many(threads),
}));

export const categoryAdminsRelations = relations(categoryAdmins, ({ one }) => ({
  category: one(categories, { fields: [categoryAdmins.categoryId], references: [categories.id] }),
  user: one(users, { fields: [categoryAdmins.userId], references: [users.id] }),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  forum: one(forums, { fields: [threads.forumId], references: [forums.id] }),
  category: one(categories, { fields: [threads.categoryId], references: [categories.id] }),
  author: one(users, { fields: [threads.authorUserId], references: [users.id] }),
  posts: many(posts),
  bookmarks: many(threadBookmarks),
  pollVotes: many(pollVotes),
  threadReads: many(threadReads),
  threadSubscriptions: many(threadSubscriptions),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  thread: one(threads, { fields: [posts.threadId], references: [threads.id] }),
  parent: one(posts, {
    fields: [posts.parentPostId],
    references: [posts.id],
    relationName: 'postReplies',
  }),
  replies: many(posts, { relationName: 'postReplies' }),
  author: one(users, { fields: [posts.authorUserId], references: [users.id] }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  forum: one(forums, { fields: [attachments.forumId], references: [forums.id] }),
  post: one(posts, { fields: [attachments.postId], references: [posts.id] }),
  author: one(users, { fields: [attachments.authorUserId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const threadBookmarksRelations = relations(threadBookmarks, ({ one }) => ({
  thread: one(threads, { fields: [threadBookmarks.threadId], references: [threads.id] }),
  user: one(users, { fields: [threadBookmarks.userId], references: [users.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  forum: one(forums, { fields: [reports.forumId], references: [forums.id] }),
  reporter: one(users, { fields: [reports.reporterUserId], references: [users.id] }),
  reviewer: one(users, { fields: [reports.reviewedByUserId], references: [users.id] }),
  thread: one(threads, { fields: [reports.threadId], references: [threads.id] }),
  post: one(posts, { fields: [reports.postId], references: [posts.id] }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  user: one(users, { fields: [reactions.userId], references: [users.id] }),
  thread: one(threads, { fields: [reactions.threadId], references: [threads.id] }),
  post: one(posts, { fields: [reactions.postId], references: [posts.id] }),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  thread: one(threads, { fields: [pollVotes.threadId], references: [threads.id] }),
  user: one(users, { fields: [pollVotes.userId], references: [users.id] }),
}));

export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
  blocker: one(users, {
    fields: [userBlocks.blockerUserId],
    references: [users.id],
    relationName: 'blocksGiven',
  }),
  blocked: one(users, {
    fields: [userBlocks.blockedUserId],
    references: [users.id],
    relationName: 'blocksReceived',
  }),
}));

export const forumMutesRelations = relations(forumMutes, ({ one }) => ({
  user: one(users, { fields: [forumMutes.userId], references: [users.id] }),
  forum: one(forums, { fields: [forumMutes.forumId], references: [forums.id] }),
}));

export const moderationLogsRelations = relations(moderationLogs, ({ one }) => ({
  forum: one(forums, { fields: [moderationLogs.forumId], references: [forums.id] }),
  actor: one(users, { fields: [moderationLogs.actorUserId], references: [users.id] }),
}));

export const threadReadsRelations = relations(threadReads, ({ one }) => ({
  thread: one(threads, { fields: [threadReads.threadId], references: [threads.id] }),
  user: one(users, { fields: [threadReads.userId], references: [users.id] }),
}));

export const threadSubscriptionsRelations = relations(threadSubscriptions, ({ one }) => ({
  thread: one(threads, { fields: [threadSubscriptions.threadId], references: [threads.id] }),
  user: one(users, { fields: [threadSubscriptions.userId], references: [users.id] }),
}));

// 한 번에 export
const tables = {
  users,
  oauthAccounts,
  forums,
  forumAdmins,
  forumFollowers,
  forumMembers,
  forumBans,
  categories,
  categoryAdmins,
  forumRequests,
  featuredCategories,
  threads,
  posts,
  attachments,
  sessions,
  threadBookmarks,
  reports,
  userSuspensions,
  mailCampaigns,
  mailOutbox,
  notifications,
  reactions,
  pollVotes,
  userBlocks,
  forumMutes,
  moderationLogs,
  threadReads,
  threadSubscriptions,
};

const relationsAll = [
  usersRelations,
  oauthAccountsRelations,
  forumsRelations,
  forumAdminsRelations,
  forumFollowersRelations,
  forumMembersRelations,
  forumBansRelations,
  categoriesRelations,
  categoryAdminsRelations,
  threadsRelations,
  postsRelations,
  attachmentsRelations,
  sessionsRelations,
  threadBookmarksRelations,
  reportsRelations,
  reactionsRelations,
  pollVotesRelations,
  userBlocksRelations,
  forumMutesRelations,
  moderationLogsRelations,
  threadReadsRelations,
  threadSubscriptionsRelations,
] as const;

export default {
  ...tables,
  ...relationsAll,
};
