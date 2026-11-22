import type {
  TableColumnMap,
  TableSummaryColumn,
} from '@/common/utils/table-query';
import { vnDateSql } from '@/v2/core/base-core/helpers/vn-time.util';

/** Lãi gộp KGara khớp theo mã chứng từ + chi nhánh (subquery 1 dòng, không nhân dòng của danh sách). */
const gp = (col: string) =>
  `(SELECT g.${col} FROM kgara_gross_profit g WHERE g.vu_viec_code = "c"."case_code" AND g.branch_external_id = "c"."branch_external_id" ORDER BY g.updated_at DESC LIMIT 1)`;
const REVENUE = `COALESCE("c"."revenue", ${gp('doanh_thu')})`;
const COST = `COALESCE("c"."cost", ${gp('chi_phi')})`;
const PROFIT = `COALESCE("c"."profit", ${gp('loi_nhuan')}, CASE WHEN ${REVENUE} IS NOT NULL THEN ${REVENUE} - COALESCE(${COST}, 0) END)`;
const t = (sql: string) => ({ sql, type: 'text' as const });
const n = (sql: string) => ({ sql, type: 'number' as const });
const d = (sql: string) => ({ sql, type: 'date' as const });
/** Cột boolean so khớp như chuỗi 'true'/'false' qua bộ lọc chuẩn. */
const b = (sql: string) => t(`CAST(${sql} AS TEXT)`);
const col = (c: string) => `"c"."${c}"`;

/** Cột của danh sách vụ việc v2 (key camelCase EN). Alias `c` = cases_garage, `cat` = erp_module_categories. */
export const CASE_COLUMNS: TableColumnMap = {
  origin: t(col('origin')),
  caseCode: t(col('case_code')),
  externalId: t(col('external_id')),
  branchExternalId: t(col('branch_external_id')),
  accountKey: t(col('account_key')),
  licensePlate: t(col('license_plate')),
  chassisNumber: t(col('chassis_number')),
  vehicleBrandCode: t(col('vehicle_brand_code')),
  vehicleBrandName: t(col('vehicle_brand_name')),
  vehicleModelCode: t(col('vehicle_model_code')),
  vehicleModelName: t(col('vehicle_model_name')),
  manufactureYear: n(col('manufacture_year')),
  customerCode: t(col('customer_code')),
  customerName: t(col('customer_name')),
  customer: t(
    `CONCAT(COALESCE("c"."customer_name", ''), ' ', COALESCE("c"."customer_code", ''))`,
  ),
  customerSourceName: t(col('customer_source_name')),
  customerSourceCode: t(col('customer_source_code')),
  payerCode: t(col('payer_code')),
  payerName: t(col('payer_name')),
  status: t(col('status')),
  statusName: t(col('status_name')),
  kgaraStatusCode: n(col('kgara_status_code')),
  categoryId: t(col('category_id')),
  categoryCode: t('"cat"."code"'),
  categoryName: t('"cat"."name"'),
  classification: t('COALESCE("cat"."code", "c"."classification")'),
  excludeFromReports: b(col('exclude_from_reports')),
  excludeFromDebt: b(col('exclude_from_debt')),
  issuedAt: d(col('issued_at')),
  receivedAt: d(col('received_at')),
  completedAt: d(col('completed_at')),
  deliveredAt: d(col('delivered_at')),
  caseDate: d(vnDateSql('COALESCE("c"."received_at", "c"."issued_at")')),
  createdAt: d(col('created_at')),
  updatedAt: d(col('updated_at')),
  totalAmountWithTax: n(col('total_amount_with_tax')),
  paidAmount: n(col('paid_amount')),
  outstandingAmount: n(col('outstanding_amount')),
  revenue: n(REVENUE),
  cost: n(COST),
  profit: n(PROFIT),
  margin: n(
    `CASE WHEN COALESCE(${REVENUE}, 0) > 0 THEN ROUND((${PROFIT} / ${REVENUE} * 100)::numeric, 1) END`,
  ),
};

/** Cột `summaries` của danh sách (SQL cố định, không lấy từ input). */
export const CASE_SUMMARY_KEYS = [
  'revenue',
  'cost',
  'profit',
  'totalAmountWithTax',
  'paidAmount',
  'outstandingAmount',
];

const s = (c: string) => `"s"."${c}"`;
/** Cột của danh sách hạng mục: alias `s` = case_lines_garage, `c` = cases_garage. */
export const SERVICE_COLUMNS: TableColumnMap = {
  productCode: t(s('product_code')),
  productName: t(s('product_name')),
  description: t(s('description')),
  productTypeCode: t(s('product_type_code')),
  unitName: t(s('unit_name')),
  warehouseCode: t(s('warehouse_code')),
  quantity: n(s('quantity')),
  unitPrice: n(s('unit_price')),
  amountBeforeTax: n(s('amount_before_tax')),
  taxRate: n(s('tax_rate')),
  amountWithTax: n(s('amount_with_tax')),
  laborHours: n(s('labor_hours')),
  serviceAmount: n(s('service_amount')),
  partsAmount: n(s('parts_amount')),
  partsCost: n(s('parts_cost')),
  lineDiscountAmount: n(s('line_discount_amount')),
  surchargeAmount: n(s('surcharge_amount')),
  origin: t(col('origin')),
  caseCode: t(col('case_code')),
  licensePlate: t(col('license_plate')),
  customerName: t(col('customer_name')),
  customerCode: t(col('customer_code')),
  statusName: t(col('status_name')),
  classification: t(col('classification')),
  branchExternalId: t(col('branch_external_id')),
  caseDate: d(vnDateSql('COALESCE("c"."received_at", "c"."issued_at")')),
};

export const SERVICE_SUMMARY_COLUMNS: TableSummaryColumn[] = [
  'quantity',
  'amountBeforeTax',
  'amountWithTax',
  'serviceAmount',
  'partsAmount',
  'partsCost',
  'lineDiscountAmount',
  'surchargeAmount',
].map((key) => ({ key, sql: SERVICE_COLUMNS[key].sql }));
