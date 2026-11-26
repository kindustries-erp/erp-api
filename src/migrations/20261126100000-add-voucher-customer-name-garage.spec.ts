import { QueryRunner } from 'typeorm';
import { AddVoucherCustomerNameGarage20261126100000 } from './20261126100000-add-voucher-customer-name-garage';

describe('AddVoucherCustomerNameGarage20261126100000', () => {
  const makeRunner = () => {
    const query = jest.fn(() => Promise.resolve([]));
    return { runner: { query } as unknown as QueryRunner, query };
  };
  const sqlOf = (query: jest.Mock) =>
    query.mock.calls.map((c: unknown[]) => c[0] as string).join('\n');

  it('up() thêm cột tên trên phiếu ở V1 và V2', async () => {
    const { runner, query } = makeRunner();
    await new AddVoucherCustomerNameGarage20261126100000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      'ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "ten_khach_hang" varchar(255) NULL',
    );
    expect(sql).toContain(
      'ALTER TABLE "cases_garage" ADD COLUMN IF NOT EXISTS "voucher_customer_name" varchar(255) NULL',
    );
  });

  it('up() backfill V1 từ raw_data.TenKhachHang và chỉ xóa tên danh mục bị gộp', async () => {
    const { runner, query } = makeRunner();
    await new AddVoucherCustomerNameGarage20261126100000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      `SET "ten_khach_hang" = NULLIF("raw_data"->>'TenKhachHang', '')`,
    );
    expect(sql).toMatch(
      /SET "khach_hang_name" = NULL[\s\S]*NULLIF\("raw_data"->>'KhachHangName', ''\) IS NULL[\s\S]*"khach_hang_name" = NULLIF\("raw_data"->>'TenKhachHang', ''\)/,
    );
  });

  it('up() chép sang V2 theo id, giữ customerName đã sửa tay', async () => {
    const { runner, query } = makeRunner();
    await new AddVoucherCustomerNameGarage20261126100000().up(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(
      `jsonb_build_object('voucherCustomerName', k."ten_khach_hang")`,
    );
    expect(sql).toContain(`WHEN c."overrides" ? 'customerName'`);
    expect(sql).toContain('WHERE k."id" = c."id"');
  });

  it('down() xóa cột và khóa snapshot/override', async () => {
    const { runner, query } = makeRunner();
    await new AddVoucherCustomerNameGarage20261126100000().down(runner);
    const sql = sqlOf(query);
    expect(sql).toContain(`"source_snapshot" - 'voucherCustomerName'`);
    expect(sql).toContain(`"overrides" - 'voucherCustomerName'`);
    expect(sql).toContain(
      'ALTER TABLE "cases_garage" DROP COLUMN IF EXISTS "voucher_customer_name"',
    );
    expect(sql).toContain(
      'ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "ten_khach_hang"',
    );
  });
});
