import { Injectable } from '@nestjs/common';
import {
  KgaraCompletedCasesExportService,
  CompletedCasesExportParams,
} from './kgara-completed-cases-export.service';
import {
  KgaraCaseServicesExportService,
  CaseServicesExportParams,
} from './kgara-case-services-export.service';

export type { CompletedCasesExportParams, CaseServicesExportParams };

/**
 * KgaraCaseExportService Facade:
 * Điều phối các yêu cầu xuất báo cáo Excel cho phân hệ Garage.
 * Tuân thủ mô hình Facade Pattern theo chuẩn /api-service-refactor (< 80 LoC).
 */
@Injectable()
export class KgaraCaseExportService {
  constructor(
    private readonly completedCasesExportService: KgaraCompletedCasesExportService,
    private readonly caseServicesExportService: KgaraCaseServicesExportService,
  ) {}

  /**
   * Xuất danh sách Phiếu Dịch Vụ đã kết thúc theo kỳ ra file Excel (3 Sheets chuẩn hóa: Bảng kê kết thúc, Theo dõi PnL, Chi tiết DV)
   */
  async exportCompletedCasesExcel(
    params: CompletedCasesExportParams,
  ): Promise<Buffer> {
    return this.completedCasesExportService.exportCompletedCasesExcel(params);
  }

  /**
   * Xuất danh sách chi tiết Hạng mục Dịch vụ & Phụ tùng ra file Excel (24 cột chuẩn hóa)
   */
  async exportCaseServicesExcel(
    params: CaseServicesExportParams,
  ): Promise<Buffer> {
    return this.caseServicesExportService.exportCaseServicesExcel(params);
  }
}
