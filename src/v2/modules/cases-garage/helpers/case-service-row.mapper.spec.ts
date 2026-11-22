import {
  CASE_SERVICE_SELECT,
  toCaseServiceRow,
} from './case-service-row.mapper';

describe('toCaseServiceRow', () => {
  it('chuỗi số thành number, null giữ null, thiếu số thành 0; tên field EN', () => {
    const row = toCaseServiceRow({
      id: 's1',
      caseId: 'c1',
      origin: 'NATIVE',
      caseCode: 'PS1',
      kgaraStatusCode: '3',
      quantity: '2.50',
      amountBeforeTax: '1000000.00',
      productCode: null,
    });
    expect(row).toMatchObject({
      id: 's1',
      caseId: 'c1',
      origin: 'NATIVE',
      caseCode: 'PS1',
      kgaraStatusCode: 3,
      quantity: 2.5,
      amountBeforeTax: 1000000,
      serviceAmount: 0,
      productCode: null,
      licensePlate: null,
    });
    expect(row).not.toHaveProperty('soChungTu');
  });

  it('SELECT không lấy raw_data', () => {
    expect(CASE_SERVICE_SELECT.join(' ')).not.toContain('raw_data');
  });
});
