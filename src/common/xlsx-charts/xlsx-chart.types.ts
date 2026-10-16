export type XlsxChartType = 'column' | 'bar' | 'line' | 'doughnut' | 'combo';

export interface XlsxChartSeries {
  name: string;
  /** Tham chiếu ô trên sheet chứa chart, vd `$B$20:$B$29` (không kèm tên sheet). */
  valuesRef: string;
  /** Giá trị hiện tại của vùng `valuesRef` (điền numCache để mở file là thấy chart ngay). */
  values: number[];
  /** Màu hex 6 ký tự, không có `#`. */
  color: string;
  /** Chỉ dùng cho `combo`: series vẽ dạng đường thay vì cột. */
  kind?: 'column' | 'line';
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
}

/** Bảng màu trung tính (không dùng xanh dương). */
export const CHART_PALETTE = [
  '059669', // emerald
  'D97706', // amber
  '475569', // slate
  'E11D48', // rose
  '7C3AED', // violet
  '0D9488', // teal
  'CA8A04', // yellow
  '9333EA', // purple
  'EA580C', // orange
  '64748B', // slate-light
];
