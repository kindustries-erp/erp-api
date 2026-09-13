import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  console.log('--- Bắt đầu seed data As-Built BOM ---');

  const getFirst = async (table: string, cond: string) => {
    const res = await dataSource.query(
      `SELECT id FROM ${table} ${cond} LIMIT 1`,
    );
    return res.length ? res[0].id : null;
  };

  const pcsUomId =
    (await getFirst('erp_uoms', "WHERE code = 'PCS'")) ||
    (await getFirst('erp_uoms', ''));
  const fgTypeId =
    (await getFirst('erp_item_types', "WHERE code = 'FG'")) ||
    (await getFirst('erp_item_types', ''));
  const rawTypeId =
    (await getFirst('erp_item_types', "WHERE code = 'RAW'")) ||
    (await getFirst('erp_item_types', ''));
  const vehiclePolicyId = await getFirst(
    'erp_tracking_policies',
    "WHERE code = 'VEHICLE'",
  );
  const serialPolicyId = await getFirst(
    'erp_tracking_policies',
    "WHERE code = 'SERIAL'",
  );

  if (
    !pcsUomId ||
    !fgTypeId ||
    !rawTypeId ||
    !vehiclePolicyId ||
    !serialPolicyId
  ) {
    console.error('Thiếu master data. Dừng seed.');
    process.exit(1);
  }

  // 1. Tạo xe thành phẩm
  let carItem = await dataSource.query(
    `SELECT id FROM erp_inventory_items WHERE sku = 'TEST-CAR-01'`,
  );
  if (!carItem.length) {
    carItem = await dataSource.query(
      `
      INSERT INTO erp_inventory_items (sku, item_name, item_type_id, uom_id, tracking_policy_id)
      VALUES ('TEST-CAR-01', 'Xe Test As-Built BOM 01', $1, $2, $3)
      RETURNING id
    `,
      [fgTypeId, pcsUomId, vehiclePolicyId],
    );
    console.log('Tạo thành công xe TEST-CAR-01');
  }

  // 2. Tạo linh kiện
  let motorItem = await dataSource.query(
    `SELECT id FROM erp_inventory_items WHERE sku = 'TEST-MOTOR-01'`,
  );
  if (!motorItem.length) {
    motorItem = await dataSource.query(
      `
      INSERT INTO erp_inventory_items (sku, item_name, item_type_id, uom_id, tracking_policy_id)
      VALUES ('TEST-MOTOR-01', 'Động cơ điện Test', $1, $2, $3)
      RETURNING id
    `,
      [rawTypeId, pcsUomId, serialPolicyId],
    );
    console.log('Tạo thành công động cơ TEST-MOTOR-01');
  }

  let batteryItem = await dataSource.query(
    `SELECT id FROM erp_inventory_items WHERE sku = 'TEST-BATT-01'`,
  );
  if (!batteryItem.length) {
    batteryItem = await dataSource.query(
      `
      INSERT INTO erp_inventory_items (sku, item_name, item_type_id, uom_id, tracking_policy_id)
      VALUES ('TEST-BATT-01', 'Pin xe điện Test', $1, $2, $3)
      RETURNING id
    `,
      [rawTypeId, pcsUomId, serialPolicyId],
    );
    console.log('Tạo thành công pin TEST-BATT-01');
  }

  // 3. Tạo BOM
  const carId = carItem[0].id;
  const motorId = motorItem[0].id;
  const batteryId = batteryItem[0].id;

  let bom = await dataSource.query(
    `SELECT id FROM erp_boms WHERE finished_good_item_id = $1`,
    [carId],
  );
  if (!bom.length) {
    bom = await dataSource.query(
      `
      INSERT INTO erp_boms (finished_good_item_id, bom_code, bom_name, version, status)
      VALUES ($1, 'BOM-TEST-CAR-01', 'BOM Xe Test', '1.0', 'ACTIVE')
      RETURNING id
    `,
      [carId],
    );

    const bomId = bom[0].id;
    await dataSource.query(
      `
      INSERT INTO erp_bom_lines (bom_id, line_no, component_item_id, qty_required, uom_id)
      VALUES 
      ($1, 1, $2, 1, $4),
      ($1, 2, $3, 1, $4)
    `,
      [bomId, motorId, batteryId, pcsUomId],
    );
    console.log('Tạo thành công BOM cho TEST-CAR-01');
  }

  console.log('--- Hoàn thành seed data ---');
  console.log('Hướng dẫn test:');
  console.log(
    '1. Vào chức năng Nhập kho, tạo Goods Receipt cho 10 Động cơ và 10 Pin (để sinh ra 20 serial trong kho).',
  );
  console.log(
    '2. Vào Lệnh sản xuất, tạo MO cho Xe Test As-Built BOM 01, SL: 2.',
  );
  console.log(
    '3. Hoàn thành sản xuất (nhập 2 VIN/Engine). Hệ thống sẽ tự FIFO serial.',
  );
  console.log(
    '4. Gọi API GET /erp-manufacturing/items/vehicles/:id/as-built-bom để kiểm tra kết quả nối serial với xe.',
  );

  await app.close();
}
bootstrap();
