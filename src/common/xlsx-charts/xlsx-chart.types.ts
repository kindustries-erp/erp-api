export type XlsxChartType = 'column' | 'bar' | 'line' | 'doughnut' | 'combo';

export interface XlsxChartSeries {
  name: string;
  /** Tham chiếu ô trên sheet chứa chart, vd `$B$20:$B$29` (không kèm tên sheet). */
  valuesRef: string;
  /**
   * Giá trị hiện tại của vùng `valuesRef` (điền numCache để mở file là thấy chart ngay).
   * `null` là ô trống: điểm bị bỏ qua, đường ngắt quãng thay vì về 0.
   */
  values: (number | null)[];
  /** Màu hex 6 ký tự, không có `#`. */
  color: string;
  /** Chỉ dùng cho `combo`: series vẽ dạng đường thay vì cột. */
  kind?: 'column' | 'line';
  /** Chỉ dùng cho series đường của `combo`: vẽ trên trục giá trị phụ (bên phải). */
  secondaryAxis?: boolean;
  /** Bật/tắt nhãn số riêng cho series; mặc định theo `XlsxChartSpec.dataLabels`. */
  dataLabels?: boolean;
  /** Định dạng nhãn riêng cho series; mặc định theo `XlsxChartSpec.labelNumFmt`. */
  labelNumFmt?: string;
}

export interface XlsxChartAnchor {
  /** Chỉ số cột/hàng bắt đầu từ 0, ô `to` là ô đầu tiên nằm NGOÀI chart. */
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}

export interface XlsxChartSpec {
  type: XlsxChartType;
  title: string;
  anchor: XlsxChartAnchor;
  /** Vd `$A$20:$A$29`. */
  categoriesRef: string;
  categories: string[];
  series: XlsxChartSeries[];
  /** Mã định dạng số của trục giá trị / nhãn, mặc định `#,##0`. */
  numFmt?: string;
  /** Hiển thị nhãn giá trị trên cột / điểm (doughnut luôn hiển thị %). */
  dataLabels?: boolean;
  /** Màu từng lát cho doughnut (mặc định lấy bảng màu chung). */
  pointColors?: string[];
  /** Đảo thứ tự danh mục (dòng đầu bảng nằm trên cùng ở chart `bar`). */
  reverseCategories?: boolean;
  /** Cột chồng (stacked) thay vì cột ghép. */
  stacked?: boolean;
  /** Định dạng số của nhãn giá trị, mặc định bằng `numFmt` (vd `LABEL_MONEY_FMT`, `0%;-0%;;`). */
  labelNumFmt?: string;
  /** Cỡ chữ nhãn giá trị, đơn vị 1/100 pt (mặc định 800 = 8pt). */
  labelFontSize?: number;
  /** Cận dưới / cận trên cố định của trục phụ (vd 0 để % không bị phóng đại). */
  secondaryMin?: number;
  secondaryMax?: number;
  /** Định dạng số của trục phụ và series trên trục phụ, mặc định `0.0%`. */
  secondaryNumFmt?: string;
}

/** Nhãn tiền gọn: triệu (`12,5tr`), nghìn (`138k`); số 0, âm hoặc dưới 1.000 để trống cho đỡ rối. */
export const LABEL_MONEY_FMT = '[>=1000000]#,##0.0,,"tr";[>=1000]#,##0,"k";""';

/** Nhãn phần trăm (`35%`), ẩn các giá trị dưới 3% để chart cột chồng đỡ rối. */
export const LABEL_PERCENT_FMT = '[<0.03]"";0%';

/** Bảng màu trung tính (không dùng xanh dương), cùng tông với chart Dòng tiền trên web. */
export const CHART_PALETTE = [
  '059669', // emerald
  'EA580C', // orange
  '475569', // slate
  'E11D48', // rose
  '7C3AED', // violet
  '0D9488', // teal
  'CA8A04', // yellow
  '9333EA', // purple
  'D97706', // amber
  '64748B', // slate-light
];
