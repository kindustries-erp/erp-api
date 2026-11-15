import { buildAuditDiff } from './audit-diff.util';

describe('buildAuditDiff', () => {
  it('chỉ trả các trường thay đổi, khóa sắp xếp tăng dần', () => {
    const diff = buildAuditDiff(
      { status: 'PENDING', amount: 100, note: 'old note' },
      { status: 'APPROVED', amount: 100, note: 'new note' },
    );
    expect(diff).toEqual({
      note: { before: 'old note', after: 'new note' },
      status: { before: 'PENDING', after: 'APPROVED' },
    });
    expect(Object.keys(diff)).toEqual(['note', 'status']);
  });

  it('coi undefined là null và xử lý đầu vào không phải object', () => {
    expect(buildAuditDiff(null, { a: 1 })).toEqual({
      a: { before: null, after: 1 },
    });
    expect(buildAuditDiff('x', undefined)).toEqual({});
  });
});
