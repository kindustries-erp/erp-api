import { resolveInvoiceZipFiles } from './invoice-zip-files.util';

const att = (fileKey: string, fileName: string) => ({
  attachment: { fileKey, fileName },
});

describe('resolveInvoiceZipFiles', () => {
  it('returns the zip from xml_file_key when there are no attachments', () => {
    const files = resolveInvoiceZipFiles({
      attachments: [],
      xmlFileKey: 'invoices/IN/2026/10/2026-10-19_0108818792_C26TTH_54.zip',
    });
    expect(files).toEqual([
      {
        key: 'invoices/IN/2026/10/2026-10-19_0108818792_C26TTH_54.zip',
        filename: '2026-10-19_0108818792_C26TTH_54.zip',
      },
    ]);
  });

  it('returns zip attachments', () => {
    const files = resolveInvoiceZipFiles({
      attachments: [
        att('k-zip', 'pkg_C26MKA.zip'),
        att('k-pdf', 'hoa_don.pdf'),
      ],
      xmlFileKey: null,
    });
    expect(files).toEqual([{ key: 'k-zip', filename: 'pkg_C26MKA.zip' }]);
  });

  it('dedupes when attachment and xml_file_key share the same key', () => {
    const key = 'invoices/IN/2026/10/pkg.zip';
    const files = resolveInvoiceZipFiles({
      attachments: [att(key, 'pkg.zip')],
      xmlFileKey: key,
    });
    expect(files).toHaveLength(1);
    expect(files[0]).toEqual({ key, filename: 'pkg.zip' });
  });

  it('ignores a plain .xml xml_file_key', () => {
    expect(
      resolveInvoiceZipFiles({ attachments: [], xmlFileKey: 'invoices/a.xml' }),
    ).toEqual([]);
  });

  it('returns empty for an invoice with nothing', () => {
    expect(resolveInvoiceZipFiles({})).toEqual([]);
  });
});
