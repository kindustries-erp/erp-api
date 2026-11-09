import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ErpBranch } from '../entities/erp_branch.entity';
import {
  assertValidExtraData,
  mergeExtraData,
} from '../../base-core/helpers/extra-data.util';

export type BranchInput = Record<string, unknown>;

@Injectable()
export class BranchCommandService {
  constructor(
    @InjectRepository(ErpBranch)
    private readonly repository: Repository<ErpBranch>,
  ) {}

  async create(data: BranchInput) {
    if (data.extraData !== undefined) assertValidExtraData(data.extraData);
    const item = this.repository.create({
      code: data.code as string,
      name: data.name as string,
      isActive: data.is_active as boolean,
      // Không gửi extraData khi client bỏ trống: cột DB mặc định '{}'.
      ...(data.extraData !== undefined
        ? { extraData: data.extraData as Record<string, unknown> }
        : {}),
    });
    const saved = await this.repository.save(item);
    return { data: saved, message: 'Branch created successfully' };
  }

  async update(id: string, data: BranchInput) {
    const patch: QueryDeepPartialEntity<ErpBranch> = {
      code: data.code as string,
      name: data.name as string,
      isActive: data.is_active as boolean,
    };
    if (data.extraData !== undefined) {
      assertValidExtraData(data.extraData);
      // Merge cấp 1 với dữ liệu đang lưu; chỉ ghi cột khi client gửi extraData.
      const current = await this.repository.findOne({ where: { id } });
      patch.extraData = mergeExtraData(
        current?.extraData ?? {},
        data.extraData as Record<string, unknown>,
      ) as QueryDeepPartialEntity<ErpBranch>['extraData'];
    }
    await this.repository.update(id, patch);
    const updated = await this.repository.findOne({ where: { id } });
    return { data: updated, message: 'Branch updated successfully' };
  }

  async remove(id: string) {
    await this.repository.delete(id);
    return { message: 'Branch deleted successfully' };
  }
}
