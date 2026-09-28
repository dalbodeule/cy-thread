import { and, eq, gt } from 'drizzle-orm';
import { mailOutbox, oauthAccounts, users } from '~~/server/db/schema';
import useDrizzle from '~~/server/utils/useDrizzle';

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const userId = Number(session.user.id);
  const body = await readBody<{ email?: unknown }>(event);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw createError({ statusCode: 400, statusMessage: '올바른 이메일 주소를 입력해 주세요.' });
  }
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const [account, chzzkLink] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.oauthAccounts.findFirst({
      where: and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, 'chzzk')),
    }),
  ]);
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Account not found' });
  if (!chzzkLink)
    throw createError({ statusCode: 403, statusMessage: 'CHZZK account is required' });
  if (account.email) return { email: account.email };
  const recentVerification = await db.query.mailOutbox.findFirst({
    where: and(
      eq(mailOutbox.userId, userId),
      eq(mailOutbox.kind, 'verification'),
      gt(mailOutbox.createdAt, new Date(Date.now() - 5 * 60_000))
    ),
  });
  if (recentVerification)
    throw createError({
      statusCode: 429,
      statusMessage: '확인 메일은 5분 후 다시 보낼 수 있어요.',
    });
  const token = crypto.randomUUID();
  const verifyUrl = `https://community.mori.space/account/verify-email?token=${encodeURIComponent(token)}`;
  await db.batch([
    db
      .update(users)
      .set({
        contactEmail: email,
        contactEmailVerifiedAt: null,
        contactEmailVerifyToken: token,
        contactEmailVerifyExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .where(eq(users.id, userId)),
    db.insert(mailOutbox).values({
      userId,
      recipientEmail: email,
      kind: 'verification',
      subject: '[mori.space] 연락 이메일 확인',
      body: `아래 링크를 열어 연락 이메일 주소를 확인해 주세요. 링크는 24시간 동안 유효합니다.\n\n${verifyUrl}\n\n본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    }),
  ]);
  await setUserSession(event, {
    user: { id: account.id, name: account.name || '멤버', email, avatarUrl: account.avatarUrl },
  });
  return { email, verificationSent: true };
});
