import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { GarageItem } from '../entities/garage-item.entity';
import { CreateGarageItemDto } from '../dto/create-garage-item.dto';
import { UpdateGarageItemDto } from '../dto/update-garage-item.dto';
import { toGarageItemEntityFields } from '../helpers/garage-item.mapper';
import {
  assertValidExtraData,
  mergeExtraData,
} from '@/v2/core/base-core/helpers/extra-data.util';

/** Ghi dữ liệu: tạo, cập nhật, xóa mềm. Việc kiểm tra tồn tại do Facade đảm nhiệm. */
@Injectable()
export class GarageItemCommandService {
  constructor(
    @InjectRepository(GarageItem)
    private readonly repo: Repository<GarageItem>,
  ) {}

  async create(dto: CreateGarageItemDto): Promise<GarageItem> {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    const fields = toGarageItemEntityFields(dto);
    await this.assertCodeAvailable(fields.itemCode);
    const entity = this.repo.create({
      ...fields,
      source: 'MANUAL',
      isActive: dto.isActive ?? true,
      isDeleted: false,
      extraData: dto.extraData ?? {},
    });
    return this.repo.save(entity);
  }

  async update(
    entity: GarageItem,
    dto: UpdateGarageItemDto,
  ): Promise<GarageItem> {
    if (dto.extraData !== undefined) assertValidExtraData(dto.extraData);
    const fields = toGarageItemEntityFields(dto);
    if (fields.itemCode !== undefined && fields.itemCode !== entity.itemCode) {
      await this.assertCodeAvailable(fields.itemCode, entity.id);
    }
    Object.assign(entity, fields);
    if (dto.extraData !== undefined) {
      entity.extraData = mergeExtraData(entity.extraData, dto.extraData);
    }
    return this.repo.save(entity);
  }

  softDelete(entity: GarageItem): Promise<GarageItem> {
    entity.isDeleted = true;
    return this.repo.save(entity);
  }

  /** Mã phải có ký tự hợp lệ và chưa dùng ở dòng chưa xóa nào khác. */
  private async assertCodeAvailable(
    code: string | undefined,
    exceptId?: string,
  ) {
    if (!code) throw new BadRequestException('Mã hàng không hợp lệ');
    const existing = await this.repo.findOne({
      where: {
        itemCode: code,
        isDeleted: false,
        ...(exceptId ? { id: Not(exceptId) } : {}),
      },
    });
    if (existing) throw new ConflictException(`Mã hàng ${code} đã tồn tại`);
  }
}
