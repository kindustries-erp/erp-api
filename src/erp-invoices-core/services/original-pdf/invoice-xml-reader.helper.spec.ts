import AdmZip from 'adm-zip';
import { readXmlFromBuffer } from './invoice-xml-reader.helper';

describe('readXmlFromBuffer', () => {
  it('reads invoice.xml from a ZIP buffer', () => {
    const zip = new AdmZip();
    zip.addFile('details.js', Buffer.from('console.log(1)'));
    zip.addFile('invoice.xml', Buffer.from('<HDon><MCCQT>M1</MCCQT></HDon>'));
    const buf = zip.toBuffer();

    expect(readXmlFromBuffer(buf, 'invoices/IN/a.zip')).toBe(
      '<HDon><MCCQT>M1</MCCQT></HDon>',
    );
  });

  it('returns raw text for a non-ZIP xml key', () => {
    const buf = Buffer.from('<HDon/>');
    expect(readXmlFromBuffer(buf, 'invoices/IN/a.xml')).toBe('<HDon/>');
  });

  it('returns empty string when the ZIP has no xml entry', () => {
    const zip = new AdmZip();
    zip.addFile('invoice.html', Buffer.from('<html/>'));
    expect(readXmlFromBuffer(zip.toBuffer(), 'a.zip')).toBe('');
  });
});
