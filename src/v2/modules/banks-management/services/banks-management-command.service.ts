import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankManagement } from '../entities/bank-management.entity';
import { CreateBankManagementDto } from '../dto/create-bank-management.dto';
import { UpdateBankManagementDto } from '../dto/update-bank-management.dto';

@Injectable()
export class BanksManagementCommandService {
  constructor(
    @InjectRepository(BankManagement)
    private readonly repo: Repository<BankManagement>,
  ) {}

  async create(dto: CreateBankManagementDto): Promise<BankManagement> {
    const existing = await this.repo.findOne({
      where: { code: dto.code.trim().toUpperCase(), isDeleted: false },
    });
    if (existing) {
      throw new ConflictException(`Ngân hàng với mã ${dto.code} đã tồn tại`);
    }

    const entity = this.repo.create({
      code: dto.code.trim().toUpperCase(),
      shortName: dto.shortName.trim(),
      name: dto.name.trim(),
      bin: dto.bin.trim(),
      logoUrl: dto.logoUrl?.trim() || null,
      aliases: dto.aliases || [],
      isActive: dto.isActive ?? true,
      transferSupported: dto.transferSupported ?? true,
      lookupSupported: dto.lookupSupported ?? true,
      extraData: dto.extraData || {},
    });

    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateBankManagementDto,
  ): Promise<BankManagement> {
    const entity = await this.repo.findOne({ where: { id, isDeleted: false } });
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy ngân hàng với ID ${id}`);
    }

    if (dto.code && dto.code.trim().toUpperCase() !== entity.code) {
      const codeExists = await this.repo.findOne({
        where: { code: dto.code.trim().toUpperCase(), isDeleted: false },
      });
      if (codeExists && codeExists.id !== id) {
        throw new ConflictException(`Ngân hàng với mã ${dto.code} đã tồn tại`);
      }
      entity.code = dto.code.trim().toUpperCase();
    }

    if (dto.shortName !== undefined) entity.shortName = dto.shortName.trim();
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.bin !== undefined) entity.bin = dto.bin.trim();
    if (dto.logoUrl !== undefined) entity.logoUrl = dto.logoUrl?.trim() || null;
    if (dto.aliases !== undefined) entity.aliases = dto.aliases;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    if (dto.transferSupported !== undefined)
      entity.transferSupported = dto.transferSupported;
    if (dto.lookupSupported !== undefined)
      entity.lookupSupported = dto.lookupSupported;
    if (dto.extraData !== undefined) entity.extraData = dto.extraData;

    return this.repo.save(entity);
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { id, isDeleted: false } });
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy ngân hàng với ID ${id}`);
    }
    entity.isDeleted = true;
    await this.repo.save(entity);
  }
}
