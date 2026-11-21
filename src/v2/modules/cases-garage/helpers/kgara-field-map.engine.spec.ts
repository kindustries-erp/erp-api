import {
  convertValue,
  mapForward,
  vnLocalDateTimeToInstant,
} from './kgara-field-map.engine';
import { KGARA_CASE_FIELD_MAP } from './kgara-case.field-map';

/**
 * Chạy với cả hai múi giờ tiến trình để chứng minh kết quả không phụ thuộc TZ:
 *   TZ=UTC bunx jest <spec>
 *   TZ=Asia/Ho_Chi_Minh bunx jest <spec>
 * pg đọc `timestamp` naive bằng giờ cục bộ của tiến trình, nên fixture dựng `Date` bằng
 * constructor cục bộ (cùng cách pg parse).
 */
describe('vnLocalDateTimeToInstant', () => {
  it('giờ tường VN 08:30 ngày 2026-10-05 là 01:30Z, bất kể TZ tiến trình', () => {
    const pgParsed = new Date(2026, 9, 5, 8, 30, 15, 0);
    expect(vnLocalDateTimeToInstant(pgParsed)?.toISOString()).toBe(
      '2026-10-05T01:30:15.000Z',
    );
  });

  it('qua nửa đêm: 00:10 VN ngày 2026-10-05 là 17:10Z ngày 2026-10-04', () => {
    const pgParsed = new Date(2026, 9, 5, 0, 10, 0, 0);
    expect(vnLocalDateTimeToInstant(pgParsed)?.toISOString()).toBe(
      '2026-10-04T17:10:00.000Z',
    );
  });

  it('chuỗi naive được hiểu là giờ VN', () => {
    expect(
      vnLocalDateTimeToInstant('2026-10-05 08:30:15.123')?.toISOString(),
    ).toBe('2026-10-05T01:30:15.123Z');
    expect(vnLocalDateTimeToInstant('2026-10-05')?.toISOString()).toBe(
      '2026-10-04T17:00:00.000Z',
    );
  });

  it('chuỗi có hậu tố múi giờ giữ nguyên instant', () => {
    expect(
      vnLocalDateTimeToInstant('2026-10-05T01:30:15.000Z')?.toISOString(),
    ).toBe('2026-10-05T01:30:15.000Z');
    expect(
      vnLocalDateTimeToInstant('2026-10-05T08:30:15+07:00')?.toISOString(),
    ).toBe('2026-10-05T01:30:15.000Z');
  });

  it('giá trị không hợp lệ trả về null', () => {
    expect(vnLocalDateTimeToInstant(new Date('x'))).toBeNull();
    expect(vnLocalDateTimeToInstant(123)).toBeNull();
  });
});

describe('convertValue vnLocalDateTime', () => {
  it('null/rỗng thành null, undefined giữ nguyên', () => {
    expect(convertValue('vnLocalDateTime', null)).toBeNull();
    expect(convertValue('vnLocalDateTime', '')).toBeNull();
    expect(convertValue('vnLocalDateTime', undefined)).toBeUndefined();
  });

  it('kind date cũ giữ nguyên hành vi (instant tuyệt đối)', () => {
    const d = new Date('2026-10-05T01:30:15.000Z');
    expect(convertValue('date', d)).toBe(d);
  });
});

describe('KGARA_CASE_FIELD_MAP ngày giờ V1 naive', () => {
  it('4 field ngày nghiệp vụ map theo giờ VN, kgaraDeletedAt (timestamptz) giữ instant', () => {
    const pg = new Date(2026, 9, 5, 8, 30, 0, 0);
    const abs = new Date('2026-10-06T03:00:00.000Z');
    const out = mapForward(KGARA_CASE_FIELD_MAP, {
      ngayPhatSinh: pg,
      ngayTiepNhan: pg,
      ngayHoanThanhCongViec: pg,
      ngayGiaoXeFull: pg,
      kgaraDeletedAt: abs,
    });
    for (const k of ['issuedAt', 'receivedAt', 'completedAt', 'deliveredAt']) {
      expect((out[k] as Date).toISOString()).toBe('2026-10-05T01:30:00.000Z');
    }
    expect(out.externalDeletedAt).toBe(abs);
  });
});
