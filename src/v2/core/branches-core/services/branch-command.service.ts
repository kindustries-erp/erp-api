import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpBranch } from '../entities/erp_branch.entity';

export type BranchInput = Record<string, unknown>;

@Injectable()
export class BranchCommandService {
  constructor(
    @InjectRepository(ErpBranch)
    private readonly repository: Repository<ErpBranch>,
  ) {}

  async create(data: BranchInput) {
    const item = this.repository.create({
      code: data.code as string,
      name: data.name as string,
      isActive: data.is_active as boolean,
    });
    const saved = await this.repository.save(item);
    return { data: saved, message: 'Branch created successfully' };
  }

  async update(id: string, data: BranchInput) {
    await this.repository.update(id, {
      code: data.code as string,
      name: data.name as string,
      isActive: data.is_active as boolean,
    });
    const updated = await this.repository.findOne({ where: { id } });
    return { data: updated, message: 'Branch updated successfully' };
  }

  async remove(id: string) {
    await this.repository.delete(id);
    return { message: 'Branch deleted successfully' };
  }
}
