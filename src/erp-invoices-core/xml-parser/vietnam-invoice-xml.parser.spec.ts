import { parseVietnamInvoiceXml } from './vietnam-invoice-xml.parser';

describe('vietnam-invoice-xml.parser', () => {
  it('should parse TT78 XML and uppercase unit', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<HDon>
  <DLHDon>
    <TTChung>
      <SHDon>123456</SHDon>
      <KHHDOn>1C24TAA</KHHDOn>
      <NLap>2026-09-28</NLap>
    </TTChung>
    <NDHDon>
      <NBan>
        <Ten>CONG TY TNHH ABC</Ten>
        <MST>0101234567</MST>
      </NBan>
      <NMua>
        <Ten>CONG TY TNHH XYZ</Ten>
        <MST>0309876543</MST>
      </NMua>
      <DSHHDVu>
        <HHDVu>
          <STT>1</STT>
          <THHDVu>Dau nhot oto</THHDVu>
          <DVTinh>can</DVTinh>
          <SLuong>5</SLuong>
          <DGia>200000</DGia>
          <ThTien>1000000</ThTien>
          <TSuat>10%</TSuat>
          <TThue>100000</TThue>
        </HHDVu>
        <HHDVu>
          <STT>2</STT>
          <THHDVu>Loc gio dong co</THHDVu>
          <DVTinh>bộ</DVTinh>
          <SLuong>2</SLuong>
          <DGia>150000</DGia>
          <ThTien>300000</ThTien>
          <TSuat>10%</TSuat>
          <TThue>30000</TThue>
        </HHDVu>
      </DSHHDVu>
      <TToan>
        <TgTCThue>1300000</TgTCThue>
        <TgTThue>130000</TgTThue>
        <TgTTTBSo>1430000</TgTTTBSo>
      </TToan>
    </NDHDon>
  </DLHDon>
</HDon>`;

    const parsed = parseVietnamInvoiceXml(xml);
    expect(parsed).not.toBeNull();
    expect(parsed?.invoiceNo).toBe('123456');
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.items[0].unit).toBe('CAN');
    expect(parsed?.items[1].unit).toBe('BỘ');
  });

  it('should parse VinFast XML and uppercase unit', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<Invoice>
  <InvoiceNumber>789012</InvoiceNumber>
  <SerialNo>1C24VFA</SerialNo>
  <InvoiceDate>2026-09-28</InvoiceDate>
  <SellerName>CONG TY CO PHAN SAN XUAT VA KINH DOANH VINFAST</SellerName>
  <SellerTaxCode>0108926276</SellerTaxCode>
  <InvoiceDetails>
    <Row>
      <ItemName>EEP63012001AB - Bo pin dien</ItemName>
      <Unit>cái</Unit>
      <Quantity>1</Quantity>
      <UnitPrice>50000000</UnitPrice>
      <AmountBeforeTax>50000000</AmountBeforeTax>
      <VATRate>10</VATRate>
      <VATAmount>5000000</VATAmount>
    </Row>
  </InvoiceDetails>
  <TotalBeforeTax>50000000</TotalBeforeTax>
  <TaxAmount>5000000</TaxAmount>
  <TotalAmount>55000000</TotalAmount>
</Invoice>`;

    const parsed = parseVietnamInvoiceXml(xml);
    expect(parsed).not.toBeNull();
    expect(parsed?.invoiceNo).toBe('789012');
    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0].itemCode).toBe('VF-EEP63012001AB');
    expect(parsed?.items[0].unit).toBe('CÁI');
  });
});
