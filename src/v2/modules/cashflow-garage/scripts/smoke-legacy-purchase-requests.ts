/**
 * smoke-legacy-purchase-requests.ts — smoke ghi PR Garage trên dự chi (cờ new), tầng service, không boot app.
 *
 * Chỉ tạo dữ liệu có tiền tố [TEST]. Luồng:
 *   1. Tạo nháp PR A (2 dòng) -> đọc lại, kiểm mã hàng và tổng.
 *   2. Gửi duyệt (khóa duyệt LEGACY: chờ duyệt, không chọn người duyệt).
 *   3. Duyệt bởi người khác người tạo -> OPEN (PR APPROVED).
 *   4. Đặt hàng 1 đơn vị rồi trả lại (reserve/release trên dòng dự chi) -> tiến độ PARTIAL rồi NONE.
 *   5. Hủy PR A có lý do -> CANCELLED, nhật ký có 3 bước.
 *   6. Tạo nháp PR B rồi xóa mềm -> không còn trong danh sách.
 *
 * Không boot AppModule (tránh các job đồng bộ nền). Chỉ dựng các service cần thiết với DataSource riêng.
 * Mặc định chỉ in kế hoạch. --apply ghi DB và BẮT BUỘC kèm --confirm=<tên DB thực tế>.
 *
 * Chạy (trong thư mục erp-api):
 *   TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register -r tsconfig-paths/register src/v2/modules/cashflow-garage/scripts/smoke-legacy-purchase-requests.ts --target=greenway-staging --apply --confirm=erp_greenway_staging
 */

import { DataSource } from 'typeorm';
import { Client } from 'pg';
import {
  describeScriptEnv,
  resolveScriptEnv,
  ScriptEnvError,
} from '../../../../common/scripts/load-script-env';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { CashflowPurchaseOrderingService } from '@/v2/modules/procurement-orders-garage/services/cashflow-purchase-ordering.service';
import { LegacyPurchaseRequestQueryService } from '../compat/legacy-purchase-request-query.service';
import { LegacyPurchaseRequestWriteService } from '../compat/legacy-purchase-request-write.service';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const confirm = args
  .find((a) => a.startsWith('--confirm='))
  ?.slice('--confirm='.length);

const TODAY = new Date().toISOString().slice(0, 10);

function log(step: string, detail = ''): void {
  console.log(`  ${step}${detail ? ` — ${detail}` : ''}`);
}

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(`KHÔNG KHỚP: ${message}`);
  console.log(`  [OK] ${message}`);
}

async function main(): Promise<void> {
  console.log(
    '================================================================',
  );
  console.log('SMOKE PR GARAGE TRÊN DỰ CHI (cờ new, tầng service)');
  console.log(
    '================================================================',
  );

  // Cờ đọc khi gọi, nên đặt trước khi chạy dịch vụ.
  process.env.CASHFLOW_GARAGE_SOURCE = 'new';

  const scriptEnv = resolveScriptEnv({ argv: args });
  console.log(
    describeScriptEnv(scriptEnv, { apply: APPLY, allowed: true, message: '' }),
  );
  if (!scriptEnv.explicit && scriptEnv.isProduction) {
    throw new ScriptEnvError(
      'Env mặc định đang trỏ DB production. Hãy chỉ định env tường minh.',
    );
  }

  const probe = new Client({
    connectionString: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
  });
  await probe.connect();
  const dbName = (
    await probe.query<{ db: string }>('SELECT current_database() AS db')
  ).rows[0].db;
  const users = (
    await probe.query<{ id: string }>(
      'SELECT id FROM core_users ORDER BY created_at LIMIT 2',
    )
  ).rows;
  await probe.end();
  console.log(`Database thực tế: ${dbName}`);

  if (!APPLY) {
    console.log(
      '\nKẾ HOẠCH (chưa ghi). Thêm --apply --confirm=' + dbName + ' để chạy.',
    );
    return;
  }
  if (confirm !== dbName) {
    throw new ScriptEnvError(
      `--apply cần --confirm=${dbName} (khớp đúng tên DB thực tế).`,
    );
  }
  if (users.length < 2)
    throw new Error('Cần ít nhất 2 người dùng để kiểm duyệt khác người tạo.');
  const [creator, approver] = users.map((u) => u.id);

  const ds = new DataSource({
    type: 'postgres',
    url: scriptEnv.databaseUrl,
    ssl: scriptEnv.ssl,
    entities: [__dirname + '/../../../../**/*.entity.{ts,js}'],
    synchronize: false,
  });
  await ds.initialize();
  try {
    const events = new ApprovalEventService();
    const write = new LegacyPurchaseRequestWriteService(ds, events);
    const query = new LegacyPurchaseRequestQueryService(ds);
    const ordering = new CashflowPurchaseOrderingService();

    console.log('\n1. Tạo nháp PR A');
    const aId = await write.createDraft(
      { id: creator, roles: [] },
      {
        requestDate: TODAY,
        neededDate: TODAY,
        title: '[TEST] smoke A',
        remarks: '[TEST] smoke',
      },
      [
        {
          lineType: 'GOODS',
          qtyRequested: 2,
          estUnitPrice: 1000,
          itemCode: 'TEST-01',
          itemName: '[TEST] hàng 1',
          notes: '[TEST]',
        },
        {
          lineType: 'SERVICE',
          qtyRequested: 1,
          estUnitPrice: 500,
          itemName: '[TEST] dịch vụ 2',
        },
      ],
    );
    let a = await query.findOne(aId);
    assert(a.header.status === 'DRAFT', 'PR A là nháp');
    assert(a.lines.length === 2, 'PR A có 2 dòng');
    assert(
      a.lines.some((l) => l.itemCode === 'TEST-01'),
      'mã hàng TEST-01 được giữ trên dòng',
    );
    assert(
      Number(a.header.estimatedTotal) === 2500,
      'tổng dự kiến = 2*1000 + 1*500',
    );

    console.log('\n2. Gửi duyệt');
    // transition tự mở transaction; cùng luồng với API.
    await write.transition(
      aId,
      'submit',
      { id: creator, roles: [] },
      undefined,
      null,
    );
    a = await query.findOne(aId);
    assert(a.header.status === 'PENDING_APPROVAL', 'PR A chờ duyệt');

    console.log('\n3. Duyệt bởi người khác');
    await write.transition(
      aId,
      'approve',
      { id: approver, roles: [] },
      undefined,
      null,
    );
    a = await query.findOne(aId);
    assert(a.header.status === 'APPROVED', 'PR A đã duyệt (APPROVED)');

    console.log('\n4. Đặt hàng 1 đơn vị rồi trả lại');
    const lineId = a.lines[0].id;
    await ds.transaction((m) =>
      ordering.reserve(m, aId, [{ requestLineId: lineId, qty: 1 }]),
    );
    a = await query.findOne(aId);
    assert(
      a.header.orderingStatus === 'PARTIAL',
      'tiến độ đặt hàng PARTIAL sau khi giữ 1',
    );
    await ds.transaction((m) =>
      ordering.release(m, aId, [{ requestLineId: lineId, qty: 1 }]),
    );
    a = await query.findOne(aId);
    assert(
      a.header.orderingStatus === 'NONE',
      'tiến độ đặt hàng NONE sau khi trả lại',
    );

    console.log('\n5. Hủy PR A');
    await write.transition(
      aId,
      'cancel',
      { id: approver, roles: [] },
      '[TEST] smoke hủy',
      null,
    );
    a = await query.findOne(aId);
    assert(a.header.status === 'CANCELLED', 'PR A đã hủy');
    const ev = await query.approvalEvents(aId);
    assert(ev.length === 3, `nhật ký PR A có 3 bước (thực tế ${ev.length})`);

    console.log('\n6. Nháp PR B rồi xóa mềm');
    const bId = await write.createDraft(
      { id: creator, roles: [] },
      { requestDate: TODAY, title: '[TEST] smoke B' },
      [
        {
          lineType: 'GOODS',
          qtyRequested: 1,
          estUnitPrice: 10,
          itemName: '[TEST] B',
        },
      ],
    );
    await write.softDeleteDraft(bId);
    const list = await query.list({ search: '[TEST] smoke B', pageSize: 50 });
    assert(
      !list.rows.some((r) => r.id === bId),
      'PR B đã xóa mềm, không còn trong danh sách',
    );

    console.log(
      `\nKẾT QUẢ: KHỚP. Dữ liệu thử còn lại: PR A (id ${aId}, CANCELLED, [TEST]); PR B đã xóa mềm (id ${bId}).`,
    );
    log(
      'Ghi chú',
      'PR A không xóa được vì đã duyệt; cần OK riêng nếu muốn xóa hẳn.',
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('ERR', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
