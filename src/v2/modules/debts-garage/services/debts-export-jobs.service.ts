import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ExportJobRunner,
  formatExportTimestamp,
  stableStringify,
  type ExportStartResult,
} from '@/v2/core/export-jobs-core';
import { GarageDebtsExportDto } from '@/kgara-api-core/dto/garage-export.dto';
import {
  buildGarageDebtFileName,
  type GarageDebtExportKind,
} from '@/kgara-api-core/helpers/garage-debts-export.helper';
import { GarageDebtsExportService } from '@/kgara-api-core/services/garage-debts-export.service';
import { BranchManagementExternalLink } from '@/v2/modules/branches-management/entities/branch-management-external-link.entity';

export const DEBTS_EXPORT_KINDS: ReadonlyArray<GarageDebtExportKind> = [
  'customers',
  'suppliers',
  'all',
];

/** Công nợ đổi theo ngày/đồng bộ nên chỉ tái dùng file vừa tạo trong 10 phút. */
const REUSE_WINDOW_MS = 10 * 60 * 1000;

const PROCESS_IDS: Record<GarageDebtExportKind, string> = {
  all: 'garage-v2-all-debts-xlsx-export',
  customers: 'garage-v2-customers-debt-xlsx-export',
  suppliers: 'garage-v2-suppliers-debt-xlsx-export',
};

/**
 * Job nền xuất Excel công nợ garage v2: bọc `ExportJobRunner` quanh service dựng Excel hiện có
 * (`GarageDebtsExportService`). Mỗi loại có runner riêng nên xuất song song được; mỗi user 1 job
 * RUNNING trên mỗi runner. Fingerprint luôn gồm `branchId` để không dùng nhầm file giữa chi nhánh.
 */
@Injectable()
export class DebtsExportJobsService implements OnModuleDestroy {
  private readonly runners = Object.fromEntries(
    DEBTS_EXPORT_KINDS.map((kind) => [
      kind,
      new ExportJobRunner({
        processId: PROCESS_IDS[kind],
        reuseWindowMs: REUSE_WINDOW_MS,
      }),
    ]),
  ) as Record<GarageDebtExportKind, ExportJobRunner>;

  constructor(
    private readonly excel: GarageDebtsExportService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * V2 chọn chi nhánh ERP, còn file Excel (dùng chung service V1) vẫn lọc theo đơn vị KGara: đổi qua
   * `branches_management_external_links`. Bỏ bước đổi này khi V1 chuyển sang chi nhánh ERP (Phase 5).
   */
  async startForErpBranch(
    kind: GarageDebtExportKind,
    dto: GarageDebtsExportDto,
    erpBranchId: string | undefined,
    userId: string,
  ): Promise<ExportStartResult> {
    if (!erpBranchId) {
      throw new BadRequestException('Xuất Excel công nợ cần chọn chi nhánh.');
    }
    const link = await this.dataSource
      .getRepository(BranchManagementExternalLink)
      .findOne({
        where: { branchId: erpBranchId, source: 'KGARA', isDeleted: false },
      });
    if (!link) {
      throw new BadRequestException(
        'Chi nhánh chưa liên kết KGara nên chưa xuất được Excel công nợ.',
      );
    }
    return this.start(kind, dto, link.externalId, userId);
  }

  onModuleDestroy(): void {
    Object.values(this.runners).forEach((runner) => runner.destroy());
  }

  runner(kind: GarageDebtExportKind): ExportJobRunner {
    return this.runners[kind];
  }

  start(
    kind: GarageDebtExportKind,
    dto: GarageDebtsExportDto,
    branchId: string,
    userId: string,
  ): ExportStartResult {
    if (!branchId) throw new BadRequestException('Thiếu chi nhánh.');
    if (!userId) throw new BadRequestException('Thiếu người dùng đăng nhập.');
    const filters = this.excel.normalizeFilters(dto);

    return this.runners[kind].start({
      userId,
      fingerprint: stableStringify({ kind, branchId, ...filters }),
      fileName: buildGarageDebtFileName(
        kind,
        formatExportTimestamp(new Date()),
      ),
      totalUnits: GarageDebtsExportService.PROGRESS_TOTAL_UNITS,
      dateFrom: dto.from,
      dateTo: dto.to,
      producer: (onProgress) =>
        this.excel.exportExcel(kind, branchId, dto, onProgress),
    });
  }
}
