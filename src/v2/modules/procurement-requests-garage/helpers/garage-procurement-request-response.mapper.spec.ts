import type { GarageProcurementRequest } from '../entities/procurement-request.entity';
import { toGarageProcurementRequestResponse } from './garage-procurement-request-response.mapper';

const header = (over: Partial<GarageProcurementRequest> = {}) =>
  ({
    id: 'r1',
    extraData: {},
    requestNo: 'GDNM-0001',
    requestDate: '2026-11-23',
    neededDate: null,
    title: null,
    requesterEmployeeId: null,
    status: 'DRAFT',
    orderingStatus: 'NONE',
    estimatedTotal: '0',
    remarks: null,
    createdBy: null,
    branchId: 'b1',
    branchName: 'Tên riêng',
    sourceSnapshot: { branchName: 'Chi nhánh 1' },
    overrides: { branchName: true },
    ...over,
  }) as unknown as GarageProcurementRequest;

describe('toGarageProcurementRequestResponse', () => {
  it('trả chi nhánh, danh sách field đã override và snapshot nguồn', () => {
    const out = toGarageProcurementRequestResponse(header(), []);
    expect(out.branchId).toBe('b1');
    expect(out.branchName).toBe('Tên riêng');
    expect(out.overriddenFields).toEqual(['branchName']);
    expect(out.sourceSnapshot).toEqual({ branchName: 'Chi nhánh 1' });
    expect(out.requestNo).toBe('GDNM-0001');
  });

  it('chưa liên kết: branch null, không có override, snapshot rỗng', () => {
    const out = toGarageProcurementRequestResponse(
      header({
        branchId: null,
        branchName: null,
        sourceSnapshot: undefined as never,
        overrides: undefined as never,
      }),
      [],
    );
    expect(out.branchId).toBeNull();
    expect(out.branchName).toBeNull();
    expect(out.overriddenFields).toEqual([]);
    expect(out.sourceSnapshot).toEqual({});
  });
});
