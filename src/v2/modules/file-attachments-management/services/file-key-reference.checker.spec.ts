import { FileKeyReferenceChecker } from './file-key-reference.checker';
import {
  FileAttachmentsKeySource,
  InvoiceKeysSource,
  LegacyAttachmentsKeySource,
} from './file-key-reference.sources';

const src = (name: string, n: number) => ({
  name,
  count: jest.fn().mockResolvedValue(n),
});

describe('FileKeyReferenceChecker', () => {
  it('cộng mọi nguồn và trả chi tiết theo nguồn', async () => {
    const a = src('a', 2);
    const b = src('b', 0);
    const checker = new FileKeyReferenceChecker([a, b]);
    await expect(checker.count('k', 'id-1')).resolves.toEqual({
      total: 2,
      bySource: { a: 2, b: 0 },
    });
    expect(a.count).toHaveBeenCalledWith('k', 'id-1');
  });

  it('không có nguồn nào thì tổng 0', async () => {
    await expect(new FileKeyReferenceChecker([]).count('k')).resolves.toEqual({
      total: 0,
      bySource: {},
    });
  });
});

describe('nguồn tham chiếu SQL', () => {
  const ds = { query: jest.fn().mockResolvedValue([{ n: '3' }]) };

  beforeEach(() => ds.query.mockClear());

  it('file_attachments loại trừ dòng đang xét, dùng tham số', async () => {
    const n = await new FileAttachmentsKeySource(ds as never).count(
      'k',
      'id-1',
    );
    expect(n).toBe(3);
    const [sql, params] = ds.query.mock.calls[0];
    expect(sql).toContain('id <> $2::uuid');
    expect(params).toEqual(['k', 'id-1']);
  });

  it('erp_attachments truy vấn theo file_key', async () => {
    await new LegacyAttachmentsKeySource(ds as never).count('k');
    expect(ds.query.mock.calls[0][0]).toContain('FROM erp_attachments');
    expect(ds.query.mock.calls[0][1]).toEqual(['k']);
  });

  it('hóa đơn kiểm cả pdf_file_key, xml_file_key và pdf_files[].key', async () => {
    await new InvoiceKeysSource(ds as never).count('k');
    const sql: string = ds.query.mock.calls[0][0];
    expect(sql).toContain('pdf_file_key = $1');
    expect(sql).toContain('xml_file_key = $1');
    expect(sql).toContain('pdf_files @>');
  });
});
