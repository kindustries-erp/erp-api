import {
  BACKFILL_SOURCES,
  buildReport,
  INSERT_SQL,
  PREVIEW_SQL,
} from './backfill-invoice-files.sql';

describe('backfill-invoice-files.sql', () => {
  it('chỉ lấy hóa đơn chưa xóa, gộp theo (hóa đơn, khóa) ưu tiên erp_attachments', () => {
    expect(PREVIEW_SQL).toContain('i.is_deleted = false');
    expect(PREVIEW_SQL).toContain('DISTINCT ON (invoice_id, file_key)');
    expect(PREVIEW_SQL).toContain('ORDER BY invoice_id, file_key, priority');
  });

  it('INSERT idempotent theo unique một phần và gắn origin LEGACY', () => {
    expect(INSERT_SQL).toContain(
      'ON CONFLICT (owner_type, owner_id, file_key) WHERE is_deleted = false DO NOTHING',
    );
    expect(INSERT_SQL).toContain("'LEGACY'");
    expect(INSERT_SQL).toContain("'INVOICE'");
  });

  it('phủ đủ 4 nguồn V1', () => {
    for (const source of BACKFILL_SOURCES) {
      expect(PREVIEW_SQL).toContain(source);
    }
  });

  it('buildReport gộp preview và kết quả ghi theo nguồn', () => {
    const report = buildReport(
      [
        { source: 'erp_attachments', candidates: 10, already_present: 4 },
        {
          source: 'erp_invoices.pdf_file_key',
          candidates: 5,
          already_present: 5,
        },
      ],
      [{ source: 'erp_attachments', inserted: 6 }],
    );
    expect(report.bySource[0]).toEqual({
      source: 'erp_attachments',
      candidates: 10,
      alreadyPresent: 4,
      toInsert: 6,
      inserted: 6,
    });
    expect(report.bySource[1].inserted).toBe(0);
    expect(report).toMatchObject({
      totalCandidates: 15,
      totalAlreadyPresent: 9,
      totalInserted: 6,
    });
  });
});
