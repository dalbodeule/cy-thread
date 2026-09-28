type MailKind = 'campaign' | 'sanction' | 'verification' | 'test' | string;

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  );

const kindLabel = (kind: MailKind) =>
  (
    ({ campaign: '운영 안내', sanction: '이용 정지 안내', verification: '이메일 확인' }) as Record<
      string,
      string
    >
  )[kind] || '안내 메일';

function bodyHtml(body: string) {
  return body
    .split(/(https:\/\/community\.mori\.space\/[^\s<>"']+)/g)
    .map((part) => {
      if (!part.startsWith('https://community.mori.space/')) return escapeHtml(part);
      const safeUrl = escapeHtml(part);
      return `<a href="${safeUrl}" style="color:#246545;text-decoration:underline;overflow-wrap:anywhere">${safeUrl}</a>`;
    })
    .join('');
}

export function renderMail(kind: MailKind, subject: string, body: string, from: string) {
  const label = kindLabel(kind);
  const cleanBody = body.trim();
  const text = `mori.space · ${label}\n${'─'.repeat(28)}\n\n${subject}\n\n${cleanBody}\n\n${'─'.repeat(28)}\nmori.space 운영팀\n문의: ${from}`;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:32px 16px;background:#f3f6f2;color:#20372a;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif"><table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse"><tr><td style="padding:0 0 18px;font-size:20px;font-weight:800;color:#24573c">mori.space</td></tr><tr><td style="background:#ffffff;border:1px solid #dbe7dc;border-radius:14px;padding:32px"><span style="display:inline-block;padding:6px 10px;border-radius:999px;background:#e9f3e9;color:#246545;font-size:12px;font-weight:700">${label}</span><h1 style="margin:20px 0 24px;font-size:23px;line-height:1.4;color:#193b28">${escapeHtml(subject)}</h1><div style="font-size:15px;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;color:#334b3a">${bodyHtml(cleanBody)}</div></td></tr><tr><td style="padding:20px 4px;color:#627568;font-size:12px;line-height:1.7">mori.space 운영팀<br>문의: ${escapeHtml(from)}<br>이 메일은 mori.space에서 발송했습니다.</td></tr></table></body></html>`;
  return { text, html };
}
