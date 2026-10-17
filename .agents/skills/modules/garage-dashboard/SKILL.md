---
name: garage-dashboard
description: Module tri thức Dashboard, Báo cáo Hiệu quả Garage, Quản lý Chi phí vận hành (OPEX) & Báo cáo Lợi nhuận (P&L) trong erp-api (kgara-api-core). Chứa toàn bộ database schema, entities, DTOs, API endpoints, logic tính toán P&L theo ngày hoàn thành và xuất báo cáo Excel chuyên nghiệp.
---

# 📦 Module Tri Thức: Dashboard, Chi Phí Vận Hành & Báo Cáo P&L Garage (`garage-dashboard`) - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `garage-dashboard` (được hiện thực tại `src/kgara-api-core/`) là trung tâm tình báo điều hành, phân tích tài chính xưởng dịch vụ và quản lý chi phí vận hành (OPEX) trong hệ thống Liouni ERP.

### 1.1. Các tính năng cốt lõi:
- **Quy tắc Tính toán Doanh thu & Chi phí theo Ngày hoàn thành (Strict Completion Date Rule)**:
  - **CHỈ tính** doanh thu, chi phí, lãi gộp và số vụ việc cho các phiếu dịch vụ **ĐÃ CÓ ngày hoàn thành công việc** (`c.ngay_hoan_thanh_cong_viec IS NOT NULL`).
  - Bỏ qua các phiếu bị xóa trên KGara (`c.kgara_deleted_at IS NULL`) hoặc phiếu hủy (`c.tinh_trang_dich_vu != 9`).
- **Quản lý Chi phí vận hành (OPEX), Giá vốn nhập tay & Hoa hồng**:
  - Nhập tay chi phí vận hành hàng tháng (nhân sự, thuê mặt bằng, điện nước, bảo trì, khấu hao, khác), giá vốn trực tiếp (hoa hồng trực tiếp DV, chi phí trực tiếp khác) và hoa hồng (sale, dịch vụ).
  - Phân loại qua `category_key` theo 3 nhóm chi phí: `OPEX` (CP Vận hành), `COGS` (Giá vốn), `COMMISSION` (Hoa hồng), lưu trữ theo `(period_year, period_month)`.
  - Hỗ trợ phát sinh định kỳ lặp lại theo chu kỳ tháng (`monthly`) với cơ chế áp dụng linh hoạt chuẩn Google Calendar (`this` vs `this_and_future`).
  - Hỗ trợ xem danh sách bảng chuẩn `/greenway/dashboard/opex` theo đúng quy chuẩn `standardize-table-page` & `standardize-table`:
    - Cột STT (`#`) bắt đầu chính xác từ số 1.
    - Cột Kỳ báo cáo (`period`) tích hợp `<DateRangeColumnSlot>` lọc khoảng ngày/tháng và các quick presets.
    - Context Menu (Row Actions) 4 thao tác chuẩn hóa: **Xem chi tiết** (`Eye`), **Chỉnh sửa** (`Pencil`), **Nhân đôi** (`Copy` - prefill toàn bộ dữ liệu vào form tạo mới), **Xóa** (`Trash2`).
    - Xem/sửa/nhân đôi qua 1-column StandardFormDrawer (`GarageOpexDrawer.tsx`) tích hợp xem trước số tiền bằng chữ (Vietnamese Currency Words) và định dạng số.
- **Tiến độ Dòng tiền & Công nợ Dịch vụ (`garage-payment-progress-card` & `GarageMonthDetailDrawer.tsx`)**:
  - **Vị trí hiển thị**: Đã được di dời sang tab **Tổng quan Công nợ** (`/garage-debts?tab=overview`, bên trong `GarageDebtsDashboardTab.tsx`), đặt ngay bên dưới khối biểu đồ phân tích tuổi nợ và trên các drawer. Đồng thời, tab mặc định của màn hình phiếu dịch vụ xưởng (`/garage-cases`) được chuẩn hóa từ `?tab=dashboard` thành `?tab=overview`.
  - **Kiến trúc Atomic 5 tầng (Organism L3)**: Nằm tại `src/modules/garage/components/organisms/garage-payment-progress-card/`, toàn bộ 100% files khống chế < 180 LoC, co-located vitest test `GaragePaymentProgressCard.test.tsx`, hỗ trợ self-fetching React Query tự động khi không truyền props.
  - Tích hợp bảng chuẩn ERP `<DataTable>` (Spreadsheet variant) hiển thị chi tiết theo từng tháng từ mốc đối soát dòng tiền (`2026-07` trở đi).
  - Switch chuyển Tab pill bo tròn gọn gàng chuẩn Dashboard Tổng quan với 2 lựa chọn: **Phải Thu** & **Phải Trả**.
  - Tiêu đề cột tinh gọn & đồng bộ, độ rộng 200px cho toàn bộ các cột tiền tệ, bố cục chuẩn hóa:
    - Tab **Phải Thu**: `#` (40px) | `Tháng` (120px) | `Số vụ việc` (110px) | `Doanh Thu` (180px) | `Tổng Phải Thu` (190px) | `Đã Thu` (180px) | `Còn Phải Thu` (180px, nền neutral) | `Còn Phải Thu Có HĐ` (170px) | `Còn Phải Thu Không HĐ` (170px) | `Không Theo Dõi Công Nợ` (170px).
    - Tab **Phải Trả**: `#` (40px) | `Tháng` (120px) | `Số vụ việc` (110px) | `Tổng Phải Trả` (190px) | `Đã Trả` (180px) | `Còn Phải Trả` (180px, nền neutral) | `Còn Phải Trả Có HĐ` (170px) | `Còn Phải Trả Không HĐ` (170px) | `Không Theo Dõi Công Nợ` (170px).
  - Hàng tổng cộng (`summaryRow`): Phân rã thành `receiptSummaryRow.tsx` và `paymentSummaryRow.tsx`, hiển thị trực tiếp các phần tử số liệu văn bản chuẩn kế toán (`font-mono tabular-nums font-bold text-right`), không dùng popover tương tác thừa.
  - Hỗ trợ Context Menu chuột phải trên từng dòng tháng mở **`GarageMonthDetailDrawer.tsx`** (2-column StandardFormDrawer layout):
    - **Cột Trái (Main Content)**: Xếp chồng dọc 2 `DrawerSection` độc lập (`collapsible={true}`):
      - **Section 1 (Nằm TRÊN)**: Bảng chuẩn `standardize-table` phân rã theo Nghiệp vụ (`Sửa chữa chung`, `Ký gửi / Nội bộ`, `OJ Ngoài`, `Khác`) với 8 cột chuẩn hóa: `#` (40px), `Loại nghiệp vụ` (200px), `Tổng phát sinh` (140px), `Đã thu/chi` (150px kèm thanh tiến độ), `Còn phải thu/trả` (140px), `Còn phải thu/trả có HĐ` (150px), `Còn phải thu/trả không HĐ` (150px), `Tỷ trọng (%)` (90px) và dòng tổng cộng `Σ`. Bảng tích hợp 100% Header Filters & Sorting (`createColumnHeaderFilter`).
      - **Section 2 (Nằm DƯỚI)**: Bảng chi tiết phân rã đối tượng theo **Ma trận 3x3 (3 Nhóm Đối Tượng × 3 Trạng Thái Hóa Đơn)**:
        - **Phân tách 3 Nhóm Đối Tượng Độc Lập**:
          1. 🏢 **Khách hàng Doanh nghiệp / Tổ chức** (`ENTERPRISE`): Nhận diện qua MST (`taxCode`) hoặc tên pháp nhân (`CÔNG TY CP`, `TNHH`, `DNTN`, `Chi nhánh`, `HTX`...).
          2. 👤 **Khách hàng Cá nhân** (`INDIVIDUAL`): Khách lẻ, chủ xe cá nhân không có MST.
          3. 🛡️ **Bảo hiểm** (`INSURANCE`): Các công ty bảo hiểm xe cơ giới duyệt bồi thường (Bảo Long, Bảo Việt, MIC, PTI, AAA, PVI, VBI...).
        - **Phân rã theo Đối Tượng & Từng Phiếu/Xe (`MonthPartnerCategorizedSection` & `MonthInvoicePartnerTable`)**:
          - **Tách chi tiết theo từng phiếu & từng xe**: Bảng hiển thị dạng phẳng (`MonthInvoiceCaseRow[]`) từ mảng `cases` của API backend, mỗi dòng đại diện cho 1 phiếu dịch vụ và 1 xe cụ thể.
          - **Cột Số chứng từ chuẩn hóa 2 dòng (`GarageCaseCodeCell`)**:
            - Dòng 1: Icon con mắt (click mở trực tiếp `GarageCaseStandaloneDrawer`) + Mã phiếu (`soChungTu`, text xanh đậm `text-primary`, click mở chi tiết) + Nút Copy.
            - Dòng 2: Icon xe hơi (`Car`) + Biển số xe (`bienSoXe`, font mono) + Nút Copy biển số.
          - **Quy tắc bố cục theo Toolbar Filter & Switch Phải thu / Phải trả**:
            - **Cụm nút Phải thu / Phải trả (`CustomerDetailDebtSwitch`)**: Nằm trực tiếp trong prop `rightExtra` của thanh `PillTabs` bộ lọc đối tượng, căn phải tự nhiên, đảm bảo vừa khít 100% container và không sinh ra bất kỳ thanh cuộn ngang (scrollbar) nào.
            - **Chuyển đổi thông số Chi phí & Phải trả khi chọn "Phải trả" (`debtType = "payables"`)**:
              - Backend truy vấn cả `settlement_type IN ('RECEIPT', 'PAYMENT')` hỗ trợ cả `s.case_id` và `s.gross_profit_id`.
              - Giá vốn thực tế (`cost`) được bóc tách từ bảng **`kgara_gross_profit.chi_phi`** (qua `hd_phieu_dich_vu_id` hoặc `vu_viec_code`, thay vì phụ thuộc `kgara_cases.chi_phi` vốn là NULL trong KGara), tính toán `paidCost` (đã thanh toán chi phí từ settlements PAYMENT) và `remainingCost` (`Math.max(0, cost - paidCost)`).
              - Các cột bảng tự động cập nhật tiêu đề tài chính: `CHI PHÍ` (thay vì `PHÁT SINH`), `ĐÃ CHI` (thay vì `ĐÃ THU`), `CÒN PHẢI CHI` (thay vì `CÒN PHẢI THU`), `LOẠI CHI` (thay vì `LOẠI THU`), tỷ trọng (%) tính theo tổng chi phí.
            - **Badge Cột Hóa đơn & VAT**: Các phiếu không có hóa đơn và không phát sinh thuế GTGT hiển thị badge chuẩn hóa **`"Không VAT"`** (thay vì `"Chưa xuất HĐ (K.Thuế)"`), phong cách outline slate/neutral.
            - Khi ở Tab **Tất cả đối tượng** (`all`): Mỗi nhóm (Doanh nghiệp, Cá nhân, Bảo hiểm) chỉ chứa **1 TABLE TỔNG HỢP DUY NHẤT** (`categorized.all`), không chia nhỏ thành các sub-section hóa đơn.
            - Khi ở **3 Tab con** (`enterprise`, `individual`, `insurance`): Chia thành **3 DRAWER SECTION ĐỘC LẬP** riêng biệt (`Đã xuất hóa đơn`, `Chưa xuất hóa đơn - Có VAT`, `Không xuất hóa đơn`).
          - **Chuẩn hóa Kiến trúc `/ui-atomic-refactor`**:
            - `MonthInvoiceCaseRow.type.ts` (< 80 LoC), `MonthInvoiceCaseRow.helper.ts` (< 150 LoC kèm co-located test), `MonthInvoiceCaseTable.cells.tsx` (< 80 LoC), `MonthInvoiceCaseTable.columns.tsx` (< 165 LoC), `MonthInvoicePartnerTable.tsx` (< 170 LoC), `MonthPartnerCategorizedSection.tsx` (< 150 LoC).
            - Tuân thủ 100% No Blue Mandate và giới hạn cứng < 180 LoC.
        - **Alert Banner Cảnh báo VAT**: Tự động phát hiện và cảnh báo nổi bật các vụ việc có thuế GTGT (`tien_thue > 0`) nhưng chưa đính kèm / chưa xuất hóa đơn điện tử OUT (`vatWarning = true`) kèm số tiền thuế VAT đang treo.
        - **2 Thẻ KPI Tương phản (`MonthPayerKpiGrid`)**: Phân tách rõ rệt nguồn thu từ Khách hàng và từng khoản duyệt bồi thường từ Bảo hiểm.
    - **Cột Phải**: Các `DrawerSection` độc lập (Tổng quan Thu/Chi, Cơ cấu Thu KH vs Thu BH, Thống kê Vụ việc theo Phân loại, Tỷ lệ Hoàn tất) có hỗ trợ **Expand / Collapse** toàn cột phải và từng section con.
  - **Đồng bộ hóa Giao diện & Kiến trúc Drawer Chi tiết Mốc Thời Gian Tuổi Nợ (`GarageTimeHorizonDetailDrawer.tsx`)**:
    - **Áp dụng toàn bộ UI & Layout của Tháng (`GarageMonthDetailDrawer`)**: Drawer chi tiết của các card tuổi nợ (`criticalOverdue90Plus`, `overdue30To90`, `currentMonth`, `futureReceivable`) sử dụng chuẩn 2-columns `StandardFormDrawer` với 3 tabs:
      1. Tab 1: **Phân loại Nghiệp vụ** (`TimeHorizonClassificationTab.tsx`): Bảng tổng hợp nhóm nghiệp vụ (Sửa chữa chung, Ký gửi / Nội bộ, OJ Ngoài, Khác).
      2. Tab 2: **Phân loại theo đối tượng** (`TimeHorizonPartnerTab.tsx`): Ma trận 3 nhóm đối tượng (Doanh nghiệp, Cá nhân, Bảo hiểm) tích hợp công tắc Phải thu / Phải trả, click drilldown vào `GaragePartnerMonthDetailDrawer`.
      3. Tab 3: **Danh sách vụ việc** (`TimeHorizonCasesTab.tsx`): Bảng danh sách phiếu dịch vụ chi tiết với STT chuẩn 1-based, pagination server-side và mở chi tiết `GarageCaseStandaloneDrawer`.
    - **Cột phải (`TimeHorizonRightPanel.tsx`)**: Tích hợp cảnh báo hóa đơn VAT chưa xuất (`ReceivablesVatWarningSummary`), cơ cấu Thu KH vs Thu BH (`MonthPayerKpiGrid`), chi phí phát sinh & phải trả (`MonthCostPayableKpiCard`), và đánh giá rủi ro mốc thời gian.
    - **Backend API mở rộng**: Endpoint `GET /garage-dashboard/monthly-receivables-breakdown` hỗ trợ nhận tham số query `horizon` (hoặc `date_from`, `date_to`), tự động tính toán trả về `trendItem` và phân loại chi tiết theo mốc tuổi nợ thông qua helper chuẩn `/api-service-refactor` (`garage-receivables-classification.helper.ts`).
  - Phân tách chi tiết 2 nhóm hóa đơn: **Có HĐ** (`raw_data->>'TienThueKH' > 0` / `hd_phieu_dich_vu_id IS NOT NULL`) và **Không HĐ** trên cả cấp Tháng, nhóm Nghiệp vụ và từng Đối tượng HĐ.
  - Tích hợp đầy đủ từ điển đa ngôn ngữ i18n (`garage:progress`) cho cả tiếng Việt và tiếng Anh.
- **Báo cáo Lợi nhuận P&L theo Tháng Đơn Lẻ (`getPnlReport` & `GaragePnlSection.tsx`)**:
  - Bố trí tại `GarageDashboard` (`garage-cases?tab=overview` / `?tab=dashboard`) nằm ở **Section 2** (ngay dưới `GarageStatsCards`), nằm TRÊN **Section 3** (`GarageConversionFunnelCard` - Pipeline Dự Thu & Phễu Chuyển Đổi Dịch Vụ).
  - Badge header phong cách đồng bộ (`Báo cáo Lợi nhuận (P&L)`).
  - Nút **Quản lý CP vận hành** đặt tại góc trên bên phải Section Header.
  - Combobox **Kỳ báo cáo (Tháng/Năm)** đặt bên trong Card Header (bên trái), đối xứng với nút **Xuất Excel** (bên phải), loại bỏ divider thừa.
  - **Switch Chế độ Xem Kép (PnlViewModeSwitch - Toàn bộ ⇄ Riêng OJ)**:
    - Bố trí trực tiếp trên Card Header của `GaragePnlSection`, nằm giữa bộ chọn kỳ tháng và nút Xuất Excel.
    - Molecule độc lập `PnlViewModeSwitch.tsx` (< 180 LoC, folder-per-component) theo chuẩn `/ui-atomic-refactor`, tương đồng UX với switch ở card Phân Tích Xu Hướng & Cơ Cấu Chuyển Đổi.
    - Hai chế độ hiển thị:
      - **Toàn bộ** (`isOjOnly = false`, mặc định): Xem kết quả kinh doanh chung toàn xưởng; hiển thị các hàng phân cấp con `Trong đó: Phát sinh liên quan OJ` (1.1.1, 2.1.1, 3.1, 5.1.1, 6.1, 7.1.1, 8.1) để đối soát đóng góp của mảng OJ.
      - **Riêng OJ** (`isOjOnly = true`): Chỉ hiển thị kết quả kinh doanh của riêng mảng OJ. Hàng chính bind trực tiếp từ `report.oj`, `prevReport.oj`, `prev2Report.oj`. Tự động ẩn toàn bộ các dòng con `Trong đó: Phát sinh liên quan OJ`, lọc danh sách chi phí vận hành (OPEX) và chi phí trực tiếp nhập tay chỉ giữ lại các mục có phát sinh OJ (`ojAmount > 0`), có fallback hint thân thiện nếu kỳ chưa có chi phí phân bổ cho OJ.
    - Phân tách cấu trúc 100% files < 180 LoC: bóc tách `PnlDvCommissionRow.tsx` và `PnlKyGuiCommissionDetailRows.tsx` độc lập, đồng thời 100% từ điển i18n (`vi.ts` & `en.ts`).
  - Bố cục **4 cột chuẩn hóa**: `Danh Mục` | `Tháng T` (Kỳ chọn - font-bold) | `Tháng T-1` | `Tháng T-2` (Loại bỏ cột riêng OJ, phát sinh liên quan OJ được hiển thị chi tiết dưới dạng dòng phụ `Trong đó: Phát sinh liên quan OJ` xuyên suốt cả 3 tháng).
  - Thiết kế **Ô Tài Chính 2 Tầng (Two-Tier Financial Cell - `PnlAmountCell`)**:
    - **Hàng 1 (Main Amount)**: Số tiền chính căn phải, font mono, `whitespace-nowrap` (tuyệt đối không bị rớt dòng đơn vị `đ`).
    - **Hàng 2 (Sub-text %)**: Căn phải ngay dưới số tiền với font nhỏ (`text-[10px]`), gồm **Delta %** (so sánh với tháng liền kề trước, xanh lá nếu tốt, đỏ nếu chi phí tăng/doanh thu giảm) và **% Doanh thu (% DT)** của chính tháng đó.
    - **Cột Danh Mục**: Loại bỏ các badge % lẻ tẻ để giữ cột Danh mục thoáng đãng, thuần túy tên khoản mục; toàn bộ % DT được hiển thị chuẩn xác ở Hàng 2 của từng cột tháng tương ứng.
  - **Quy chuẩn Numeric Style Level 3 Bảng P&L**:
    - Toàn bộ dòng con Level 3 (bao gồm các dòng `Trong đó: Phát sinh liên quan OJ` 1.1.1, 2.1.1, 3.1, 5.x.1, 6.1, 7.1.1, 7.x.1, 8.1, 2.2.x.1 và chi tiết ký gửi 4.1.1, 4.1.2) đồng nhất 100% text style `text-[11px] font-mono tabular-nums text-muted-foreground font-normal` trên cả 3 cột tháng.
    - Tái sử dụng `PnlAmountCell` với `hideDelta={true}`, `hideRate={true}` để hiển thị 1 dòng phẳng compact, không lệch màu, không lệch bold và không phát sinh delta/rate badge phụ ở cấp con.
  - Tự động ghép nối và đối soát dòng con chi tiết giữa 3 tháng liên tiếp (`mergePnlItems`), hiển thị đầy đủ số tiền và tỷ lệ biến động (delta) giữa các kỳ tháng.
  - Khung Card giao diện sử dụng `bg-surface border border-border rounded-xl p-5 card-shadow overflow-hidden min-w-0` đồng bộ hoàn toàn hiệu ứng đổ bóng `card-shadow` trên Dashboard.
  - **Tổng hợp tự động 8 chỉ mục tài chính phân cấp (Số La Mã I → VIII)**:
    - Toàn bộ 8 mục Numeric Level 1 sử dụng số La Mã (`text-sm font-bold tracking-tight text-foreground`) kèm icon biểu trưng nằm **ngay bên phải** nhãn chữ:
      1. `I. Doanh Thu` (Icon `TrendingUp` bên phải)
      2. `II. Chi phí (Giá vốn)` (Icon `Boxes` bên phải)
      3. `III. Lợi nhuận gộp` (Icon `TrendingUp` bên phải, đã di dời từ phía trước ra phía sau text)
      4. `IV. Chi phí bán hàng` (Icon `ShoppingBag` bên phải)
      5. `V. Chi phí vận hành` (Icon `Building2` bên phải, kèm nút `Thêm CP`)
      6. `VI. Lợi nhuận ròng` (Icon `Coins` bên phải)
      7. `VII. Thưởng và Hoa hồng Dịch vụ` (Icon `Award` bên phải)
      8. `VIII. Lợi nhuận giữ lại của Garage (Sau hoa hồng DV)` (Icon `ShieldCheck` bên phải)
  - **Cơ chế Thu gọn / Mở rộng (Expand / Collapse)**:
    - **Từng mục Level 1**: Tích hợp nút `ChevronDown` / `ChevronRight` tại `PnlLevel1HeaderCell`, click để ẩn / hiện các dòng con cấp 2 và cấp 3 của riêng mục đó.
    - **Toàn cục (Global Toggle)**: Nút `ChevronsUpDown` trên Header cột Danh Mục cho phép 1-click **Thu gọn tất cả** (đưa bảng về 8 dòng số La Mã tổng quan) hoặc **Mở rộng tất cả** (bung toàn bộ chi tiết).
  - **Chuẩn hóa Kiến trúc `/ui-atomic-refactor`**:
    - `usePnlCollapseState.ts`: Hook quản lý map đóng/mở 8 sections.
    - `PnlLevel1HeaderCell.tsx`: Molecule chuẩn hóa hiển thị chevron, tiêu đề La Mã và icon bên phải.
    - `PnlOpexItemRow.tsx`: Molecule bóc tách từ `PnlOpexRows.tsx` để khống chế 100% files dưới 180 LoC.
- **Chỉ số KPI Sparklines theo Chu kỳ (`getCheckpointKpis` & `GarageStatsCards.tsx`)**:
  - Phân tích 3 chu kỳ: **Tháng này** (Sparkline 6 tháng), **Tuần này** (Sparkline 4 tuần), **Hôm nay** (Sparkline 7 ngày) theo Ngày hoàn thành.
  - Tooltip Sparkline hiển thị 2 dòng tinh gọn và chuẩn xác:
    - Card Doanh thu: **Doanh thu thuần** & **Doanh thu có VAT** (khớp số liệu với bảng chi tiết).
    - Card Chi phí: **Chi phí thuần** & **Chi phí có VAT**.
  - Hỗ trợ click-to-drilldown xem danh sách phiếu dịch vụ chi tiết hoàn thành trong kỳ (`getCheckpointCases`).
- **Pipeline Dự Thu & Phễu Chuyển Đổi Dịch Vụ (`GarageConversionFunnelCard.tsx`)**:
  - Hub phân tích 3 tầng tích hợp toàn diện:
    - **Tầng 1**: 4 Cards tổng quan tiếp nhận & tiến độ (Tổng tiếp nhận, Đang xử lý, Đã hoàn thành, Hủy) kèm sub-badge Dự thu Hôm nay & Tháng này và thanh tỷ lệ chuyển đổi trực quan.
    - **Tầng 2**: Toolbar điều khiển chuyển đổi hiển thị `[$ Giá trị (VND)] / [Số lượng (Xe)]` ngay phía trên khu vực biểu đồ + Grid 12 cột chứa 3 biểu đồ song song:
      - Biểu đồ Dòng Thời Gian (6 Tháng, thứ tự Trái sang Phải, stacked bars Doanh số/SL + line % Hoàn tất, click-to-filter tháng).
      - Donut Chart Cơ Cấu Nghiệp Vụ (ERP) (4 nhóm ERP: Sửa chữa chung, Ký gửi/Nội bộ, OJ Ngoài, Khác).
      - Donut Chart Phân Bổ Trạng Thái Phiếu DV (Hoàn tất, Đang xử lý, Báo giá, Tiếp nhận, Hủy).
    - **Tầng 3**: Bảng `<DataTable variant="spreadsheet">` chi tiết 4 phân loại ERP chuẩn `/standardize-table` (STT `#` 40px center, No Blue Mandate, SubtotalSummaryCell footer).
  - Dữ liệu tính toán độc lập tại `conversionFunnel` & `conversionFunnelByMonth` trong `garage-dashboard.service.ts`, phản hồi tức thì theo kỳ tháng được chọn.
- **Xuất Báo Cáo Excel Theo Kỳ (cập nhật 2026-10-16)**:
  - Nút **Xuất Excel** ở tab Tổng quan mở drawer xuất nền (cùng cơ chế xuất công nợ: job nền `ExportJobRunner`, lịch sử + tải lại trong 24 giờ, SSE tiến trình). Endpoint cũ `GET /greenway/dashboard/export` và `GarageDashboardExportService` đã **xóa**.
  - Endpoint nền (`GarageDashboardExportController`, quyền `GARAGE:READ` **và** `GARAGE_DEBTS:READ` vì file chứa công nợ): `POST /api/v1/greenway/dashboard/export/background` (body `{ from?, to?, reportType? }`, `reportType` ∈ `all` \| `business` \| `cashflow-debts` \| `overdue`, mặc định `all`), `GET .../background/history`, `GET .../background/:jobId/download`, `SSE .../progress/stream`. Runner `garage-dashboard-xlsx-export` trong `GarageExportJobsService.startDashboardExport`; file `Bao_cao_Garage_<từ>-<đến>_<timestamp>.xlsx` cho `all`; các loại khác thêm nhãn sau tiền tố: `Bao_cao_Garage_Hoat_dong_kinh_doanh_…`, `…_Thu_chi_cong_no_…`, `…_No_qua_han_…`. Fingerprint gồm `reportType` (đã chuẩn hóa `undefined` → `all`) nên reuse-window 10 phút không lẫn giữa các loại.
  - **Loại báo cáo kỳ (cập nhật 2026-10-17)**: `helpers/garage-period-report-sections.helper.ts` map `reportType` → tập section (`dashboard`, `pnl`, `debts`, `overdue`, `cashflow`): `all` = cả 5; `business` = `pnl` (P&L kèm 2 chart); `cashflow-debts` = `dashboard` + `debts` + `cashflow`; `overdue` = `overdue`. `GaragePeriodReportService` chỉ chạy query mà section cần (dashboard kéo theo công nợ trong kỳ, nợ còn mở và phiếu thu chi), `buildGaragePeriodReport` chỉ dựng sheet khi section có mặt và chỉ còn inject chart cho sheet `Báo cáo lợi nhuận`.
  - **Sheet Dashboard = 2 thẻ công nợ phát sinh (có ±% so với kỳ trước) + 3 chart lớn một hàng, gọn một màn hình (cập nhật 2026-10-17, không ghi số đối tượng)**: `garage-period-summary.builder.ts` (`summarizePeriod`, hàm thuần; `previous` là số kỳ trước khi báo cáo có `previousPeriod`) gom số tổng; `garage-period-summary-cards.helper.ts` dựng thẻ `buildPeriodDebtKpis` và `trendNote`; kỳ trước do `garage-period-previous.helper.ts` (`previousPeriodRange`: kỳ trọn tháng so với các tháng liền trước, còn lại khoảng cùng độ dài; không so sánh nếu trước 01/07/2026) và service tải thêm thu chi và công nợ kỳ trước. `garage-period-dashboard.builder.ts` ghi sheet; `garage-period-dashboard-charts.helper.ts` dựng 3 chart cao `PERIOD_CHART_ROWS` = 22 dòng, xếp hàng bằng `chartAnchorRow`: (1) thu vs chi + dự chi + dòng tiền ròng theo thời gian (dự chi = phiếu PAYMENT Chờ duyệt + Đã duyệt, `cashflow.planned`); (2) tuổi nợ phải thu vs phải trả; (3) phải thu và phải chi theo nhóm khách (cột ghép, `customerSections` `totalAmount` và `costAmount`; chi phí hồ sơ có nguồn từ breakdown và được chia theo tỷ trọng số tiền khi hồ sơ có cả phần BH và phần KH). Vùng in ≤ 34 dòng (test kiểm tra). Đã bỏ: thẻ thu chi, cảnh báo lũy kế (đã có ở chart tuổi nợ), mini chart xu hướng và chuỗi `debtTimeline` (truy vấn và `buildDebtSeries`), chart công nợ phát sinh vs đã thu/trả. Tuỳ chọn `compact` của `XlsxChartSpec` vẫn có trong bộ vẽ, mặc định không đổi.
  - **Quy tắc gom thời gian** (`helpers/garage-period-bucket.helper.ts`, `resolveBucketUnit`): kỳ ≤ 27 ngày → ngày, 28-60 ngày → tuần (thứ Hai - Chủ nhật), > 60 ngày → tháng; thiếu kỳ → tháng. Nên tuần trọn → ngày, tháng trọn (28-31 ngày) → tuần, quý/năm → tháng. `aggregateByBucket` điền mốc trống bằng 0; `garage-period-series.helper.ts` dựng chuỗi thu chi / doanh thu / công nợ cho chart. Dữ liệu theo ngày lấy từ `GaragePeriodTimelineQueries` (`services/garage-period-timeline-queries.service.ts`): `loadRevenueTimeline` (cùng điều kiện lọc `getPnlReport`, **không lọc chi nhánh** để khớp P&L) và `loadDebtTimeline` (phải thu từ `tien_co_thue`/`tien_da_thanh_toan`, phải trả dùng `PAYMENT_BY_CASE_JOIN` + `buildPayableExprs` như `garage-debts-analytics.service.ts`; chỉ tính từ mốc 01/07/2026). Service chỉ chạy timeline mà section cần (`pnl` → doanh thu, `dashboard` → công nợ).
  - **Sheet Báo cáo lợi nhuận 3 cấp**: `garage-period-pnl-table.helper.ts` (`buildPnlTableRows`, `writePnlTable`, `level` 1-3, đánh số 1 / 1.1 / 1.1.1). 1. Doanh thu → phân loại (Ký gửi/Nội bộ, Sửa chữa chung, OJ, Khác) → số phiếu; 2. Chi phí → giá vốn từ phiếu (cấp 3 theo phân loại) và điều chỉnh giá vốn nhập tay (cấp 3 từng dòng, kèm ghi chú); 4. Chi phí vận hành → hạng mục (cộng các dòng cùng khóa) → từng dòng nhập (nhãn lấy từ ghi chú, mặc định "Khoản chi"); 6. Hoa hồng **gồm cả HHBH** (`commissionTotal + hhbhTotal`) nên V − VI = VII. `getPnlReport` thêm `revenueByClassification` (tổng 4 nhóm = doanh thu), `toPnlMonthRow` thêm `cogsDirect`, `cogsAdjustmentItems`, `revenueSegments`, `hhbhTotal`, `note` của dòng nhập. Chart thứ nhất (theo kỳ, gom ngày/tuần/tháng; giá vốn chỉ gồm giá vốn từ phiếu) đứng trên 2 chart 12 tháng; bảng dữ liệu chart dời xuống dưới các chart.
  - Dữ liệu do `GaragePeriodReportService` gom: công nợ trong kỳ + phân nhóm (tái dùng `GarageDebtsExportService.loadCustomerRows/loadSupplierRows/loadCustomerGroups`), nợ còn mở từ 01/07/2026 không giới hạn kỳ (cho cảnh báo quá hạn), phiếu thu chi xưởng `kgara_cashflow_vouchers` theo `trans_date` (`GaragePeriodReportQueries.loadVouchers`) và P&L 12 tháng (`loadPnlMonthly`, gọi `GaragePnlService.getPnlReport` từng tháng, tối đa 3 yêu cầu song song, lỗi một tháng làm lỗi cả job). Tháng báo cáo = tháng chứa `min(to, hôm nay)` (`reportMonthOf` trong `garage-pnl-month.helper.ts`).
  - File gồm các sheet: `Dashboard` (thu chi & công nợ) → `Báo cáo lợi nhuận` (P&L) → từng nhóm phải thu (`Thu Khách hàng Doanh nghiệp/Cá nhân/Bảo hiểm`) → `Công nợ phải trả` → `Nợ quá hạn cần chú ý` → `Thu chi trong kỳ`.
  - **Dashboard** (xem mục Sheet Dashboard ở trên là nguồn chuẩn cho layout hiện tại): thu chi 4 thẻ, công nợ phát sinh 2 thẻ, cảnh báo lũy kế 4 thẻ (61-90 và trên 90 ngày của hai phía), 2 chart một hàng, ghi chú nguồn ở cuối. Thu vs chi: ≤14 ngày có phiếu vẽ theo ngày, nhiều hơn gộp theo tuần thứ Hai - Chủ nhật (`bucketCashflow` trong `garage-period-cashflow-bucket.helper.ts`). Builder: `garage-period-dashboard.builder.ts`.
  - **Báo cáo lợi nhuận** (`garage-period-pnl.builder.ts`, `garage-period-pnl-table.helper.ts`): bảng P&L của tháng báo cáo ở cột A:C gồm Danh mục | tháng này | tháng trước (tháng trước là `months[last-1]`, không có thì để trống). Các dòng đánh số thứ bậc 1. / 1.1 / 1.1.1 (`numberRows`), mỗi dòng có khóa ổn định (`key`) để ghép với tháng trước; `zeroIfMissing` thì coi thiếu là 0 (tổng, phân loại, hạng mục), dòng chi tiết nhập tay thiếu thì để trống. Hai chart 12 tháng: combo doanh thu/chi phí/lợi nhuận gộp + % lợi nhuận gộp trên trục phụ, và tỷ trọng chi phí trên doanh thu dạng cột chồng; chart và bảng dữ liệu nằm từ cột E, vùng in `A1:N…`. Đã bỏ chart doanh thu/giá vốn/lãi gộp theo tuần và toàn bộ `revenueTimeline`/`loadRevenueTimeline`/`buildRevenueSeries`.
  - Bộ vẽ chart (`common/xlsx-charts`) hỗ trợ: `stacked` (cột chồng), `secondaryAxis` + `secondaryNumFmt`/`secondaryMin`/`secondaryMax` (series đường của `combo` trên trục phụ bên phải), nhãn số theo chart hoặc theo series (`dataLabels`, `labelNumFmt`, `labelFontSize`; vị trí tự chọn: cột ghép `outEnd`, cột chồng `ctr`, đường `t`), giá trị `null` là ô trống (đường ngắt quãng). Hằng nhãn: `LABEL_MONEY_FMT` (`tr`/`k`, ẩn 0 và dưới 1.000) và `LABEL_PERCENT_FMT` (ẩn dưới 3%). `writeAlertCards` dựng card 3 dòng có màu riêng, `chartAnchorRow` chia đều 16 cột cho 2-3 chart một hàng.
  - Mốc thời gian: doanh thu/giá vốn theo ngày hoàn thành phiếu; đã thu/đã chi theo `trans_date` phiếu thu chi; số dư và tuổi nợ tính đến ngày xuất (ghi ở dòng `Kỳ:`). "Đã thu" trên Dashboard (từ phiếu thu chi) có thể lệch "Đã thu" trong sheet nhóm công nợ (từ cấn trừ phiếu dịch vụ).
  - `exportPnlExcel`: Báo cáo P&L theo tháng chi tiết từng dòng doanh thu, chi phí, OPEX, hoa hồng và lợi nhuận ròng (không đổi).

---

## 2. Database Schema & Quan hệ Dữ liệu

### 2.1. Sơ đồ Quan hệ Bảng:

```text
kgara_cases (Hồ sơ Phiếu dịch vụ)
  ├── 1:1 ── kgara_gross_profit (Sổ Lợi nhuận gộp & Chi phí vốn)
  └── 1:N ── kgara_case_services (Chi tiết phụ tùng & công thợ)

kgara_operating_expenses (Chi phí vận hành & Hoa hồng theo kỳ tháng)
```

### 2.2. Chi tiết các Bảng tham gia:

#### Bảng `kgara_operating_expenses`
| Tên Cột | Kiểu Dữ Liệu | Nullable | Mặc Định | Ràng Buộc / Index | Mô Tả |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `uuid_generate_v4()` | PK | Định danh bản ghi chi phí |
| `period_year` | `smallint` | NO | — | Index `idx_kgara_opex_period` | Năm chi phí (vd: 2026) |
| `period_month` | `smallint` | NO | — | Index `idx_kgara_opex_period` | Tháng chi phí (1 - 12) |
| `category_key` | `varchar(100)` | NO | — | Index `idx_kgara_opex_category` | Mã loại CP (NHAN_SU, THUE_MAT_BANG, HOA_HONG_TRUC_TIEP, CHI_PHI_TRUC_TIEP_KHAC, HOA_HONG_SALE,...) |
| `category_name` | `varchar(255)` | NO | — | — | Tên/Diễn giải chi tiết khoản chi |
| `amount` | `numeric(18,2)` | NO | `0` | — | Số tiền chi phí (VND) |
| `oj_amount` | `numeric(18,2)` | NO | `0` | — | Số tiền chi phí phân bổ tính riêng cho OJ (Omoda/Jaecoo) |
| `note` | `text` | YES | `null` | — | Ghi chú bổ sung |
| `recurrence_type` | `varchar(20)` | YES | `null` | — | Chu kỳ lặp lại (`monthly` hoặc null) |
| `recurrence_until_year` | `smallint` | YES | `null` | — | Năm kết thúc chuỗi định kỳ |
| `recurrence_until_month`| `smallint` | YES | `null` | — | Tháng kết thúc chuỗi định kỳ |
| `recurrence_anchor_id`  | `uuid` | YES | `null` | Index `idx_kgara_opex_recurrence_anchor` | ID bản ghi gốc trong chuỗi định kỳ |
| `created_by` | `uuid` | YES | `null` | — | ID người tạo |
| `created_at` | `timestamptz` | NO | `now()` | — | Thời gian tạo |
| `updated_at` | `timestamptz` | NO | `now()` | — | Thời gian cập nhật |

#### Bảng `kgara_cases` & `kgara_gross_profit`
| Tên Bảng | Vai trò trong Dashboard | Các cột truy vấn trọng tâm |
| :--- | :--- | :--- |
| `kgara_cases` | Phiếu dịch vụ gốc | `id`, `hd_phieu_dich_vu_id`, `so_chung_tu`, `bien_so_xe`, `khach_hang_code`, `khach_hang_name`, `tinh_trang_dich_vu`, `tien_co_thue`, `tien_da_thanh_toan`, `tien_con_phai_thanh_toan`, `ngay_hoan_thanh_cong_viec`, `kgara_deleted_at` |
| `kgara_gross_profit` | Dữ liệu tài chính lãi gộp & giá vốn | `hd_phieu_dich_vu_id`, `vu_viec_code`, `doanh_thu`, `chi_phi`, `loi_nhuan` |

---

## 3. Cấu trúc Source Code Backend (`erp-api`)

```text
src/kgara-api-core/
├── dto/
│   └── garage-opex.dto.ts              # Create, Update, ApplyRecurring, List Query DTOs cho OPEX
├── entities/
│   └── kgara_operating_expense.entity.ts # TypeORM Entity cho kgara_operating_expenses
├── services/
│   ├── garage-opex.service.ts          # CRUD OPEX, recurring upsert & period summary (COGS/OPEX/Commission)
│   ├── garage-opex.service.spec.ts     # Unit tests cho GarageOpexService
│   ├── garage-dashboard-stats.service.ts # Thống kê xu hướng tháng, doanh thu, giá vốn, lãi gộp, tiến độ thu/chi & phễu
│   ├── garage-checkpoint.service.ts    # Chỉ số KPI Checkpoints (Tháng/Tuần/Hôm nay), Sparklines & Drill-down ca
│   ├── garage-customer-stats.service.ts # Phân tích khách hàng, doanh thu, lãi gộp & tuổi nợ
│   ├── garage-period-report.service.ts    # Báo cáo Excel theo kỳ (gom công nợ, nợ quá hạn, thu chi, P&L 12 tháng)
│   ├── garage-period-report-queries.service.ts # Query phiếu thu chi xưởng + P&L theo tháng
│   ├── garage-pnl.service.ts           # Báo cáo P&L, hoa hồng tự động Sale 10%/DV 10% & xuất Excel P&L
│   └── garage-pnl.spec.ts              # Unit tests P&L & hoa hồng tự động (Pass 100%)
├── garage-dashboard.controller.ts      # REST Controller (Dashboard, Checkpoint, OPEX, P&L, ApplyRecurring)
├── garage-dashboard.service.ts         # Facade Service (~120 dòng): Clean DI delegate sang 5 Sub-Services
├── garage-dashboard.facade.spec.ts     # Unit tests Facade delegation
└── kgara-api-core.module.ts            # NestJS Module đăng ký Entity, Controllers & Providers/Exports
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Base Path: `/api/v1/greenway/dashboard`  
Guards: `JwtAuthGuard`, `CoreRbacGuard`  
Resource RBAC: `garage`

| Method | Endpoint | Quyền yêu cầu | Query / Body | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/stats` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to` | Xu hướng tháng, tiến độ thu/chi & phân bổ trạng thái |
| `GET` | `/checkpoint-kpis` | `{ resource: 'garage', action: 'read' }` | — | KPIs Sparkline Tháng/Tuần/Hôm nay |
| `GET` | `/checkpoint-cases` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to`, `page`, `pageSize` | Danh sách vụ việc chi tiết theo checkpoint |
| `GET` | `/customers` | `{ resource: 'garage', action: 'read' }` | Query pagination, filters, sort | Danh sách khách hàng kèm doanh thu, lãi gộp & nợ |
| `POST` | `/export/background` | `garage:read` + `garage_debts:read` | body `{ from?, to?, reportType? }` | Tạo job nền xuất báo cáo Garage theo kỳ (kèm `GET /export/background/history`, `GET /export/background/:jobId/download`, `SSE /export/progress/stream`). Thay endpoint cũ `GET /export` đã xóa |
| `GET` | `/opex` | `{ resource: 'garage', action: 'read' }` | `year`, `month`, `page`, `pageSize`, `sorts`, `columnFilters`, `columnSearch` | Danh sách chi phí vận hành có phân trang, sort, filter |
| `GET` | `/opex/column-options`| `{ resource: 'garage', action: 'read' }` | `column`, `search`, `page`, `pageSize`, `filtersStr` | Danh sách giá trị phân biệt phục vụ Header Filter |
| `GET` | `/opex/:id` | `{ resource: 'garage', action: 'read' }` | `id` (uuid) | Chi tiết một khoản chi phí vận hành |
| `POST` | `/opex` | `{ resource: 'garage', action: 'create' }`| `CreateGarageOpexDto` | Tạo mới khoản chi phí vận hành |
| `PUT` | `/opex/:id` | `{ resource: 'garage', action: 'update' }`| `UpdateGarageOpexDto` | Cập nhật khoản chi phí vận hành |
| `POST`| `/opex/:id/apply-recurring` | `{ resource: 'garage', action: 'update' }`| `ApplyRecurringOpexDto` | Áp dụng thay đổi định kỳ (This vs This and Future) |
| `DELETE`| `/opex/:id` | `{ resource: 'garage', action: 'delete' }`| `id` (uuid) | Xóa khoản chi phí vận hành |
| `GET` | `/pnl-report` | `{ resource: 'garage', action: 'read' }` | `year`, `month` | Báo cáo Lợi nhuận P&L theo tháng kèm `cogsAdjustment` |
| `GET` | `/pnl-trend` | `{ resource: 'garage', action: 'read' }` | `year`, `month`, `count` (mặc định 12, kẹp 1..24) | P&L nhiều tháng cũ→mới cho 2 chart web: `PnlTrendPoint[]` `{year, month, label, revenue, cogs, grossProfit, grossMarginRatio (null khi DT=0), ratios{cogs,nhanSu,matBang,vatTu,baoTri,khauHao,khac}}`; cùng nguồn `loadPnlMonthly` + `bucketOpex` với sheet Excel (`toPnlTrendPoint` trong `garage-pnl-month.helper.ts`, `GarageDashboardService.getPnlTrend`) |
| `GET` | `/pnl-report/export` | `{ resource: 'garage', action: 'read' }`| `year`, `month` | Xuất file Excel Báo cáo P&L theo tháng |
| `GET` | `/monthly-receivables-breakdown` | `{ resource: 'garage', action: 'read' }` | `month`, `branch_id` | Phân rã chi tiết Phải thu & Đã thu theo tháng: Thu KH, Thu BH, Từng Công ty Bảo hiểm & Cảnh báo VAT chưa xuất HĐ |
| `GET` | `/debts-analytics` | `{ resource: 'garage', action: 'read' }` | `date_from`, `date_to`, `branch_id` | Phân tích tổng hợp công nợ KH vs NCC, mốc thời gian & dự báo IFRS 9 |
| `GET` | `/time-horizons/:horizon/cases` | `{ resource: 'garage', action: 'read' }` | `horizon`, `date_from`, `date_to`, `branch_id`, pagination | Danh sách vụ việc chi tiết theo mốc thời gian cho Drawer |

---

## 5. Logic Nghiệp vụ & Thuật toán Trọng tâm

### 5.1. Công thức Báo cáo Lợi nhuận (P&L) & Tính Tự Động Hoa Hồng:
1. **1. Doanh thu ($R$)**:
   $$\sum \text{COALESCE}(gp.\text{doanh\_thu}, c.\text{doanh\_thu}, c.\text{tien\_co\_thue}, 0)$$
   áp dụng cho các phiếu hoàn thành trong tháng `TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM') = :periodStr`.
2. **2. Chi phí giá vốn ($C_{COGS}$)**:
   $$C_{COGS} = \sum \text{COALESCE}(gp.\text{chi\_phi}, c.\text{chi\_phi}, 0) + \sum \text{DirectCosts}_{\text{nhập tay}}$$
   với $\text{DirectCosts}$ là các khoản OPEX có `category_key IN ('HOA_HONG_TRUC_TIEP', 'CHI_PHI_TRUC_TIEP_KHAC')`.
3. **3. Lợi nhuận gộp ($GP$) & Phân loại Phiếu dịch vụ (`c.classification`)**:
   - $GP = R - C_{COGS}, \quad \text{Gross Margin} = \frac{GP}{R} \times 100\%$
   - **Lợi nhuận gộp Ký gửi ($GP_{kg}$)**: Doanh thu - Chi phí của các phiếu có `c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO')` hoàn thành trong kỳ.
   - **Tỷ lệ lãi gộp ký gửi ($R_{kg}$)**:
     $$R_{kg} = \begin{cases} \frac{GP_{kg}}{GP} \times 100\% & \text{khi } GP > 0 \text{ và } GP_{kg} > 0 \\ 0\% & \text{ngược lại} \end{cases}$$
4. **4. Chi phí bán hàng ($SE$)**:
   - **Hoa hồng cho Sale (10%)**:
     $$\text{Comm}_{sale} = \begin{cases} \text{round}((GP - OPEX) \times R_{kg} \times 10\%) & \text{khi } (GP - OPEX) > 0 \\ 0 & \text{ngược lại} \end{cases}$$
   - $SE = \text{Comm}_{sale} + \sum \text{Selling Expenses nhập tay}$
5. **5. Chi phí vận hành ($OPEX$)**:
   Tổng `amount` các bản ghi trong `kgara_operating_expenses` thuộc nhóm chi phí vận hành (Nhân sự, Thuê mặt bằng, Điện nước, Bảo trì, Khấu hao, Chi phí khác).
6. **6. Lợi nhuận ròng ($NP$)**:
   $$NP = GP - SE - OPEX$$
7. **7. Thưởng và Hoa hồng Dịch vụ ($COMM_{dv}$)**:
   - **Hoa hồng cho Dịch vụ (10%)**:
     $$\text{Comm}_{dv} = \begin{cases} \text{round}(NP \times 10\%) & \text{khi } NP > 0 \\ 0 & \text{khi } NP \le 0 \end{cases}$$
   - $COMM_{dv} = \text{Comm}_{dv} + \sum \text{Manual Commissions (HOA\_HONG\_KHAC)}$
8. **8. Lợi nhuận giữ lại của Garage ($RP$)**:
   $$RP = NP - COMM_{dv}, \quad \text{Retained Margin} = \frac{RP}{R} \times 100\%$$

---

## 6. Tích hợp Liên Module & Frontend

- **Backend Module**: `src/kgara-api-core/`
- **Frontend (`erp-web`)**:
  - API Client:
    - [`garageDashboardApi.ts`](erp/erp-web/src/modules/garage/api/garageDashboardApi.ts)
    - [`garageOpexApi.ts`](erp/erp-web/src/modules/garage/api/garageOpexApi.ts)
  - Custom Hook:
    - [`useGarageOpexList.ts`](erp/erp-web/src/modules/garage/hooks/useGarageOpexList.ts)
  - Pages & Components (Chuẩn `/ui-atomic-refactor`):
    - [`pages/GarageDashboard/`](erp/erp-web/src/modules/garage/pages/GarageDashboard/) (Trang Dashboard chính: Page entry, DateFilterToolbar, useGarageDashboardLogic)
    - [`components/GarageStatsCards/`](erp/erp-web/src/modules/garage/components/GarageStatsCards/) (6 KPI Cards & Sparklines)
    - [`components/GaragePnlSection/`](erp/erp-web/src/modules/garage/components/GaragePnlSection/) (Section Báo cáo P&L dạng bảng phân cấp 8 tầng tài chính, bộ lọc Combobox Tháng/Năm, xuất Excel P&L)
      - **Quy chuẩn Design Tokens phân cấp theo Number Level (4 Tầng)**:
        - **Level 1 (Số La Mã: I → VIII)**: `py-2.5 px-4`, `font-bold text-foreground text-[13px]`, numeric month 0 `font-bold text-foreground`.
        - **Level 2 (`X.Y`: 1.1, 2.1, 2.2, 3.1, 4.1, 4.2, 5.x, 6.1, 7.1, 7.x, 8.1)**: Thụt lề `py-2 px-8`, chữ `font-medium text-slate-700 dark:text-slate-300 text-xs`, numeric month 0 `py-2 px-4 font-semibold text-foreground` (hoặc `font-medium`), đồng bộ màu sắc và độ đậm không phân biệt module.
        - **Level 3 (`X.Y.Z`: 1.1.1, 2.1.1, 2.2.x, 4.1.1, 4.1.2, 5.x.1, 7.x.1)**: Thụt lề `py-1.5 pl-14 pr-4`, chữ `text-[11px] text-muted-foreground`, numeric cells `py-1.5 px-4 text-[11px] text-muted-foreground font-normal`.
        - **Level 4 (`X.Y.Z.W`: 2.2.x.1)**: Thụt lề `py-1.5 pl-20 pr-4`, chữ `text-[11px] italic text-muted-foreground`, numeric cells `py-1.5 px-4 text-[11px] text-muted-foreground font-normal`.
    - [`components/GaragePaymentProgressCard/`](erp/erp-web/src/modules/garage/components/GaragePaymentProgressCard/) (Tiến độ thu/chi & công nợ dịch vụ theo tháng)
    - [`GarageOpex.tsx`](erp/erp-web/src/modules/garage/pages/GarageOpex.tsx) (Trang danh sách Chi phí vận hành dạng Spreadsheet, Combobox filter, sort/filter server-side)
    - [`GarageOpexDrawer.tsx`](erp/erp-web/src/modules/garage/components/GarageOpexDrawer.tsx) (1-column StandardFormDrawer tạo/sửa chi phí với Combobox)

---

## 7. Quy tắc Kiểm thử & Báo cáo Chất lượng (QC Mandate)

1. **TypeCheck & Linting**: Chạy `bun run check:ci` trong `erp-api/` và `erp-web/`.
2. **Backend Unit Tests**: Chạy `bunx jest src/kgara-api-core/ --forceExit` (bắt buộc pass 100%).
3. **Web Build**: Chạy `bun run build` trong `erp-web/` (bắt buộc pass 100%).

> **Bảng màu chart Excel (2026-10-17)**: `CHART_PALETTE` (`src/common/xlsx-charts/xlsx-chart.types.ts`) đổi sang tông chart Dòng tiền web: `059669, EA580C, 475569, E11D48, 7C3AED, 0D9488, CA8A04` (+3 màu dự phòng). Đường `% Lợi nhuận gộp` ở sheet Báo cáo lợi nhuận dùng slot teal `[5]`. Mọi sheet có chart dùng chung bảng này.

> **Phễu chuyển đổi (2026-10-17)**: `conversionFunnel` / `conversionFunnelByMonth` (`garage-dashboard-stats.service.ts`) có thêm `quotation {count, amount, rate}` và `byClassification.*.quotationCount/quotationAmount`. Báo giá = phiếu chưa hoàn thành, chưa hủy và thỏa `quotationStatusSql(alias)` (`helpers/kgara-case-filter.helper.ts`, cùng điều kiện tab Báo giá của danh sách vụ việc); `inProgress*` chỉ còn phiếu chưa hoàn thành không phải báo giá.
