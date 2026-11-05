import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpBusinessPartner } from '../entities/erp_business_partner.entity';
import { CreateErpBusinessPartnerDto } from '../dto/create-erp-business-partner.dto';
import { UpdateErpBusinessPartnerDto } from '../dto/update-erp-business-partner.dto';
import { toErpBusinessPartnerEntityFields } from '../helpers/erp-business-partner.mapper';

/** Ghi dữ liệu: kiểm tra trùng mã, tạo, cập nhật, xóa mềm. Việc kiểm tra tồn tại theo id do Facade đảm nhiệm. */
@Injectable()
export class ErpBusinessPartnerCommandService {
  constructor(
    @InjectRepository(ErpBusinessPartner)
    private readonly repo: Repository<ErpBusinessPartner>,
  ) {}

  /** Mã so khớp không phân biệt hoa thường, bỏ qua bản ghi đã xóa mềm và bản ghi `excludeId` (khi sửa). */
  async assertCodeAvailable(code: string, excludeId?: string): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('LOWER(e.code) = LOWER(:code)', { code })
      .andWhere('e.isDeleted = :isDeleted', { isDeleted: false });
    if (excludeId) qb.andWhere('e.id != :excludeId', { excludeId });

    if (await qb.getOne()) {
      throw new BadRequestException(
        `Mã đối tác "${code}" đã tồn tại trên hệ thống`,
      );
    }
  }

  /** MST là khóa gom đối tác từ hóa đơn: một MST chỉ thuộc một đối tác chưa xóa mềm. */
  async assertTaxCodeAvailable(
    taxCode: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.taxCode = :taxCode', { taxCode })
      .andWhere('e.isDeleted = :isDeleted', { isDeleted: false });
    if (excludeId) qb.andWhere('e.id != :excludeId', { excludeId });

    const owner = await qb.getOne();
    if (owner) {
      throw new BadRequestException(
        `MST "${taxCode}" đã thuộc đối tác "${owner.code}"`,
      );
    }
  }

  create(dto: CreateErpBusinessPartnerDto): Promise<ErpBusinessPartner> {
    const entity = this.repo.create({
      ...toErpBusinessPartnerEntityFields(dto),
      isDeleted: false,
    });
    return this.repo.save(entity);
  }

  update(
    entity: ErpBusinessPartner,
    dto: UpdateErpBusinessPartnerDto,
  ): Promise<ErpBusinessPartner> {
    Object.assign(entity, toErpBusinessPartnerEntityFields(dto));
    return this.repo.save(entity);
  }

  softDelete(entity: ErpBusinessPartner): Promise<ErpBusinessPartner> {
    entity.isDeleted = true;
    return this.repo.save(entity);
  }
}
