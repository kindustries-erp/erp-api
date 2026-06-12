const fs = require('fs');
const crypto = require('crypto');

function uuidv4() {
  return crypto.randomUUID();
}

function escapeSql(str) {
  if (!str) return 'NULL';
  return "'" + str.replace(/'/g, "''") + "'";
}

const bomData = JSON.parse(fs.readFileSync('/opt/repos/liouni-erp-core/liouni-erp-web/bom_moi_k_lotus.json', 'utf8'));

// Normalize UOMs
const uoms = [...new Set(bomData.map(item => {
  let uom = item.don_vi.trim();
  if (uom.toUpperCase() === 'CÁI') return 'Cái';
  return uom;
}))];

let sql = '';
sql += `-- Auto-generated seed script for K LOTUS BOM\n\n`;

// 1. UOMs
const uomMap = {};
sql += `-- UOMs\n`;
uoms.forEach(u => {
  const id = uuidv4();
  uomMap[u] = id;
  const code = u.toUpperCase().replace(/\s+/g, '_');
  sql += `INSERT INTO public.erp_uoms (id, code, name, description, is_active) VALUES ('${id}', '${code}', ${escapeSql(u)}, ${escapeSql(u)}, true);\n`;
});
sql += `\n`;

// 2. Item Types
const fgTypeId = uuidv4();
const compTypeId = uuidv4();
sql += `-- Item Types\n`;
sql += `INSERT INTO public.erp_item_types (id, code, name, description, is_active) VALUES ('${fgTypeId}', 'FG', 'Thành phẩm', 'Finished Goods', true);\n`;
sql += `INSERT INTO public.erp_item_types (id, code, name, description, is_active) VALUES ('${compTypeId}', 'COMP', 'Linh kiện', 'Components', true);\n`;
sql += `\n`;

// 3. Inventory Items
const fgItemId = uuidv4();
sql += `-- Finished Good Item\n`;
sql += `INSERT INTO public.erp_inventory_items (id, sku, item_name, uom, item_type, status, note) VALUES ('${fgItemId}', 'FG-KLOTUS-PACEO', 'Xe điện K LOTUS/ PACEO', 'Cái', 'GOODS', 'ACTIVE', 'Auto-seeded finished good');\n`;
sql += `\n`;

let noCodeIndex = 1;
sql += `-- Component Items\n`;
const compItemMap = {}; // sku -> id
bomData.forEach(item => {
  let sku = item.ma_linh_kien ? item.ma_linh_kien.trim() : `COMP-NOCODE-${noCodeIndex++}`;
  if (!compItemMap[sku]) {
    const id = uuidv4();
    compItemMap[sku] = id;
    let uom = item.don_vi ? item.don_vi.trim() : 'Cái';
    if (uom.toUpperCase() === 'CÁI') uom = 'Cái';
    
    sql += `INSERT INTO public.erp_inventory_items (id, sku, item_name, uom, item_type, status, note) VALUES ('${id}', ${escapeSql(sku)}, ${escapeSql(item.ten_linh_kien_moi)}, ${escapeSql(uom)}, 'RAW', 'ACTIVE', ${escapeSql(item.ghi_chu)});\n`;
  }
});
sql += `\n`;

// 4. BOM Header
const bomId = uuidv4();
// Use the bom_code from the first item
const bomCode = bomData[0].ma_bom.trim();
sql += `-- BOM Header\n`;
sql += `INSERT INTO public.erp_boms (id, bom_code, bom_name, finished_good_item_id, version, status, effective_from, effective_to, notes) VALUES ('${bomId}', ${escapeSql(bomCode)}, 'BOM K LOTUS/ PACEO', '${fgItemId}', '1.0', 'ACTIVE', '2026-04-23', NULL, 'Auto-seeded BOM');\n`;
sql += `\n`;

// 5. BOM Lines
sql += `-- BOM Lines\n`;
let lineNo = 1;
noCodeIndex = 1;
bomData.forEach((item) => {
  const lineId = uuidv4();
  let sku = item.ma_linh_kien ? item.ma_linh_kien.trim() : `COMP-NOCODE-${noCodeIndex++}`;
  const compId = compItemMap[sku];
  let uom = item.don_vi ? item.don_vi.trim() : 'Cái';
  if (uom.toUpperCase() === 'CÁI') uom = 'Cái';
  
  const qty = parseFloat(item.so_luong) || 0;
  
  sql += `INSERT INTO public.erp_bom_lines (id, bom_id, line_no, component_item_id, qty_required, uom, scrap_rate, notes) VALUES ('${lineId}', '${bomId}', ${lineNo++}, '${compId}', ${qty}, ${escapeSql(uom)}, 0, ${escapeSql(item.ghi_chu)});\n`;
});
sql += `\n`;

fs.writeFileSync('/opt/repos/liouni-erp-core/liouni-erp-api/seed-bom-klotus.sql', sql);
console.log('Successfully generated seed-bom-klotus.sql');
