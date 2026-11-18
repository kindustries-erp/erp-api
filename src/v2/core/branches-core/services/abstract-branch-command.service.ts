import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  assertValidExtraData,
  mergeExtraData,
} from '../../base-core/helpers/extra-data.util';
import { BranchInput, BranchReferencePort } from '../contracts/branch.contract';
import { BaseBranchEntity } from '../entities/base-branch.entity';

/**
 * Ghi chi nhánh: tạo, sửa, xóa mềm. Xóa bị chặn (409) khi cổng tham chiếu
 * báo còn bảng đang dùng chi nhánh. Module cung cấp repository và cổng.
 */
export abstract class AbstractBranchCommandService<
  TBranch extends BaseBranchEntity,
> {
  protected abstract readonly repository: Repository<TBranch>;
  protected abstract readonly references: BranchReferencePort;

  private liveWhere(id: string): FindOptionsWhere<TBranch> {
    return { id, isDeleted: false } as unknown as FindOptionsWhere<TBranch>;
  }

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
    } as unknown as DeepPartial<TBranch>);
    const saved = await this.repository.save(item);
    return { data: saved, message: 'Branch created successfully' };
  }

  async update(id: string, data: BranchInput) {
    const current = await this.repository.findOne({
      where: this.liveWhere(id),
    });
    // Hợp đồng cũ: PATCH bản ghi không có (hoặc đã xóa mềm) trả `data: null`, không lỗi.
    if (!current) {
      return { data: null, message: 'Branch updated successfully' };
    }

    const patch: Record<string, unknown> = {
      code: data.code,
      name: data.name,
      isActive: data.is_active,
    };
    if (data.extraData !== undefined) {
      assertValidExtraData(data.extraData);
      // Merge cấp 1 với dữ liệu đang lưu; chỉ ghi cột khi client gửi extraData.
      patch.extraData = mergeExtraData(
        current.extraData ?? {},
        data.extraData as Record<string, unknown>,
      );
    }
    await this.repository.update(id, patch as QueryDeepPartialEntity<TBranch>);
    const updated = await this.repository.findOne({
      where: this.liveWhere(id),
    });
    return { data: updated, message: 'Branch updated successfully' };
  }

  /** Xóa mềm: `isDeleted = true`, `isActive = false`. 409 khi còn tham chiếu. */
  async remove(id: string) {
    const current = await this.repository.findOne({
      where: this.liveWhere(id),
    });
    if (!current) throw new NotFoundException('Không tìm thấy chi nhánh.');

    const refs = await this.references.findReferences(id);
    if (refs.length > 0) {
      throw new ConflictException({
        message: 'Chi nhánh đang được sử dụng, không thể xóa.',
        references: refs,
      });
    }

    await this.repository.update(id, {
      isDeleted: true,
      isActive: false,
    } as unknown as QueryDeepPartialEntity<TBranch>);
    return { message: 'Branch deleted successfully' };
  }
}
