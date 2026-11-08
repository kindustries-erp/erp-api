import { AbstractStockVoucherCommandService } from './abstract-stock-voucher-command.service';

describe('AbstractStockVoucherCommandService', () => {
  it('được khai báo và có hàm chuyển trạng thái', () => {
    expect(AbstractStockVoucherCommandService).toBeDefined();
    expect(typeof AbstractStockVoucherCommandService.prototype.transition).toBe(
      'function',
    );
  });
});
