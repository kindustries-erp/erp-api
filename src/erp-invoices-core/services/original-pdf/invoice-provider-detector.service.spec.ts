import { InvoiceProviderDetectorService } from './invoice-provider-detector.service';

describe('InvoiceProviderDetectorService', () => {
  let service: InvoiceProviderDetectorService;

  beforeEach(() => {
    service = new InvoiceProviderDetectorService();
  });

  it('should detect VinFast invoice with salt and seller tax code', () => {
    const xml = `
      <HDon>
        <DLHDon>
          <NDHDon>
            <NBan>
              <MST>0108926276</MST>
              <Ten>CONG TY TNHH KINH DOANH THUONG MAI VA DICH VU VINFAST</Ten>
            </NBan>
          </NDHDon>
          <TTKhac>
            <TTin>
              <TTruong>salt</TTruong>
              <DLieu>ptZNNF</DLieu>
            </TTin>
            <TTin>
              <TTruong>MaTraCuu</TTruong>
              <DLieu>VUNMcUFm</DLieu>
            </TTin>
          </TTKhac>
        </DLHDon>
      </HDon>
    `;

    const info = service.detectFromXml(xml, '0108926276');
    expect(info.providerCode).toBe('VINFAST');
    expect(info.lookupCode).toBe('ptZNNF');
    expect(info.lookupUrl).toContain('e-invoice-tt78.vingroup.net');
  });

  it('should detect EasyInvoice from msttcgp 0105987432 and Fkey/PortalLink', () => {
    const xml = `
      <HDon>
        <DLHDon>
          <TTChung>
            <msttcgp>0105987432</msttcgp>
          </TTChung>
          <TTKhac>
            <TTin>
              <TTruong>Fkey</TTruong>
              <DLieu>5b59bd60-498c-4fa6-8f2e-07a8bdf1efbe</DLieu>
            </TTin>
            <TTin>
              <TTruong>PortalLink</TTruong>
              <DLieu>https://vinfastsaigon.easyinvoice.vn</DLieu>
            </TTin>
          </TTKhac>
        </DLHDon>
      </HDon>
    `;

    const info = service.detectFromXml(xml);
    expect(info.providerCode).toBe('EASYINVOICE');
    expect(info.lookupCode).toBe('5b59bd60-498c-4fa6-8f2e-07a8bdf1efbe');
    expect(info.lookupUrl).toBe('https://vinfastsaigon.easyinvoice.vn');
  });

  it('should detect MISA invoice from msttcgp 0101243150 and TransactionID', () => {
    const xml = `
      <HDon>
        <DLHDon>
          <TTChung>
            <msttcgp>0101243150</msttcgp>
          </TTChung>
          <TTKhac>
            <TTin>
              <TTruong>TransactionID</TTruong>
              <DLieu>50FBTGR_QBRJ</DLieu>
            </TTin>
          </TTKhac>
        </DLHDon>
      </HDon>
    `;

    const info = service.detectFromXml(xml);
    expect(info.providerCode).toBe('MISA');
    expect(info.lookupCode).toBe('50FBTGR_QBRJ');
    expect(info.lookupUrl).toBe('https://www.meinvoice.vn/tra-cuu/');
  });

  it('should detect Viettel S-Invoice from msttcgp 0100109106 and ReservationCode', () => {
    const xml = `
      <HDon>
        <DLHDon>
          <TTChung>
            <msttcgp>0100109106</msttcgp>
          </TTChung>
          <TTKhac>
            <TTin>
              <TTruong>ReservationCode</TTruong>
              <DLieu>OAD0M4DWGEAXVZF</DLieu>
            </TTin>
          </TTKhac>
        </DLHDon>
      </HDon>
    `;

    const info = service.detectFromXml(xml);
    expect(info.providerCode).toBe('VIETTEL');
    expect(info.lookupCode).toBe('OAD0M4DWGEAXVZF');
    expect(info.lookupUrl).toBe('https://sinvoice.viettel.vn/tracuuhoadon');
  });

  it('should detect VNPT invoice from msttcgp 0100686209', () => {
    const xml = `
      <HDon>
        <DLHDon>
          <TTChung>
            <msttcgp>0100686209</msttcgp>
          </TTChung>
          <TTKhac>
            <TTin>
              <TTruong>MaTraCuu</TTruong>
              <DLieu>VNPT12345</DLieu>
            </TTin>
          </TTKhac>
        </DLHDon>
      </HDon>
    `;

    const info = service.detectFromXml(xml);
    expect(info.providerCode).toBe('VNPT');
    expect(info.lookupCode).toBe('VNPT12345');
    expect(info.lookupUrl).toBe('https://vinvoice.vnpt.vn');
  });

  it('should detect from metadata without xml', () => {
    const vinInfo = service.detectFromMetadata(
      null,
      '0100684378',
      'ptZNNF',
      null,
    );
    expect(vinInfo.providerCode).toBe('VINFAST');
    expect(vinInfo.lookupCode).toBe('ptZNNF');

    const misaInfo = service.detectFromMetadata('0101243150', null, 'TRX123');
    expect(misaInfo.providerCode).toBe('MISA');
    expect(misaInfo.lookupCode).toBe('TRX123');

    const unknownInfo = service.detectFromMetadata('9999999999');
    expect(unknownInfo.providerCode).toBe('OTHER');
  });

  it('should detect BKAV from msttcgp 0101360697 and use MCCQT as lookup code', () => {
    const xml = `
      <HDon>
        <DLHDon>
          <TTChung><MSTTCGP>0101360697</MSTTCGP></TTChung>
        </DLHDon>
        <MCCQT>M1-26-2JNWA-00000037338</MCCQT>
      </HDon>
    `;

    const info = service.detectFromXml(xml, '0302539983');
    expect(info.providerCode).toBe('BKAV');
    expect(info.lookupCode).toBe('M1-26-2JNWA-00000037338');
    expect(info.lookupUrl).toBe('https://van.ehoadon.vn/TCHD');
    expect(info.hints).toContainEqual({
      label: 'Mã CQT (MCCQT)',
      value: 'M1-26-2JNWA-00000037338',
    });
  });

  it('should detect Thai Son from msttcgp 0101300842 and read Mã TC and ĐCTC from TTKhac', () => {
    const xml = `
      <HDon>
        <DLHDon>
          <TTChung><MSTTCGP>0101300842</MSTTCGP></TTChung>
          <TTKhac>
            <TTin><TTruong>Mã TC</TTruong><KDLieu>string</KDLieu><DLieu>LE2549X0I</DLieu></TTin>
            <TTin><TTruong>ĐCTC</TTruong><KDLieu>string</KDLieu><DLieu>https://tracuutvan.einvoice.com.vn/</DLieu></TTin>
          </TTKhac>
        </DLHDon>
      </HDon>
    `;

    const info = service.detectFromXml(xml, '0313403198');
    expect(info.providerCode).toBe('THAISON');
    expect(info.lookupCode).toBe('LE2549X0I');
    expect(info.lookupUrl).toBe('https://tracuutvan.einvoice.com.vn/');
  });

  it('should read TTKhac value when DLieu comes before TTruong', () => {
    const xml = `
      <HDon>
        <DLHDon>
          <TTChung><MSTTCGP>0100109106</MSTTCGP></TTChung>
          <TTKhac>
            <TTin><DLieu>703UVSKLML5EDDO</DLieu><KDLieu>string</KDLieu><TTruong>Mã số bí mật</TTruong></TTin>
          </TTKhac>
        </DLHDon>
      </HDon>
    `;

    const info = service.detectFromXml(xml, '0104093672');
    expect(info.providerCode).toBe('VIETTEL');
    expect(info.lookupCode).toBe('703UVSKLML5EDDO');
  });

  it('should gracefully handle malformed or empty xml', () => {
    const result = service.detectFromXml('');
    expect(result.providerCode).toBe('OTHER');
    expect(result.lookupCode).toBeNull();
  });
});
