import AdmZip from 'adm-zip';
import { extractXmlFromZip } from './invoice-xml-from-zip.util';

describe('extractXmlFromZip', () => {
  it('returns only xml entries, stripped of folders', () => {
    const zip = new AdmZip();
    zip.addFile('pkg/invoice.xml', Buffer.from('<HDon/>'));
    zip.addFile('pkg/view.html', Buffer.from('<html/>'));
    zip.addFile('pkg/scan.pdf', Buffer.from('%PDF'));

    const files = extractXmlFromZip(zip.toBuffer());

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('invoice.xml');
    expect(files[0].buffer.toString()).toBe('<HDon/>');
  });

  it('returns empty when the zip has no xml', () => {
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('x'));
    expect(extractXmlFromZip(zip.toBuffer())).toEqual([]);
  });

  it('returns empty for a buffer that is not a zip', () => {
    expect(extractXmlFromZip(Buffer.from('not a zip'))).toEqual([]);
  });
});
