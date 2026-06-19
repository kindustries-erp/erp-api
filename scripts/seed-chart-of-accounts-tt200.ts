/**
 * Seed toàn bộ hệ thống tài khoản kế toán theo Thông tư 200/2014/TT-BTC
 * (cập nhật theo TT 75/2015, TT 132/2018 cho hộ kinh doanh)
 *
 * Chạy: npx ts-node -r tsconfig-paths/register scripts/seed-chart-of-accounts-tt200.ts
 * Hoặc: DATABASE_URL=... bun run scripts/seed-chart-of-accounts-tt200.ts
 */

import { config } from 'dotenv';
import { Client } from 'pg';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

interface Account {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'OTHER';
  normalBalance: 'DEBIT' | 'CREDIT';
  level: number;
  parentCode?: string;
  isCash?: boolean;
  isReceivable?: boolean;
  isPayable?: boolean;
  description?: string;
}

// =============================================================================
// DỮ LIỆU: TOÀN CÂY THÔNG TƯ 200/2014/TT-BTC
// =============================================================================
const ACCOUNTS: Account[] = [
  // ─── LOẠI 1: TÀI SẢN NGẮN HẠN ───────────────────────────────────────────
  { code: '111', name: 'Tiền mặt', type: 'ASSET', normalBalance: 'DEBIT', level: 1, isCash: true },
  { code: '1111', name: 'Tiền Việt Nam', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '111', isCash: true },
  { code: '1112', name: 'Ngoại tệ', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '111' },
  { code: '1113', name: 'Vàng, bạc, đá quý', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '111' },

  { code: '112', name: 'Tiền gửi ngân hàng', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1121', name: 'Tiền Việt Nam', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '112' },
  { code: '1122', name: 'Ngoại tệ', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '112' },
  { code: '1123', name: 'Vàng, bạc, đá quý', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '112' },

  { code: '113', name: 'Tiền đang chuyển', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1131', name: 'Tiền Việt Nam', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '113' },
  { code: '1132', name: 'Ngoại tệ', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '113' },

  { code: '121', name: 'Chứng khoán kinh doanh', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1211', name: 'Cổ phiếu', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '121' },
  { code: '1212', name: 'Trái phiếu', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '121' },
  { code: '1218', name: 'Chứng khoán và công cụ tài chính khác', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '121' },

  { code: '128', name: 'Đầu tư nắm giữ đến ngày đáo hạn', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1281', name: 'Tiền gửi có kỳ hạn', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '128' },
  { code: '1282', name: 'Trái phiếu', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '128' },
  { code: '1283', name: 'Cho vay', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '128' },
  { code: '1288', name: 'Đầu tư nắm giữ đến ngày đáo hạn khác', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '128' },

  { code: '131', name: 'Phải thu của khách hàng', type: 'ASSET', normalBalance: 'DEBIT', level: 1, isReceivable: true },
  { code: '133', name: 'Thuế GTGT được khấu trừ', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1331', name: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '133' },
  { code: '1332', name: 'Thuế GTGT được khấu trừ của TSCĐ', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '133' },

  { code: '136', name: 'Phải thu nội bộ', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1361', name: 'Vốn kinh doanh ở các đơn vị trực thuộc', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '136' },
  { code: '1362', name: 'Phải thu về chi phí sản xuất kinh doanh', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '136' },
  { code: '1363', name: 'Phải thu về lợi nhuận', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '136' },
  { code: '1368', name: 'Phải thu nội bộ khác', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '136' },

  { code: '138', name: 'Phải thu khác', type: 'ASSET', normalBalance: 'DEBIT', level: 1, isReceivable: true },
  { code: '1381', name: 'Tài sản thiếu chờ xử lý', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '138' },
  { code: '1385', name: 'Phải thu về cổ phần hóa', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '138' },
  { code: '1388', name: 'Phải thu khác', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '138' },

  { code: '139', name: 'Dự phòng phải thu khó đòi', type: 'ASSET', normalBalance: 'CREDIT', level: 1 },

  { code: '141', name: 'Tạm ứng', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '151', name: 'Hàng mua đang đi đường', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '152', name: 'Nguyên liệu, vật liệu', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '153', name: 'Công cụ, dụng cụ', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1531', name: 'Công cụ, dụng cụ', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '153' },
  { code: '1532', name: 'Bao bì luân chuyển', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '153' },
  { code: '1533', name: 'Đồ dùng cho thuê', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '153' },
  { code: '1534', name: 'Thiết bị, phụ tùng thay thế', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '153' },

  { code: '154', name: 'Chi phí sản xuất, kinh doanh dở dang', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '155', name: 'Thành phẩm', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1551', name: 'Thành phẩm nhập kho', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '155' },
  { code: '1557', name: 'Thành phẩm bất động sản', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '155' },

  { code: '156', name: 'Hàng hóa', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1561', name: 'Giá mua hàng hóa', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '156' },
  { code: '1562', name: 'Chi phí thu mua hàng hóa', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '156' },
  { code: '1567', name: 'Hàng hóa bất động sản', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '156' },

  { code: '157', name: 'Hàng gửi đi bán', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '158', name: 'Hàng hóa kho bảo thuế', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '161', name: 'Chi sự nghiệp', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '1611', name: 'Chi sự nghiệp năm trước', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '161' },
  { code: '1612', name: 'Chi sự nghiệp năm nay', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '161' },

  // ─── LOẠI 2: TÀI SẢN DÀI HẠN ─────────────────────────────────────────────
  { code: '211', name: 'Tài sản cố định hữu hình', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '2111', name: 'Nhà cửa, vật kiến trúc', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '211' },
  { code: '2112', name: 'Máy móc, thiết bị', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '211' },
  { code: '2113', name: 'Phương tiện vận tải, truyền dẫn', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '211' },
  { code: '2114', name: 'Thiết bị, dụng cụ quản lý', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '211' },
  { code: '2115', name: 'Cây lâu năm, súc vật làm việc và cho sản phẩm', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '211' },
  { code: '2118', name: 'TSCĐ khác', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '211' },

  { code: '212', name: 'Tài sản cố định thuê tài chính', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '2121', name: 'TSCĐ hữu hình thuê tài chính', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '212' },
  { code: '2122', name: 'TSCĐ vô hình thuê tài chính', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '212' },

  { code: '213', name: 'Tài sản cố định vô hình', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '2131', name: 'Quyền sử dụng đất', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '213' },
  { code: '2132', name: 'Quyền phát hành', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '213' },
  { code: '2133', name: 'Bản quyền, bằng sáng chế', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '213' },
  { code: '2134', name: 'Nhãn hiệu hàng hóa', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '213' },
  { code: '2135', name: 'Phần mềm máy tính', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '213' },
  { code: '2136', name: 'Giấy phép và giấy phép nhượng quyền', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '213' },
  { code: '2138', name: 'TSCĐ vô hình khác', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '213' },

  { code: '214', name: 'Hao mòn tài sản cố định', type: 'ASSET', normalBalance: 'CREDIT', level: 1 },
  { code: '2141', name: 'Hao mòn TSCĐ hữu hình', type: 'ASSET', normalBalance: 'CREDIT', level: 2, parentCode: '214' },
  { code: '2142', name: 'Hao mòn TSCĐ thuê tài chính', type: 'ASSET', normalBalance: 'CREDIT', level: 2, parentCode: '214' },
  { code: '2143', name: 'Hao mòn TSCĐ vô hình', type: 'ASSET', normalBalance: 'CREDIT', level: 2, parentCode: '214' },
  { code: '2147', name: 'Hao mòn bất động sản đầu tư', type: 'ASSET', normalBalance: 'CREDIT', level: 2, parentCode: '214' },

  { code: '217', name: 'Bất động sản đầu tư', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '221', name: 'Đầu tư vào công ty con', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '222', name: 'Đầu tư vào công ty liên doanh, liên kết', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '228', name: 'Đầu tư góp vốn vào đơn vị khác', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '2281', name: 'Cổ phiếu', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '228' },
  { code: '2282', name: 'Vốn góp', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '228' },
  { code: '2288', name: 'Đầu tư khác', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '228' },

  { code: '229', name: 'Dự phòng tổn thất tài sản', type: 'ASSET', normalBalance: 'CREDIT', level: 1 },
  { code: '2291', name: 'Dự phòng giảm giá chứng khoán kinh doanh', type: 'ASSET', normalBalance: 'CREDIT', level: 2, parentCode: '229' },
  { code: '2292', name: 'Dự phòng tổn thất đầu tư vào đơn vị khác', type: 'ASSET', normalBalance: 'CREDIT', level: 2, parentCode: '229' },
  { code: '2293', name: 'Dự phòng phải thu khó đòi', type: 'ASSET', normalBalance: 'CREDIT', level: 2, parentCode: '229' },
  { code: '2294', name: 'Dự phòng giảm giá hàng tồn kho', type: 'ASSET', normalBalance: 'CREDIT', level: 2, parentCode: '229' },

  { code: '241', name: 'Xây dựng cơ bản dở dang', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },
  { code: '2411', name: 'Mua sắm TSCĐ', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '241' },
  { code: '2412', name: 'Xây dựng cơ bản', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '241' },
  { code: '2413', name: 'Sửa chữa lớn TSCĐ', type: 'ASSET', normalBalance: 'DEBIT', level: 2, parentCode: '241' },

  { code: '242', name: 'Chi phí trả trước', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '243', name: 'Tài sản thuế thu nhập hoãn lại', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '244', name: 'Cầm cố, thế chấp, ký quỹ, ký cược', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '261', name: 'Quyền sử dụng đất', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  { code: '269', name: 'Tài sản dài hạn khác', type: 'ASSET', normalBalance: 'DEBIT', level: 1 },

  // ─── LOẠI 3: NỢ PHẢI TRẢ ──────────────────────────────────────────────────
  { code: '311', name: 'Vay và nợ thuê tài chính ngắn hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
  { code: '3111', name: 'Vay ngắn hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '311' },
  { code: '3112', name: 'Nợ thuê tài chính ngắn hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '311' },

  { code: '315', name: 'Nợ dài hạn đến hạn trả', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },

  { code: '333', name: 'Thuế và các khoản phải nộp Nhà nước', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
  { code: '3331', name: 'Thuế giá trị gia tăng phải nộp', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },
  { code: '33311', name: 'Thuế GTGT đầu ra', type: 'LIABILITY', normalBalance: 'CREDIT', level: 3, parentCode: '3331' },
  { code: '33312', name: 'Thuế GTGT hàng nhập khẩu', type: 'LIABILITY', normalBalance: 'CREDIT', level: 3, parentCode: '3331' },
  { code: '3332', name: 'Thuế tiêu thụ đặc biệt', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },
  { code: '3333', name: 'Thuế xuất, nhập khẩu', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },
  { code: '3334', name: 'Thuế thu nhập doanh nghiệp', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },
  { code: '3335', name: 'Thuế thu nhập cá nhân', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },
  { code: '3336', name: 'Thuế tài nguyên', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },
  { code: '3337', name: 'Thuế nhà đất, tiền thuê đất', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },
  { code: '3338', name: 'Thuế bảo vệ môi trường và các loại thuế khác', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },
  { code: '3339', name: 'Phí, lệ phí và các khoản phải nộp khác', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '333' },

  { code: '334', name: 'Phải trả người lao động', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1, isPayable: true },
  { code: '3341', name: 'Phải trả công nhân viên', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '334' },
  { code: '3348', name: 'Phải trả người lao động khác', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '334' },

  { code: '335', name: 'Chi phí phải trả', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },

  { code: '336', name: 'Phải trả nội bộ', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
  { code: '3361', name: 'Phải trả nội bộ về vốn kinh doanh', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '336' },
  { code: '3362', name: 'Phải trả nội bộ về chi phí SXKD', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '336' },
  { code: '3363', name: 'Phải trả nội bộ về lợi nhuận', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '336' },
  { code: '3368', name: 'Phải trả nội bộ khác', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '336' },

  { code: '337', name: 'Thanh toán theo tiến độ kế hoạch hợp đồng xây dựng', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },

  { code: '338', name: 'Phải trả, phải nộp khác', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1, isPayable: true },
  { code: '3381', name: 'Tài sản thừa chờ giải quyết', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3382', name: 'Kinh phí công đoàn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3383', name: 'Bảo hiểm xã hội', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3384', name: 'Bảo hiểm y tế', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3385', name: 'Phải trả về cổ phần hóa', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3386', name: 'Nhận ký quỹ, ký cược', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3387', name: 'Doanh thu chưa thực hiện', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3388', name: 'Phải trả, phải nộp khác', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },
  { code: '3389', name: 'Bảo hiểm thất nghiệp', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '338' },

  { code: '341', name: 'Vay và nợ thuê tài chính dài hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
  { code: '3411', name: 'Vay dài hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '341' },
  { code: '3412', name: 'Nợ thuê tài chính dài hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '341' },

  { code: '343', name: 'Trái phiếu phát hành', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
  { code: '3431', name: 'Mệnh giá trái phiếu', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '343' },
  { code: '3432', name: 'Chiết khấu trái phiếu', type: 'LIABILITY', normalBalance: 'DEBIT', level: 2, parentCode: '343' },
  { code: '3433', name: 'Phụ trội trái phiếu', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '343' },

  { code: '344', name: 'Nhận ký quỹ, ký cược dài hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },

  { code: '347', name: 'Thuế thu nhập hoãn lại phải trả', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },

  { code: '352', name: 'Dự phòng phải trả', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
  { code: '3521', name: 'Dự phòng bảo hành sản phẩm, hàng hóa', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '352' },
  { code: '3522', name: 'Dự phòng bảo hành công trình xây dựng', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '352' },
  { code: '3523', name: 'Dự phòng tái cơ cấu doanh nghiệp', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '352' },
  { code: '3524', name: 'Dự phòng phải trả khác', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '352' },

  { code: '353', name: 'Quỹ khen thưởng, phúc lợi', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
  { code: '3531', name: 'Quỹ khen thưởng', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '353' },
  { code: '3532', name: 'Quỹ phúc lợi', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '353' },
  { code: '3533', name: 'Quỹ phúc lợi đã hình thành TSCĐ', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '353' },
  { code: '3534', name: 'Quỹ thưởng ban quản lý điều hành công ty', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '353' },

  { code: '356', name: 'Quỹ phát triển khoa học và công nghệ', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
  { code: '3561', name: 'Quỹ phát triển khoa học và công nghệ', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '356' },
  { code: '3562', name: 'Quỹ phát triển khoa học và công nghệ đã hình thành TSCĐ', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '356' },

  // ─── LOẠI 4: VỐN CHỦ SỞ HỮU ──────────────────────────────────────────────
  { code: '411', name: 'Vốn đầu tư của chủ sở hữu', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },
  { code: '4111', name: 'Vốn góp của chủ sở hữu', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '411' },
  { code: '41111', name: 'Cổ phiếu phổ thông có quyền biểu quyết', type: 'EQUITY', normalBalance: 'CREDIT', level: 3, parentCode: '4111' },
  { code: '41112', name: 'Cổ phiếu ưu đãi', type: 'EQUITY', normalBalance: 'CREDIT', level: 3, parentCode: '4111' },
  { code: '4112', name: 'Thặng dư vốn cổ phần', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '411' },
  { code: '4113', name: 'Quyền chọn chuyển đổi trái phiếu', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '411' },
  { code: '4118', name: 'Vốn khác', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '411' },

  { code: '412', name: 'Chênh lệch đánh giá lại tài sản', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },

  { code: '413', name: 'Chênh lệch tỷ giá hối đoái', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },
  { code: '4131', name: 'Chênh lệch tỷ giá hối đoái đánh giá lại cuối năm', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '413' },
  { code: '4132', name: 'Chênh lệch tỷ giá hối đoái trong giai đoạn đầu tư XDCB', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '413' },

  { code: '414', name: 'Quỹ đầu tư phát triển', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },

  { code: '417', name: 'Quỹ hỗ trợ sắp xếp doanh nghiệp', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },

  { code: '418', name: 'Các quỹ khác thuộc vốn chủ sở hữu', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },

  { code: '419', name: 'Cổ phiếu quỹ', type: 'EQUITY', normalBalance: 'DEBIT', level: 1 },

  { code: '421', name: 'Lợi nhuận sau thuế chưa phân phối', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },
  { code: '4211', name: 'LNST chưa phân phối năm trước', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '421' },
  { code: '4212', name: 'LNST chưa phân phối năm nay', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '421' },

  { code: '441', name: 'Nguồn vốn đầu tư XDCB', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },

  { code: '461', name: 'Nguồn kinh phí sự nghiệp', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },
  { code: '4611', name: 'Nguồn kinh phí sự nghiệp năm trước', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '461' },
  { code: '4612', name: 'Nguồn kinh phí sự nghiệp năm nay', type: 'EQUITY', normalBalance: 'CREDIT', level: 2, parentCode: '461' },

  { code: '466', name: 'Nguồn kinh phí hình thành TSCĐ', type: 'EQUITY', normalBalance: 'CREDIT', level: 1 },

  // ─── LOẠI 5: DOANH THU ────────────────────────────────────────────────────
  { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', type: 'REVENUE', normalBalance: 'CREDIT', level: 1 },
  { code: '5111', name: 'Doanh thu bán hàng hóa', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '511' },
  { code: '5112', name: 'Doanh thu bán các thành phẩm', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '511' },
  { code: '5113', name: 'Doanh thu cung cấp dịch vụ', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '511' },
  { code: '5114', name: 'Doanh thu trợ cấp, trợ giá', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '511' },
  { code: '5117', name: 'Doanh thu kinh doanh bất động sản đầu tư', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '511' },
  { code: '5118', name: 'Doanh thu khác', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '511' },

  { code: '515', name: 'Doanh thu hoạt động tài chính', type: 'REVENUE', normalBalance: 'CREDIT', level: 1 },
  { code: '5151', name: 'Lãi tiền gửi, tiền cho vay', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '515' },
  { code: '5152', name: 'Lãi chênh lệch tỷ giá hối đoái', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '515' },
  { code: '5153', name: 'Cổ tức, lợi nhuận được chia', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '515' },
  { code: '5154', name: 'Thu nhập từ hoạt động cho thuê', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '515' },
  { code: '5155', name: 'Thu nhập từ thanh lý, nhượng bán đầu tư', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '515' },
  { code: '5156', name: 'Chiết khấu thanh toán được hưởng', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '515' },
  { code: '5157', name: 'Thu nhập từ cho thuê tài chính', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '515' },
  { code: '5158', name: 'Doanh thu hoạt động tài chính khác', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '515' },

  { code: '521', name: 'Các khoản giảm trừ doanh thu', type: 'REVENUE', normalBalance: 'DEBIT', level: 1 },
  { code: '5211', name: 'Chiết khấu thương mại', type: 'REVENUE', normalBalance: 'DEBIT', level: 2, parentCode: '521' },
  { code: '5212', name: 'Hàng bán bị trả lại', type: 'REVENUE', normalBalance: 'DEBIT', level: 2, parentCode: '521' },
  { code: '5213', name: 'Giảm giá hàng bán', type: 'REVENUE', normalBalance: 'DEBIT', level: 2, parentCode: '521' },

  // ─── LOẠI 6: CHI PHÍ SẢN XUẤT KINH DOANH ─────────────────────────────────
  { code: '611', name: 'Giá vốn hàng bán', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '6111', name: 'Giá vốn hàng hóa', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '611' },
  { code: '6112', name: 'Giá vốn thành phẩm', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '611' },
  { code: '6113', name: 'Giá vốn dịch vụ', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '611' },
  { code: '6117', name: 'Giá vốn bất động sản đầu tư', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '611' },
  { code: '6118', name: 'Giá vốn khác', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '611' },

  { code: '621', name: 'Chi phí nguyên liệu, vật liệu trực tiếp', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '622', name: 'Chi phí nhân công trực tiếp', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '623', name: 'Chi phí sử dụng máy thi công', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '6231', name: 'Chi phí nhân công', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '623' },
  { code: '6232', name: 'Chi phí vật liệu', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '623' },
  { code: '6233', name: 'Chi phí dụng cụ sản xuất', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '623' },
  { code: '6234', name: 'Chi phí khấu hao máy thi công', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '623' },
  { code: '6237', name: 'Chi phí dịch vụ mua ngoài', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '623' },
  { code: '6238', name: 'Chi phí bằng tiền khác', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '623' },

  { code: '627', name: 'Chi phí sản xuất chung', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '6271', name: 'Chi phí nhân viên phân xưởng', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '627' },
  { code: '6272', name: 'Chi phí vật liệu', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '627' },
  { code: '6273', name: 'Chi phí dụng cụ sản xuất', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '627' },
  { code: '6274', name: 'Chi phí khấu hao TSCĐ', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '627' },
  { code: '6277', name: 'Chi phí dịch vụ mua ngoài', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '627' },
  { code: '6278', name: 'Chi phí bằng tiền khác', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '627' },

  { code: '631', name: 'Giá thành sản xuất', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },

  { code: '632', name: 'Giá vốn hàng bán (phương pháp kê khai thường xuyên)', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },

  { code: '635', name: 'Chi phí tài chính', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '6351', name: 'Lãi vay phải trả', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '635' },
  { code: '6352', name: 'Lỗ chênh lệch tỷ giá hối đoái', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '635' },
  { code: '6353', name: 'Chiết khấu thanh toán cho người mua', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '635' },
  { code: '6354', name: 'Chi phí cho vay và đi vay', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '635' },
  { code: '6355', name: 'Lỗ từ thanh lý, nhượng bán đầu tư', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '635' },
  { code: '6356', name: 'Dự phòng giảm giá đầu tư tài chính', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '635' },
  { code: '6357', name: 'Chi phí hoạt động cho thuê tài chính', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '635' },
  { code: '6358', name: 'Chi phí tài chính khác', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '635' },

  { code: '641', name: 'Chi phí bán hàng', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '6411', name: 'Chi phí nhân viên', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '641' },
  { code: '6412', name: 'Chi phí vật liệu, bao bì', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '641' },
  { code: '6413', name: 'Chi phí dụng cụ, đồ dùng', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '641' },
  { code: '6414', name: 'Chi phí khấu hao TSCĐ', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '641' },
  { code: '6415', name: 'Chi phí bảo hành', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '641' },
  { code: '6417', name: 'Chi phí dịch vụ mua ngoài', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '641' },
  { code: '6418', name: 'Chi phí bằng tiền khác', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '641' },

  { code: '642', name: 'Chi phí quản lý doanh nghiệp', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '6421', name: 'Chi phí nhân viên quản lý', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '642' },
  { code: '6422', name: 'Chi phí vật liệu quản lý', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '642' },
  { code: '6423', name: 'Chi phí đồ dùng văn phòng', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '642' },
  { code: '6424', name: 'Chi phí khấu hao TSCĐ', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '642' },
  { code: '6425', name: 'Thuế, phí và lệ phí', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '642' },
  { code: '6426', name: 'Chi phí dự phòng', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '642' },
  { code: '6427', name: 'Chi phí dịch vụ mua ngoài', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '642' },
  { code: '6428', name: 'Chi phí bằng tiền khác', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '642' },

  // ─── LOẠI 7: THU NHẬP KHÁC ────────────────────────────────────────────────
  { code: '711', name: 'Thu nhập khác', type: 'REVENUE', normalBalance: 'CREDIT', level: 1 },
  { code: '7111', name: 'Thu từ nhượng bán, thanh lý TSCĐ', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '711' },
  { code: '7112', name: 'Thu từ xử lý nợ không phải trả', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '711' },
  { code: '7113', name: 'Thu từ quà biếu, tặng bằng tiền và hiện vật', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '711' },
  { code: '7118', name: 'Thu nhập khác', type: 'REVENUE', normalBalance: 'CREDIT', level: 2, parentCode: '711' },

  // ─── LOẠI 8: CHI PHÍ KHÁC ────────────────────────────────────────────────
  { code: '811', name: 'Chi phí khác', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '8111', name: 'Chi phí về nhượng bán, thanh lý TSCĐ', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '811' },
  { code: '8112', name: 'Tiền phạt vi phạm hợp đồng', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '811' },
  { code: '8113', name: 'Chi phí thu hồi nợ khó đòi đã xử lý', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '811' },
  { code: '8118', name: 'Chi phí khác', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '811' },

  { code: '821', name: 'Chi phí thuế thu nhập doanh nghiệp', type: 'EXPENSE', normalBalance: 'DEBIT', level: 1 },
  { code: '8211', name: 'Chi phí thuế TNDN hiện hành', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '821' },
  { code: '8212', name: 'Chi phí thuế TNDN hoãn lại', type: 'EXPENSE', normalBalance: 'DEBIT', level: 2, parentCode: '821' },

  // ─── LOẠI 9: XÁC ĐỊNH KẾT QUẢ ────────────────────────────────────────────
  { code: '911', name: 'Xác định kết quả kinh doanh', type: 'OTHER', normalBalance: 'DEBIT', level: 1 },

  // ─── TÀI KHOẢN NGOÀI BẢNG ────────────────────────────────────────────────
  { code: '001', name: 'Tài sản thuê ngoài', type: 'OTHER', normalBalance: 'DEBIT', level: 1 },
  { code: '002', name: 'Vật tư, hàng hóa nhận giữ hộ, nhận gia công', type: 'OTHER', normalBalance: 'DEBIT', level: 1 },
  { code: '003', name: 'Hàng hóa nhận bán hộ, nhận ký gửi, ký cược', type: 'OTHER', normalBalance: 'DEBIT', level: 1 },
  { code: '004', name: 'Nợ khó đòi đã xử lý', type: 'OTHER', normalBalance: 'DEBIT', level: 1 },
  { code: '007', name: 'Ngoại tệ các loại', type: 'OTHER', normalBalance: 'DEBIT', level: 1 },
  { code: '009', name: 'Nguồn vốn khấu hao cơ bản', type: 'OTHER', normalBalance: 'DEBIT', level: 1 },

  // ─── TÀI KHOẢN PHỔ BIẾN CHO DOANH NGHIỆP VỪA VÀ NHỎ ─────────────────────
  { code: '331', name: 'Phải trả cho người bán', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1, isPayable: true },
  { code: '3311', name: 'Phải trả người bán ngắn hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '331', isPayable: true },
  { code: '3312', name: 'Phải trả người bán dài hạn', type: 'LIABILITY', normalBalance: 'CREDIT', level: 2, parentCode: '331', isPayable: true },

  { code: '332', name: 'Phải trả theo tiến độ kế hoạch HĐXD', type: 'LIABILITY', normalBalance: 'CREDIT', level: 1 },
];

// =============================================================================
// MAIN
// =============================================================================
async function seedChartOfAccounts() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL không được thiết lập trong .env');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('✅ Kết nối database thành công');

  // Build index for parent lookup
  const codeToId: Map<string, string> = new Map();

  // Sort by level to ensure parents inserted before children
  const sorted = [...ACCOUNTS].sort((a, b) => a.level - b.level);

  let inserted = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    for (const acc of sorted) {
      let parentId: string | null = null;

      if (acc.parentCode) {
        parentId = codeToId.get(acc.parentCode) ?? null;
        if (!parentId) {
          // Try to fetch from DB (in case it already existed)
          const res = await client.query(
            `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1`,
            [acc.parentCode],
          );
          if (res.rows.length > 0) {
            parentId = res.rows[0].id as string;
            codeToId.set(acc.parentCode, parentId as string);
          }
        }
      }

      const res = await client.query(
        `
        INSERT INTO erp_chart_of_accounts (
          account_code, account_name, account_type, normal_balance,
          parent_account_id, level,
          is_cash_account, is_receivable_account, is_payable_account,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        ON CONFLICT (account_code) DO NOTHING
        RETURNING id
        `,
        [
          acc.code,
          acc.name,
          acc.type,
          acc.normalBalance,
          parentId,
          acc.level,
          acc.isCash ?? false,
          acc.isReceivable ?? false,
          acc.isPayable ?? false,
        ],
      );

      if (res.rows.length > 0) {
        codeToId.set(acc.code, res.rows[0].id);
        inserted++;
      } else {
        // Already existed, still need the ID for children
        const existing = await client.query(
          `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1`,
          [acc.code],
        );
        if (existing.rows.length > 0) {
          codeToId.set(acc.code, existing.rows[0].id);
        }
        skipped++;
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Seed hoàn tất: ${inserted} tài khoản mới, ${skipped} đã tồn tại (bỏ qua)`);

    // Verify
    const count = await client.query(`SELECT count(*) FROM erp_chart_of_accounts WHERE is_active = true`);
    console.log(`📊 Tổng số tài khoản active: ${count.rows[0].count}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi seed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

seedChartOfAccounts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
