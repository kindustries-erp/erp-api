import { isPgSslDisabled, resolvePgConnection } from './pg-connection.helper';

const BASE = 'postgresql://u:p@db.example.com:5432/app';

describe('resolvePgConnection', () => {
  it('bỏ sslmode=require khỏi URL và dùng ssl không kiểm chứng chỉ', () => {
    expect(resolvePgConnection(`${BASE}?sslmode=require`)).toEqual({
      url: BASE,
      ssl: { rejectUnauthorized: false },
    });
  });

  it('giữ tham số khác, bỏ sslmode, ssl và uselibpqcompat', () => {
    expect(
      resolvePgConnection(
        `${BASE}?application_name=erp&sslmode=require&uselibpqcompat=true&connect_timeout=5`,
      ).url,
    ).toBe(`${BASE}?application_name=erp&connect_timeout=5`);
  });

  it('URL không có query thì giữ nguyên, SSL vẫn bật', () => {
    expect(resolvePgConnection(BASE)).toEqual({
      url: BASE,
      ssl: { rejectUnauthorized: false },
    });
  });

  it.each([
    [`${BASE}?sslmode=disable`, undefined],
    [`${BASE}?ssl=false`, undefined],
    [`${BASE}?sslmode=require`, 'false'],
  ])('SSL tắt (%s, DB_SSL=%s) thì giữ nguyên URL', (url, dbSsl) => {
    expect(resolvePgConnection(url, dbSsl)).toEqual({ url, ssl: false });
  });

  it('isPgSslDisabled', () => {
    expect(isPgSslDisabled(undefined, 'false')).toBe(true);
    expect(isPgSslDisabled(`${BASE}?sslmode=require`)).toBe(false);
  });
});
