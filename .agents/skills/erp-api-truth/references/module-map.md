<!-- GENERATED FILE - DO NOT EDIT. Sinh bởi .agents/scripts/gen-module-map.sh từ frontmatter modules/*/SKILL.md. Muốn đổi dòng nào: sửa `description` trong frontmatter của module đó rồi chạy /sync-agents. -->
# Bản đồ module

Tra module cần sửa ở bảng dưới, rồi đọc `../../modules/<module>/SKILL.md` của module đó (đường dẫn tính từ thư mục chứa file này).

| Module | Mô tả |
| :--- | :--- |
| `admin-dashboard-core` | Module backend cung cấp API tổng quan điều hành và quản trị hệ thống (/api/v2/admin/dashboard/summary) cho Cổng Quản trị V2 Admin Portal |
| `after-sales` | Module tri thức Quản lý Sau bán hàng, Vòng đời Serial Xe/Linh kiện, Bàn giao Xe & Bảo hành Điện tử (After-Sales & Warranty Lifecycles) trong… |
| `ai-hub-core` | Module tri thức AI Hub Core & 9router Gateway Integration trong erp-api (ai-hub-core) |
| `ai-hub-v2` | Tri thức AI Hub v2 trong erp-api (lõi v2/core/ai-hub-core, module ai-hub-gateway gọi 9router theo tier, items-core + items-garage là danh mụ… |
| `app-config` | Module tri thức Quản lý Cấu hình Ứng dụng & Tùy chọn Người dùng (App Config & User Preferences) trong erp-api (app-config & users) |
| `audit-core` | Module tri thức Nhật ký Kiểm toán Hệ thống (Audit Logs & Zero-Trust Tracking) trong erp-api (audit-core) |
| `auth-core` | Lõi base (v2) cho phiên đăng nhập tại src/v2/core/auth-core |
| `auth-sessions` | Module backend Auth V2 tại /api/v2/auth-sessions (login, refresh, logout, impersonate, change-password, profile) |
| `bank-statement` | Module tri thức Quản lý Sao kê Ngân hàng & Sổ quỹ Tiền mặt (Bank Statements & Cash Books) trong erp-api (bank-transactions-core) |
| `banks-management` | Tri thức backend cho module Quản lý ngân hàng V2 (banks-management) và lõi base-only banks-core trong erp-api |
| `bom-core` | Module tri thức Định mức vật tư (BOM - Bill of Materials) trong erp-api |
| `branches-core` | Contract hiện hành của chi nhánh ERP trong kiến trúc API v2 core + management module |
| `business-partners-core` | Module tri thức Đối tác (Khách hàng & Nhà cung cấp) phía API erp-api (src/v2/core/business-partners-core & src/v2/modules/business-partners-… |
| `cases-garage` | Module vụ việc garage v2 (api/v2/cases-garage), CRUD đầy đủ trên bảng cases_garage + case_services_garage, xe NATIVE nhập tay và xe KGARA_SY… |
| `cashflow-dashboard` | Module tri thức Báo cáo, Phân tích & Dự báo Dòng tiền (Cashflow Dashboard & Forecast) trong ERP (dashboard-core & bank-transactions-core) |
| `cashflow-vouchers-core` | Lõi phiếu thu chi dùng chung v2 (src/v2/core/cashflow-vouchers-core) - entity base BaseCashflowVoucherEntity, kiểu loại và trạng thái phiếu |
| `cashflow-vouchers-garage` | Module phiếu thu chi garage v2 (api/v2/cashflow-vouchers-garage) phần đọc - danh sách, column-options, dashboard, kiểm tra trùng; kế thừa ca… |
| `debts-core` | Lõi công nợ dùng chung v2 (src/v2/core/debts-core) - hợp đồng, entity base sổ nợ và phân bổ, engine tính số dư và tuổi nợ, khung query abstr… |
| `debts-flow-garage` | Orchestrator thu chi + công nợ garage v2 - ghi phiếu và phân bổ trong một transaction, mirror sang bảng V1 cùng UUID, projector chiếu thay đ… |
| `debts-garage` | Module công nợ garage v2 (api/v2/debts-garage) - công nợ phải thu khách hàng, phải trả nhà cung cấp, analytics, time-horizon, export nền |
| `employees-core` | Module tri thức Nhân viên V2 trong erp-api gồm lõi src/v2/core/employees-core và module src/v2/modules/employees-management (route /api/v2/e… |
| `erp-inventory-adjustments` | Module tri thức Quản lý Kiểm kê & Điều chỉnh Kho trong ERP |
| `erp-inventory-items` | Module tri thức Danh mục Mặt hàng & Master Data Kho trong ERP |
| `erp-inventory-stock` | Module tri thức Sổ Tồn kho Thực tế & Định giá Tồn kho trong ERP |
| `erp-inventory-tracking` | Module tri thức Quản lý Định danh & Truy xuất Nguồn gốc Tồn kho (Serials, VINs, Lots, Custom Barcodes, Serial Lifecycle) trong ERP |
| `erp-inventory-transactions` | Module tri thức Sổ Nhật ký Giao dịch Kho & Sổ cái Phẳng (Inventory Flat Ledger) trong ERP |
| `erp-inventory-vouchers` | Module tri thức Trung tâm Tra cứu Chứng từ Kho Tổng hợp (Warehouse Vouchers Hub) trong ERP |
| `erp-invoice` | Module tri thức Quản lý Hóa đơn Điện tử & Hóa đơn Thuế (ERP Invoices) trong erp-api (erp-invoices-core) |
| `erp-procurement-orders` | Module tri thức Đơn mua (Procurement Order, PO) họ ERP thường trong erp-api |
| `erp-procurement-requests` | Module tri thức Đề nghị mua (Purchase Request) họ ERP thường trong erp-api |
| `erp-sales-orders` | Module tri thức Quản lý Đơn bán hàng (Sales Orders) trong erp-api (sales-orders-core) |
| `erp-suppliers` | Module tri thức Quản lý Đối Tác Kinh Doanh (Khách Hàng & Nhà Cung Cấp / Business Partners) trong erp-api (business-partners-core) và erp-web |
| `erp-users` | Module tri thức Quản lý Người dùng & Tài khoản Hệ thống (ERP Users / User Management) trong erp-api (V1: users & users-admin; V2: users-mana… |
| `file-attachments` | Module backend file đính kèm dùng chung (v2) tại /api/v2/file-attachments-management và /api/v2/invoices/:id/attachments, bảng file_attachme… |
| `garage-bank-reconciliation` | Module tri thức Đối Soát Sao Kê Ngân Hàng Với Phiếu Dịch Vụ Garage & Tạo Phiếu Thu Xưởng (Bank Statement to Garage Case Reconciliation & Cas… |
| `garage-cases` | Module tri thức Quản lý Vụ việc Dịch vụ Garage & Sửa chữa xe (Garage Cases, Service Lines, Receivables, Payables, Auto-Sync & Gross Profit A… |
| `garage-cashflow` | Module tri thức Quản lý Thu Chi Xưởng (Garage Cashflow) trong erp-api (kgara-api-core) |
| `garage-customers` | Module tri thức Quản lý Hồ sơ & Sổ Công nợ Khách Hàng Garage (Garage Customers Debt, Aging Buckets, Pure Cashflow Settlements & Detail Drawe… |
| `garage-dashboard` | Module tri thức Dashboard, Báo cáo Hiệu quả Garage, Quản lý Chi phí vận hành (OPEX) & Báo cáo Lợi nhuận (P&L) trong erp-api (kgara-api-core) |
| `garage-goods-receipts` | Module tri thức Quản lý Nhập kho và Quản lý kho Garage (Garage Goods Receipts & Inventory) trong erp-api (v2/modules/goods-receipts-garage) … |
| `garage-invoice-reconciliation` | Module tri thức Đối soát & Cấn trừ Đa chiều giữa Phiếu Dịch Vụ Garage (kgara_cases), Hóa đơn Điện tử VAT (erp_invoices) và Sao kê Ngân hàng … |
| `garage-opex` | Module tri thức Quản lý Chi phí Vận hành (OPEX), Giá vốn nhập tay & Hoa hồng Garage trong erp-api (kgara-api-core) |
| `garage-procurement-orders` | Module tri thức Đơn mua (Procurement Order, PO) họ Garage trong erp-api |
| `garage-procurement-requests` | Module tri thức Đề nghị mua (Purchase Request) họ Garage trong erp-api |
| `goods-receipts-core` | Module tri thức Nền tảng Chứng Từ Nhập Kho & Base Voucher Engine V2 (goods-receipts-core) trong erp-api (v2/core/goods-receipts-core) |
| `inventory-dashboard` | Module tri thức Dashboard Phân tích & Báo cáo Tồn kho Tổng quan trong ERP |
| `inventory-movements-core` | Lõi v2 nhập / xuất / điều chỉnh kho dùng chung (sổ số dư, sổ giao dịch, lớp giá FIFO, engine cộng/trừ tồn có khóa, nền chứng từ có dòng), và… |
| `invoice-dashboard` | Module tri thức Dashboard & Báo cáo Phân tích Hóa đơn (Invoice Dashboard, Cash Trend, VAT Stats, Partner Debt & Multi-sheet Excel Export) tr… |
| `invoice-debts` | Module tri thức Quản lý Báo cáo Công nợ Khách hàng & Nhà cung cấp (Invoice Debts & Aging Analysis) trong ERP (erp-invoices-core) |
| `invoice-netoff` | Module tri thức Quản lý Cấn trừ Hóa đơn & Chứng từ Thanh toán (Smart Net-Off Engine / Invoice-Voucher Net-Off) trong ERP (erp-invoices-core … |
| `items-core` | Lõi v2 danh mục mã hàng (src/v2/core/items-core): entity nền, hàm mã và khớp thuần, khung AbstractItemMatchService và cổng ItemCatalogPort |
| `items-garage` | Module v2 danh mục mã hàng garage (bảng items_garage, route api/v2/items-garage, resource garage_items), kế thừa lõi items-core |
| `journal-entry` | Module tri thức Sổ Nhật Ký Chung & Bút toán Tổng hợp (General Journal & Journal Entries) trong erp-api (accounting-core) và erp-web |
| `loans-tool` | Module tri thức Quản lý Khoản Vay & Dự báo Dòng Tiền Tương Lai (Loans & Cashflow Simulator V2) trong erp-api (v2/core/loans-core và v2/modul… |
| `module-config` | Module tri thức Quản lý Cấu hình Danh mục, Thuộc tính động & Thuộc tính chung Đa Module (Dynamic Module Categories, Custom Fields & Global A… |
| `notifications-inbox` | Module backend thông báo theo user (v2) tại /api/v2/notifications-inbox, bảng notifications_inbox, chạy song song v1 /notifications |
| `operating-expenses` | Module tri thức Quản lý Chi phí Vận hành (Operating Expenses), Hạch toán Trích trước & Tất toán Hóa đơn chống Double Chi phí trong erp-api (… |
| `procurement-flow-garage` | Orchestrator chuỗi mua garage (PR → PO → nhận hàng GR → sổ tồn garage_stock_*, kèm thông báo sau commit) |
| `production-core` | Module tri thức Quản lý Lệnh sản xuất (Production Orders / Manufacturing Orders) trong erp-api |
| `purchasing-report-dashboard` | Module tri thức Dashboard & Báo cáo Mua hàng trong erp-api (reports-core) |
| `purchasing` | Module tri thức Quản lý Mua hàng (Purchase Orders & Purchase Requests) trong erp-api |
| `rbac-core` | Module tri thức Quản lý Phân quyền, Vai trò & RBAC Core (Roles, Permissions & User Role Assignments) trong erp-api (rbac-core) và erp-web |
| `sales-report-dashboard` | Module tri thức Dashboard & Báo cáo Bán hàng trong erp-api (reports-core) |
| `scheduler-jobs` | Module v2 điều phối job định kỳ (cron) với một cổng ENABLE_CRON duy nhất, chống chạy chồng, cô lập lỗi và đo trạng thái |
| `settings-accounts` | Module tri thức Quản lý Hệ thống Tài khoản Kế toán (Settings Accounts / Chart of Accounts) trong erp-api (accounting-core) |
| `system-operations-core` | Module tri thức Quản lý Trạng thái Tác vụ Toàn cục, Khóa Giao dịch Nặng & Theo dõi Tiến độ Thời gian thực (System Operations & Universal Loc… |
| `vinfast-parts-dashboard` | Module tri thức Báo cáo & Dashboard Phân tích Phụ tùng VinFast trong erp-api (reports-core) |
| `vinfast-parts-stock` | Module tri thức Quản lý Tồn kho Phụ tùng VinFast (Stock, FIFO Ledger, Sync, Background Export) trong erp-api |
