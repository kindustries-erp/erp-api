import { GarageVoucherCodeService } from './garage-voucher-code.service';

function make(count: number) {
  const repo = {
    createQueryBuilder: () => ({
      where: jest.fn().mockReturnThis(),
      getCount: async () => count,
    }),
  };
  return new GarageVoucherCodeService(repo as never);
}

describe('GarageVoucherCodeService', () => {
  it('lấy số thứ tự tiếp theo trong ngày', async () => {
    const code = await make(4).next('RECEIPT', '2026-11-17', async () => false);
    expect(code).toBe('PT-GARA-261117-005');
  });

  it('bỏ qua mã đã bị chiếm, thử số kế tiếp', async () => {
    const taken = new Set(['PC-GARA-261117-001', 'PC-GARA-261117-002']);
    const code = await make(0).next('PAYMENT', '2026-11-17', async (c) =>
      taken.has(c),
    );
    expect(code).toBe('PC-GARA-261117-003');
  });
});
