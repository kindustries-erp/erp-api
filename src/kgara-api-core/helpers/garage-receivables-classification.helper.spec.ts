import { buildReceivablesTrendItem } from './garage-receivables-classification.helper';

describe('buildReceivablesTrendItem', () => {
  it('should categorize cases into 4 classifications and calculate totals', () => {
    const mockCases = [
      {
        id: 'case-1',
        classification: 'SUA_CHUA_CHUNG',
        tienCoThue: 1000000,
        tienDaThanhToan: 400000,
        rawData: { TienThueKH: '100000' },
      },
      {
        id: 'case-2',
        classification: 'KY_GUI_NOI_BO',
        tienCoThue: 2000000,
        tienDaThanhToan: 2000000,
      },
      {
        id: 'case-3',
        classification: 'OJ_NGOAI',
        tienCoThue: 500000,
        tienDaThanhToan: 0,
      },
      {
        id: 'case-4',
        classification: 'UNKNOWN',
        tienCoThue: 300000,
        tienDaThanhToan: 100000,
      },
    ];

    const gpCostMap = new Map<string, number>([
      ['case-1', 600000],
      ['case-2', 1500000],
      ['case-3', 400000],
      ['case-4', 200000],
    ]);

    const paidCostMap = new Map<string, number>([
      ['case-1', 200000],
      ['case-2', 1500000],
      ['case-3', 0],
      ['case-4', 100000],
    ]);

    const trend = buildReceivablesTrendItem(
      'criticalOverdue90Plus',
      mockCases,
      gpCostMap,
      new Map(),
      paidCostMap,
    );

    expect(trend.label).toBe('criticalOverdue90Plus');
    expect(trend.caseCount).toBe(4);
    expect(trend.totalBilled).toBe(3800000);
    expect(trend.paid).toBe(2500000);
    expect(trend.receivable).toBe(1300000);
    expect(trend.collectionRate).toBe(65.8);

    // SUA_CHUA_CHUNG
    expect(trend.caseCountSuaChuaChung).toBe(1);
    expect(trend.billedSuaChuaChung).toBe(1000000);
    expect(trend.paidSuaChuaChung).toBe(400000);
    expect(trend.receivableSuaChuaChung).toBe(600000);
    expect(trend.receivableWithInvoiceSuaChuaChung).toBe(600000);
    expect(trend.costSuaChuaChung).toBe(600000);
    expect(trend.paidCostSuaChuaChung).toBe(200000);

    // KY_GUI_NOI_BO
    expect(trend.caseCountKyGuiNoiBo).toBe(1);
    expect(trend.billedKyGuiNoiBo).toBe(2000000);
    expect(trend.paidKyGuiNoiBo).toBe(2000000);
    expect(trend.receivableKyGuiNoiBo).toBe(0);

    // OJ_NGOAI
    expect(trend.caseCountOj).toBe(1);
    expect(trend.billedOj).toBe(500000);
    expect(trend.receivableOj).toBe(500000);

    // OTHER
    expect(trend.caseCountOther).toBe(1);
    expect(trend.billedOther).toBe(300000);
    expect(trend.receivableOther).toBe(200000);
  });

  it('should handle empty cases list safely', () => {
    const trend = buildReceivablesTrendItem('test', []);
    expect(trend.caseCount).toBe(0);
    expect(trend.totalBilled).toBe(0);
    expect(trend.paid).toBe(0);
    expect(trend.receivable).toBe(0);
    expect(trend.collectionRate).toBe(0);
  });
});
