import { TABLE_COLUMNS } from './procurement-request-table.constants';

describe('TABLE_COLUMNS (đề nghị Garage)', () => {
  it('cột người tạo lọc và sắp xếp theo email, không theo UUID', () => {
    expect(TABLE_COLUMNS.createdBy.sql).toContain('core_users');
    expect(TABLE_COLUMNS.createdBy.sql).toContain('cu.email');
    expect(TABLE_COLUMNS.createdBy.sql).not.toContain('CAST');
    expect(TABLE_COLUMNS.created_by).toEqual(TABLE_COLUMNS.createdBy);
  });

  it('cột người duyệt có key approver, lấy người đã duyệt hoặc người được giao', () => {
    expect(TABLE_COLUMNS.approver.sql).toContain(
      'COALESCE(h.approvedBy, h.approverId)',
    );
    expect(TABLE_COLUMNS.approver.sql).toContain('cu.email');
    expect(TABLE_COLUMNS.approver.type).toBe('text');
  });
});
