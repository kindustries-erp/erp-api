import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { CaseServiceLineDto } from '../dto/case-service-line.dto';
import { CaseLineGarage } from '../entities/case-line-garage.entity';
import { CaseOrigin } from '../entities/case-garage.enums';
import {
  markOverrides,
  OVERRIDE_DELETED,
  type OverrideMap,
} from '../helpers/case-override.helper';
import { LINE_OVERRIDABLE_KEYS } from '../helpers/case-override.keys';
import { CaseCommandService } from './case-command.service';
import { CaseLineWriter } from './case-line-writer.service';

/** Dòng nối với KGara (có `externalId`): sửa đè ở v2, không xóa cứng. Dòng nhập tay: ghi trực tiếp. */
const isSyncLine = (l: CaseLineGarage) => l.externalId != null;

/**
 * Lệnh trên từng dòng hạng mục. Xe NATIVE và dòng nhập tay ghi trực tiếp (tổng header tính lại).
 * Dòng sync từ KGara: sửa ghi cột hiệu lực + `overrides`, xóa là đặt `_deleted`; không ghi ngược `kgara_*`.
 * Header của xe sync không tính lại từ dòng (số tiền header cũng là field override được).
 */
@Injectable()
export class CaseLineCommandService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cases: CaseCommandService,
    private readonly lines: CaseLineWriter,
  ) {}

  add(branchId: string | undefined, caseId: string, dto: CaseServiceLineDto) {
    return this.dataSource.transaction(async (m) => {
      const header = await this.cases.findOwned(m, branchId, caseId, true);
      await this.lines.add(
        m,
        header,
        dto,
        header.origin !== CaseOrigin.KGARA_SYNC,
      );
      return this.cases.reload(m, caseId);
    });
  }

  replace(
    branchId: string | undefined,
    caseId: string,
    lineId: string,
    dto: CaseServiceLineDto,
  ) {
    return this.dataSource.transaction(async (m) => {
      const header = await this.cases.findOwned(m, branchId, caseId, true);
      const line = await this.lines.findLine(m, caseId, lineId);
      if (isSyncLine(line)) {
        const fields: Record<string, unknown> = { ...this.lines.toFields(dto) };
        if (dto.lineNumber == null) delete fields.lineNumber;
        await this.writeOverride(m, line, fields);
      } else {
        await this.lines.replaceOne(m, header, lineId, dto);
      }
      return this.cases.reload(m, caseId);
    });
  }

  remove(branchId: string | undefined, caseId: string, lineId: string) {
    return this.dataSource.transaction(async (m) => {
      await this.cases.findOwned(m, branchId, caseId, true);
      const line = await this.lines.findLine(m, caseId, lineId);
      if (isSyncLine(line)) {
        const overrides: OverrideMap = {
          ...line.overrides,
          [OVERRIDE_DELETED]: true,
        };
        await m.update(CaseLineGarage, { id: line.id }, { overrides });
      } else {
        await this.lines.remove(m, caseId, lineId);
      }
      return this.cases.reload(m, caseId);
    });
  }

  /** Sửa giá vốn phụ tùng. Dòng sync: ghi đè ở v2; dòng nhập tay: ghi thẳng và tính lại tổng. */
  updatePartsCost(
    branchId: string | undefined,
    caseId: string,
    lineId: string,
    partsCost: number,
  ) {
    return this.dataSource.transaction(async (m) => {
      await this.cases.findOwned(m, branchId, caseId, true);
      const line = await this.lines.findLine(m, caseId, lineId);
      const patch = { partsCost: partsCost.toFixed(2) };
      if (isSyncLine(line)) {
        await this.writeOverride(m, line, patch);
      } else {
        await m.update(CaseLineGarage, { id: line.id }, patch);
        await this.lines.recompute(m, caseId);
      }
      return this.cases.reload(m, caseId);
    });
  }

  private async writeOverride(
    m: import('typeorm').EntityManager,
    line: CaseLineGarage,
    fields: Record<string, unknown>,
  ): Promise<void> {
    const overrides = markOverrides(
      fields,
      line.sourceSnapshot,
      line.overrides,
      LINE_OVERRIDABLE_KEYS,
    );
    await m.update(CaseLineGarage, { id: line.id }, {
      ...fields,
      overrides,
    } as never);
  }
}
