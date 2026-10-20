import { resolveInvoicePdfFiles } from './invoice-pdf-files.util';

const att = (fileKey: string, fileName: string, mimeType: string | null) => ({
  attachment: { fileKey, fileName, mimeType },
});

describe('resolveInvoicePdfFiles', () => {
  it('returns empty when only a provider zip is attached', () => {
    const files = resolveInvoicePdfFiles({
      attachments: [
        att(
          'k-zip',
          '2026-07-02_0313403198_C26MKA_13729100.zip',
          'application/xml',
        ),
      ],
      pdfFileKey: null,
      pdfFiles: null,
    });
    expect(files).toEqual([]);
  });

  it('uses pdfFileKey when only a zip is attached as a link', () => {
    const files = resolveInvoicePdfFiles({
      attachments: [att('k-zip', 'pkg.zip', 'application/xml')],
      pdfFileKey: 'k-pdf',
    });
    expect(files).toEqual([{ key: 'k-pdf', filename: 'document.pdf' }]);
  });

  it('keeps PDF attachments and drops zip attachments when both exist', () => {
    const files = resolveInvoicePdfFiles({
      attachments: [
        att('k-zip', 'pkg.zip', 'application/xml'),
        att('k-pdf', 'hoa_don.pdf', 'application/pdf'),
      ],
    });
    expect(files).toEqual([{ key: 'k-pdf', filename: 'hoa_don.pdf' }]);
  });

  it('accepts a .pdf filename even when mime is missing and appends .pdf to bare names', () => {
    const files = resolveInvoicePdfFiles({
      attachments: [
        att('k1', 'scan.PDF', null),
        att('k2', 'no-ext', 'application/pdf'),
      ],
    });
    expect(files).toEqual([
      { key: 'k1', filename: 'scan.PDF' },
      { key: 'k2', filename: 'no-ext.pdf' },
    ]);
  });

  it('includes pdfFiles entries and dedupes by key', () => {
    const files = resolveInvoicePdfFiles({
      attachments: [att('k-pdf', 'a.pdf', 'application/pdf')],
      pdfFiles: [{ key: 'k-pdf' }, { key: 'k-extra', name: 'extra.pdf' }],
      pdfFileKey: 'k-pdf',
    });
    expect(files).toEqual([
      { key: 'k-pdf', filename: 'a.pdf' },
      { key: 'k-extra', filename: 'extra.pdf' },
    ]);
  });

  it('returns empty for an invoice with nothing', () => {
    expect(resolveInvoicePdfFiles({})).toEqual([]);
  });
});
