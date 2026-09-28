import { mailOutbox } from '~~/server/db/schema';

export const mailDurations: Record<string, string> = {
  '30m': '30분',
  '1h': '1시간',
  '6h': '6시간',
  '1d': '1일',
  '7d': '7일',
  '1mo': '1개월',
  permanent: '영구',
};

export function recipientAddress(user: {
  email: string | null;
  contactEmail: string | null;
  contactEmailVerifiedAt: Date | null;
}) {
  return user.email || (user.contactEmailVerifiedAt ? user.contactEmail : null);
}

export function sanctionMail(
  userId: number,
  email: string,
  scope: string,
  duration: string,
  reason: string,
  expiresAt: Date | null
) {
  const period = mailDurations[duration] || duration;
  const subject = `[mori.space] ${scope} 이용 정지 안내`;
  const body = `${scope} 이용이 ${period} 정지되었습니다.\n\n사유: ${reason}\n${expiresAt ? `해제 예정: ${expiresAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시간)` : '해제 예정: 영구 정지'}`;
  return {
    userId,
    recipientEmail: email,
    kind: 'sanction',
    subject,
    body,
  } satisfies typeof mailOutbox.$inferInsert;
}
