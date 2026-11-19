import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { CaseServiceLineDto } from '../dto/case-service-line.dto';
import { CaseServiceGarage } from '../entities/case-service-garage.entity';
import { assertStructureEditable } from '../helpers/case-origin.guard';
import { CaseCommandService } from './case-command.service';
import { CaseKgaraMirrorService } from './case-kgara-mirror.service';
import { CaseLineWriter } from './case-line-writer.service';
import { CaseOrigin } from '../entities/case-garage.enums';

/**
 * Lệnh trên từng dòng hạng mục. Xe NATIVE thêm/thay/xóa tự do; xe KGARA_SYNC chỉ sửa giá vốn
 * phụ tùng (`partsCost`, giống V1 `lines-cost`) và mirror ngược về `kgara_case_services`.
 */
@Injectable()
export class CaseLineCommandService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cases: CaseCommandService,
    private readonly lines: CaseLineWriter,
    private readonly mirror: CaseKgaraMirrorService,
  ) {}

  add(branch: string, caseId: string, dto: CaseServiceLineDto) {
    return this.dataSource.transaction(async (m) => {
      const header = await this.cases.findOwned(m, branch, caseId, true);
      assertStructureEditable(header.origin);
      await this.lines.add(m, header, dto);
      return this.cases.reload(m, caseId);
    });
  }

  replace(
    branch: string,
    caseId: string,
    lineId: string,
    dto: CaseServiceLineDto,
  ) {
    return this.dataSource.transaction(async (m) => {
      const header = await this.cases.findOwned(m, branch, caseId, true);
      assertStructureEditable(header.origin);
      await this.lines.replaceOne(m, header, lineId, dto);
      return this.cases.reload(m, caseId);
    });
  }

  remove(branch: string, caseId: string, lineId: string) {
    return this.dataSource.transaction(async (m) => {
      const header = await this.cases.findOwned(m, branch, caseId, true);
      assertStructureEditable(header.origin);
      await this.lines.remove(m, caseId, lineId);
      return this.cases.reload(m, caseId);
    });
  }

  /** Cho cả NATIVE và SYNC. SYNC: mirror V1; tổng header do projector cập nhật từ V1. */
  updatePartsCost(
    branch: string,
    caseId: string,
    lineId: string,
    partsCost: number,
  ) {
    return this.dataSource.transaction(async (m) => {
      const header = await this.cases.findOwned(m, branch, caseId, true);
      const line = await this.lines.findLine(m, caseId, lineId);
      const patch = { partsCost: partsCost.toFixed(2) };
      await m.update(CaseServiceGarage, { id: line.id }, patch);
      if (header.origin === CaseOrigin.KGARA_SYNC) {
        await this.mirror.mirrorLine(m, line, patch);
      } else {
        await this.lines.recompute(m, caseId);
      }
      return this.cases.reload(m, caseId);
    });
  }
}
