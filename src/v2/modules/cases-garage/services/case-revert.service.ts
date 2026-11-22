import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseLineGarage } from '../entities/case-line-garage.entity';
import {
  hasOverride,
  OVERRIDE_DELETED,
  revertFields,
} from '../helpers/case-override.helper';
import { CASE_DATE_KEYS, LINE_DATE_KEYS } from '../helpers/case-override.keys';
import { CaseCommandService } from './case-command.service';
import { CaseLineWriter } from './case-line-writer.service';

/**
 * "Về giá trị KGara": chép giá trị từ `sourceSnapshot` về cột hiệu lực và bỏ khóa khỏi `overrides`.
 * Với dòng, khóa `_deleted` khôi phục dòng đã xóa ở v2. Không ghi gì sang `kgara_*`.
 */
@Injectable()
export class CaseRevertService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cases: CaseCommandService,
    private readonly lines: CaseLineWriter,
  ) {}

  /** `fields` rỗng hoặc bỏ trống: về hết mọi field đang override của header. */
  revertCase(branch: string, id: string, fields?: string[]) {
    return this.dataSource.transaction(async (m) => {
      const current = await this.cases.findOwned(m, branch, id, true);
      const keys = this.pickKeys(current.overrides, fields);
      const { values, overrides } = revertFields(
        keys,
        current.sourceSnapshot,
        current.overrides,
        CASE_DATE_KEYS,
      );
      await m.update(CaseGarage, { id }, { ...values, overrides } as never);
      return this.cases.reload(m, id);
    });
  }

  revertLine(
    branch: string,
    caseId: string,
    lineId: string,
    fields?: string[],
  ) {
    return this.dataSource.transaction(async (m) => {
      await this.cases.findOwned(m, branch, caseId, true);
      const line = await m.findOne(CaseLineGarage, {
        where: { id: lineId, caseId },
      });
      if (!line) {
        throw new BadRequestException('Không tìm thấy dòng hạng mục.');
      }
      const keys = this.pickKeys(line.overrides, fields);
      const { values, overrides } = revertFields(
        keys.filter((k) => k !== OVERRIDE_DELETED),
        line.sourceSnapshot,
        line.overrides,
        LINE_DATE_KEYS,
      );
      if (keys.includes(OVERRIDE_DELETED)) delete overrides[OVERRIDE_DELETED];
      await m.update(CaseLineGarage, { id: line.id }, {
        ...values,
        overrides,
      } as never);
      return this.cases.reload(m, caseId);
    });
  }

  private pickKeys(
    overrides: Record<string, true>,
    fields?: string[],
  ): string[] {
    if (!fields?.length) return Object.keys(overrides ?? {});
    const bad = fields.filter((f) => !hasOverride(overrides, f));
    if (bad.length) {
      throw new BadRequestException(
        `Field chưa bị sửa đè ở v2: ${bad.join(', ')}.`,
      );
    }
    return fields;
  }
}
