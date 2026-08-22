import { ChangelogReleaseDto } from '../dto/query-changelog.dto';

export const MASTER_CHANGELOG_RELEASES: ChangelogReleaseDto[] = [
  {
    version: 'v2026.08.22',
    date: '22/08/2026',
    tag: 'Core & UX',
    isLatest: true,
    titleVi:
      'Nâng cấp cơ chế Cache-Busting, Tự động Cập nhật & Changelog Drawer',
    titleEn: 'Enhanced Cache-Busting, Auto-Update & Changelog Drawer',
    items: [
      {
        type: 'feature',
        textVi:
          'Ra mắt Drawer Nhật ký phát hành (Changelog Timeline) chuẩn 1-column responsive và đa ngôn ngữ.',
        textEn:
          'Launched Release Changelog Timeline Drawer with standard 1-column responsive layout and full i18n.',
      },
      {
        type: 'enhancement',
        textVi:
          'Tối ưu phân vùng Cache Nginx, cấm cache Service Worker (sw.js) và index.html để F5 nhận ngay bản mới.',
        textEn:
          'Optimized Nginx cache zones, disabling cache for Service Worker (sw.js) and index.html for instant updates upon F5.',
      },
      {
        type: 'enhancement',
        textVi:
          'Bổ sung cơ chế tự động kiểm tra Service Worker mới mỗi 60s và khi người dùng focus trở lại tab.',
        textEn:
          'Added automatic Service Worker polling every 60s and on window/tab focus.',
      },
      {
        type: 'fix',
        textVi:
          'Tích hợp lazyWithRetry tự động bắt lỗi ChunkLoadError và reload trang an toàn khi máy chủ deploy bản build mới.',
        textEn:
          'Integrated lazyWithRetry to automatically catch ChunkLoadError and safely reload the page after new server deployments.',
      },
    ],
  },
  {
    version: 'v2026.08.19',
    date: '19/08/2026',
    tag: 'VinFast & Reports',
    titleVi: 'Báo cáo & Dashboard Phân tích Phụ tùng VinFast',
    titleEn: 'VinFast Parts Analytics & Inventory Dashboard',
    items: [
      {
        type: 'feature',
        textVi:
          'Ra mắt Dashboard phân tích mua bán, lợi nhuận gộp phụ tùng ô tô & xe máy VinFast.',
        textEn:
          'Launched VinFast Parts Analytics Dashboard for car and motorbike spare parts gross profit.',
      },
      {
        type: 'feature',
        textVi:
          'Tích hợp tính năng xuất báo cáo Excel đa sheet chạy ngầm với thanh tiến trình thời gian thực.',
        textEn:
          'Integrated multi-sheet background Excel export with real-time SSE progress tracking.',
      },
      {
        type: 'enhancement',
        textVi:
          'Cải tiến giao diện Danh mục đơn vị tính (UOM) và Loại mặt hàng kho.',
        textEn:
          'Enhanced UI for Inventory Units of Measure (UOM) and Item Types management.',
      },
    ],
  },
  {
    version: 'v2026.08.15',
    date: '15/08/2026',
    tag: 'Garage Operations',
    titleVi: 'Quản lý Vụ việc Dịch vụ Garage & Sổ Công nợ Khách hàng',
    titleEn: 'Garage Service Cases & Customer Receivables Aging',
    items: [
      {
        type: 'feature',
        textVi:
          'Quản lý vụ việc dịch vụ, báo giá sửa chữa, phiếu dịch vụ và tỷ suất lợi nhuận gộp.',
        textEn:
          'Managed service cases, repair quotations, service vouchers, and gross profit margin.',
      },
      {
        type: 'feature',
        textVi:
          'Phân tích tuổi nợ công nợ khách hàng garage theo từng phân tầng thời gian (Aging Buckets).',
        textEn:
          'Customer receivables aging analysis grouped by time buckets (0-30d, 31-60d, 61-90d, >90d).',
      },
      {
        type: 'enhancement',
        textVi:
          'Tự động đồng bộ 2 chiều dữ liệu vụ việc dịch vụ và đối soát hóa đơn thuế VAT.',
        textEn:
          'Automated 2-way data synchronization for service cases and VAT tax invoice reconciliation.',
      },
    ],
  },
  {
    version: 'v2026.08.08',
    date: '08/08/2026',
    tag: 'Finance & Accounting',
    titleVi: 'Phân tích Dòng tiền & Sao kê Ngân hàng Tự động',
    titleEn: 'Cashflow Analytics & Automated Bank Statement Parser',
    items: [
      {
        type: 'feature',
        textVi:
          'Dashboard dự báo dòng tiền, đối soát tự động sao kê Vietcombank, BIDV, Techcombank và sổ quỹ tiền mặt.',
        textEn:
          'Cashflow forecast dashboard and automated statement parsing for Vietcombank, BIDV, Techcombank & Cashbook.',
      },
      {
        type: 'enhancement',
        textVi:
          'Định khoản kế toán kép tự động và cấn trừ thông minh giữa các chứng từ công nợ.',
        textEn:
          'Automated double-entry accounting posting and multi-hop debt settlement matching.',
      },
      {
        type: 'fix',
        textVi:
          'Tối ưu truy vấn hạch toán sổ cái phẳng và khắc phục trùng lặp giao dịch sao kê.',
        textEn:
          'Optimized flat ledger posting queries and prevented duplicate bank statement transactions.',
      },
    ],
  },
  {
    version: 'v2026.08.01',
    date: '01/08/2026',
    tag: 'After-Sales & Inventory',
    titleVi: 'Vòng đời Serial Xe/Linh kiện, Bàn giao & Bảo hành Điện tử',
    titleEn: 'Vehicle & Serial Lifecycles, Handover & Electronic Warranty',
    items: [
      {
        type: 'feature',
        textVi:
          'Quản lý định danh Serial/VIN, lịch sử luân chuyển từ nhập kho -> lắp ráp -> xuất bán -> bảo hành.',
        textEn:
          'Managed Serial/VIN identification and lifecycle from receipt -> assembly -> delivery -> warranty.',
      },
      {
        type: 'feature',
        textVi:
          'Kích hoạt bảo hành điện tử và cổng tra cứu công khai thông tin xe.',
        textEn:
          'Activated electronic warranty registration and public vehicle warranty lookup portal.',
      },
      {
        type: 'fix',
        textVi:
          'Khóa bi quan (pessimistic lock) chống xuất trùng Serial khi nhiều nhân viên thao tác cùng lúc.',
        textEn:
          'Implemented pessimistic write locking to eliminate duplicate serial dispatch race conditions.',
      },
    ],
  },
  {
    version: 'v2026.07.25',
    date: '25/07/2026',
    tag: 'Manufacturing',
    titleVi: 'Định mức Vật tư BOM Đa cấp & Lệnh Sản xuất',
    titleEn: 'Multi-Level BOM & Manufacturing Orders Execution',
    items: [
      {
        type: 'feature',
        textVi:
          'Cấu hình phân rã BOM định mức vật tư đa cấp (Explode BOM) theo từng dòng xe điện và phụ tùng.',
        textEn:
          'Configured multi-level BOM explosion for electric vehicle models and components.',
      },
      {
        type: 'feature',
        textVi:
          'Quy trình Lệnh sản xuất 2 giai đoạn: Xuất kho nguyên vật liệu và Nhập kho thành phẩm lắp ráp.',
        textEn:
          '2-stage Production Order workflow: Material issue and assembled finished goods receipt.',
      },
    ],
  },
];
