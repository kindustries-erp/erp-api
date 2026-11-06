import { ErpAction, ErpResource } from '@/v2/core/rbac';

export interface AvailableRbacResource {
  resource: string;
  label: string;
  /** Action bổ sung ngoài CRUD mà resource này hỗ trợ (ví dụ approve/reject). */
  actions?: string[];
}

const PROCUREMENT_APPROVAL_ACTIONS = [ErpAction.APPROVE, ErpAction.REJECT];

/** Danh sách resource RBAC hiển thị cho UI gán quyền. Dữ liệu tĩnh (không tính ngưỡng kích thước). */
export const AVAILABLE_RBAC_RESOURCES: AvailableRbacResource[] = [
  { resource: '*', label: 'All Resources (Super Admin)' },
  { resource: 'admin_users', label: 'Admin Users' },
  { resource: 'employees', label: 'Employees' },
  { resource: 'business_partners', label: 'Business Partners' },
  { resource: 'purchase_orders', label: 'Purchase Orders' },
  { resource: 'sales_orders', label: 'Sales Orders' },
  { resource: 'inventory_items', label: 'Inventory Items' },
  { resource: 'inventory_vouchers', label: 'Chứng từ kho' },
  { resource: 'goods_receipts', label: 'Goods Receipts' },
  { resource: 'goods_issues', label: 'Goods Issues' },
  { resource: 'inventory_adjustments', label: 'Điều chỉnh kho' },
  { resource: 'bom', label: 'BOM' },
  { resource: 'production', label: 'Production' },
  { resource: 'activity_logs', label: 'Activity Logs' },
  { resource: 'email_ingest', label: 'Email Ingest / Hộp thư' },
  { resource: 'journal_entries', label: 'Journal Entries (Kế toán)' },
  { resource: 'garage', label: 'Garage (Xưởng dịch vụ)' },
  { resource: 'garage_debts', label: 'Công nợ Garage' },
  { resource: 'garage_cashflow', label: 'Thu chi xưởng (Garage Cashflow)' },
  {
    resource: ErpResource.GARAGE_GOODS_RECEIPTS,
    label: 'Nhập kho Garage (Garage Goods Receipts)',
  },
  {
    resource: 'accounting_configs',
    label: 'Accounting Configs (Cấu hình kế toán)',
  },
  { resource: 'invoices', label: 'Hóa đơn' },
  {
    resource: 'invoice_debts',
    label: 'Công nợ (Khách hàng & Nhà cung cấp)',
  },
  { resource: 'sales_reports', label: 'Sales Reports' },
  { resource: 'purchasing_reports', label: 'Purchasing Reports' },
  { resource: 'sys_tags', label: 'Tags' },
  {
    resource: 'bank_statements',
    label: 'Bank Statements & Accounts (Ngân hàng)',
  },
  {
    resource: 'cash_statements',
    label: 'Cash Statements & Books (Sổ quỹ tiền mặt)',
  },
  {
    resource: 'purchase_requests',
    label: 'Purchase Requests / Yêu cầu mua hàng',
  },
  {
    resource: 'procurement_requests',
    label: 'Đề nghị mua hàng (Procurement Requests)',
    actions: PROCUREMENT_APPROVAL_ACTIONS,
  },
  {
    resource: 'procurement_orders',
    label: 'Đơn mua hàng mới (Procurement Orders)',
    actions: PROCUREMENT_APPROVAL_ACTIONS,
  },
  {
    resource: 'garage_procurement_requests',
    label: 'Đề nghị mua hàng Garage (Garage Procurement Requests)',
    actions: PROCUREMENT_APPROVAL_ACTIONS,
  },
  {
    resource: 'garage_procurement_orders',
    label: 'Đơn mua hàng Garage mới (Garage Procurement Orders)',
    actions: PROCUREMENT_APPROVAL_ACTIONS,
  },
  { resource: 'vehicles', label: 'Vehicles / Xe cộ' },
  {
    resource: 'vinfast',
    label: 'Vinfast (Phụ tùng & Xưởng)',
  },
  { resource: 'dashboard', label: 'Dashboard / Tổng quan hệ thống' },
  { resource: 'attachments', label: 'Attachments / Quản lý tài liệu' },
];
