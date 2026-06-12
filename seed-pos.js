const fs = require('fs');

const inputPath = '/opt/repos/liouni-erp-core/liouni-erp-web/k_lotus_purchase_orders_strict.json';
const outputPath = '/opt/repos/liouni-erp-core/liouni-erp-api/seed-pos.sql';

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

let sql = ``;

for (const po of data) {
  const id = po.id ? `'${po.id}'` : 'gen_random_uuid()';
  const poNo = po.poNo ? `'${po.poNo}'` : 'NULL';
  const supplierId = po.supplierId ? `'${po.supplierId}'` : 'NULL';
  const orderDate = po.orderDate ? `'${po.orderDate}'` : 'CURRENT_TIMESTAMP';
  const expectedDate = po.expectedDate ? `'${po.expectedDate}'` : 'NULL';
  const status = po.status ? `'${po.status}'` : `'ACTIVE'`;
  const paymentStatus = po.paymentStatus ? `'${po.paymentStatus}'` : `'UNPAID'`;
  const remarks = po.remarks ? `'${po.remarks.replace(/'/g, "''")}'` : 'NULL';
  const createdAt = po.createdAt ? `'${po.createdAt}'` : 'CURRENT_TIMESTAMP';
  const updatedAt = po.updatedAt ? `'${po.updatedAt}'` : 'CURRENT_TIMESTAMP';

  sql += `INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    ${id}, ${poNo}, ${supplierId}, ${orderDate}, ${expectedDate}, ${status}, ${paymentStatus}, ${remarks}, ${createdAt}, ${updatedAt}
  );\n`;

  if (po.lines && po.lines.length > 0) {
    for (const line of po.lines) {
      const lineId = line.id ? `'${line.id}'` : 'gen_random_uuid()';
      const lineNo = line.lineNo || 1;
      const itemId = line.itemId ? `'${line.itemId}'` : 'NULL';
      const description = line.description ? `'${line.description.replace(/'/g, "''")}'` : 'NULL';
      const qtyOrdered = line.qtyOrdered ? `'${line.qtyOrdered}'` : `'0'`;
      const qtyReceived = line.qtyReceived ? `'${line.qtyReceived}'` : `'0'`;
      const unitPrice = line.unitPrice ? `'${line.unitPrice}'` : `'0'`;
      const amount = line.amount ? `'${line.amount}'` : `'0'`;

      sql += `INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        ${lineId}, ${id}, ${lineNo}, ${itemId}, ${description}, ${qtyOrdered}, ${qtyReceived}, ${unitPrice}, ${amount}
      );\n`;
    }
  }
}

fs.writeFileSync(outputPath, sql);
console.log(`Successfully generated ${outputPath} with ${data.length} POs.`);
