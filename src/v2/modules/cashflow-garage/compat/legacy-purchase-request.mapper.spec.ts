import {
  ForecastPrLineRow,
  ForecastPrRow,
  toLegacyPrHeader,
  toLegacyPrLine,
} from './legacy-purchase-request.mapper';

const base: ForecastPrRow = {
  id: 'f1',
  code: 'PR-0001',
  status: 'OPEN',
  branchId: null,
  amount: '1500000.00',
  plannedDate: '2026-11-20',
  createdAt: '2026-11-01T03:00:00.000Z',
  createdBy: 'u1',
  title: 'Mua phụ tùng',
  requesterEmployeeId: 'e1',
  note: 'ghi chú',
  submittedBy: 'u1',
  approvedBy: 'u2',
  approverId: 'u2',
  rejectedBy: null,
  rejectReason: null,
  closedAt: null,
  closeReason: null,
};

const line = (qtyRequested: string, qtyOrdered: string): ForecastPrLineRow => ({
  id: `l-${qtyRequested}-${qtyOrdered}`,
  lineNo: 1,
  lineType: 'GOODS',
  itemId: null,
  itemCode: 'PT-01',
  itemName: 'Bugi',
  description: 'Bugi NGK',
  notes: 'gấp',
  qtyRequested,
  qtyOrdered,
  unitPrice: '50000.00',
  amount: '500000.00',
});

describe('toLegacyPrHeader', () => {
  it('map trạng thái và tiến độ đặt hàng từ dòng', () => {
    const lines = [toLegacyPrLine(line('10', '0'))];
    expect(toLegacyPrHeader(base, lines).orderingStatus).toBe('NONE');
    expect(
      toLegacyPrHeader(base, [toLegacyPrLine(line('10', '4'))]).orderingStatus,
    ).toBe('PARTIAL');
    expect(
      toLegacyPrHeader(base, [toLegacyPrLine(line('10', '10'))]).orderingStatus,
    ).toBe('FULL');
  });

  it('dự chi đã có dấu đóng -> CLOSED, kèm lý do đóng', () => {
    const h = toLegacyPrHeader(
      {
        ...base,
        closedAt: '2026-11-05T00:00:00.000Z',
        closeReason: 'hết nhu cầu',
      },
      [],
    );
    expect(h.status).toBe('CLOSED');
    expect(h.closeReason).toBe('hết nhu cầu');
  });

  it('REJECTED hiển thị DRAFT và giữ lý do từ chối', () => {
    const h = toLegacyPrHeader(
      { ...base, status: 'REJECTED', rejectReason: 'thiếu báo giá' },
      [],
    );
    expect(h.status).toBe('DRAFT');
    expect(h.rejectReason).toBe('thiếu báo giá');
  });

  it('requestNo lấy từ code, neededDate từ planned_date, requestDate là ngày tạo', () => {
    const h = toLegacyPrHeader(base, []);
    expect(h.requestNo).toBe('PR-0001');
    expect(h.neededDate).toBe('2026-11-20');
    expect(h.requestDate).toBe('2026-11-01');
    expect(h.remarks).toBe('ghi chú');
    expect(h.createdBy).toBe('u1');
  });

  it('không có cancelReason trên dự chi nên để null', () => {
    expect(toLegacyPrHeader(base, []).cancelReason).toBeNull();
  });
});

describe('toLegacyPrLine', () => {
  it('giữ mã hàng, mô tả, ghi chú để PO draft không mất mã', () => {
    const l = toLegacyPrLine(line('10', '2'));
    expect(l.itemCode).toBe('PT-01');
    expect(l.description).toBe('Bugi NGK');
    expect(l.notes).toBe('gấp');
    expect(l.estUnitPrice).toBe('50000.00');
    expect(l.estAmount).toBe('500000.00');
  });
});
