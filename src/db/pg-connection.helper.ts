/**
 * Cấu hình SSL cho kết nối Postgres từ `DATABASE_URL`.
 *
 * `pg` gộp tham số của connection string đè lên config, nên `sslmode=require` trong URL làm mất
 * `ssl: { rejectUnauthorized: false }` truyền tường minh (pg hiện coi `require` là `verify-full`) và
 * kết nối tới DB dùng chứng chỉ tự ký bị từ chối. Khi SSL bật, bỏ `sslmode`/`ssl` khỏi URL để
 * tùy chọn `ssl` có hiệu lực: vẫn mã hóa, không kiểm chứng chỉ. SSL tắt (`DB_SSL=false`,
 * `sslmode=disable`, `ssl=false`) thì giữ nguyên URL.
 */
export type PgSslOption = false | { rejectUnauthorized: false };

const SSL_PARAMS = ['sslmode', 'ssl', 'uselibpqcompat'];

export function isPgSslDisabled(url?: string, dbSsl?: string): boolean {
  return (
    dbSsl === 'false' ||
    (!!url && (url.includes('sslmode=disable') || url.includes('ssl=false')))
  );
}

export function resolvePgConnection(
  url: string,
  dbSsl?: string,
): { url: string; ssl: PgSslOption } {
  if (isPgSslDisabled(url, dbSsl)) return { url, ssl: false };
  return { url: stripSslParams(url), ssl: { rejectUnauthorized: false } };
}

function stripSslParams(url: string): string {
  const q = url.indexOf('?');
  if (q < 0) return url;
  const kept = url
    .slice(q + 1)
    .split('&')
    .filter((p) => p && !SSL_PARAMS.includes(p.split('=')[0].toLowerCase()));
  return kept.length ? `${url.slice(0, q)}?${kept.join('&')}` : url.slice(0, q);
}
