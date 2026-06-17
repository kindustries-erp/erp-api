import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAccountingConfigsCoreDto } from './dto/create-accounting-configs-core.dto';
import { UpdateAccountingConfigsCoreDto } from './dto/update-accounting-configs-core.dto';
import { ErpModuleAccountingConfig } from './entities/erp_module_accounting_config.entity';
import { ErpChartOfAccount } from '../journal-entries/entities/erp_chart_of_account.entity';

@Injectable()
export class AccountingConfigsCoreService {
  constructor(
    @InjectRepository(ErpModuleAccountingConfig)
    private configRepository: Repository<ErpModuleAccountingConfig>,
    @InjectRepository(ErpChartOfAccount)
    private accountRepository: Repository<ErpChartOfAccount>,
  ) {}

  private mapResponse(item: ErpModuleAccountingConfig) {
    return {
      id: item.id,
      module: item.moduleName,
      debit_account_id: item.debitAccountId,
      credit_account_id: item.creditAccountId,
      is_active: item.isActive,
      description: '',
      debit_account: item.debitAccount
        ? {
            id: item.debitAccount.id,
            account_code: item.debitAccount.accountCode,
            account_name: item.debitAccount.accountName,
          }
        : null,
      credit_account: item.creditAccount
        ? {
            id: item.creditAccount.id,
            account_code: item.creditAccount.accountCode,
            account_name: item.creditAccount.accountName,
          }
        : null,
    };
  }

  async create(createDto: CreateAccountingConfigsCoreDto) {
    const existing = await this.configRepository.findOne({
      where: { moduleName: createDto.module },
    });
    if (existing) {
      throw new BadRequestException('Config for this module already exists');
    }

    if (createDto.debit_account_id) {
      const dbAccount = await this.accountRepository.findOne({
        where: { id: createDto.debit_account_id },
      });
      if (!dbAccount) throw new NotFoundException('Debit account not found');
    }
    if (createDto.credit_account_id) {
      const crAccount = await this.accountRepository.findOne({
        where: { id: createDto.credit_account_id },
      });
      if (!crAccount) throw new NotFoundException('Credit account not found');
    }

    const config = this.configRepository.create({
      moduleName: createDto.module,
      debitAccountId: createDto.debit_account_id || null,
      creditAccountId: createDto.credit_account_id || null,
      isActive: createDto.is_active ?? true,
    });
    const saved = await this.configRepository.save(config);
    return { data: this.mapResponse(saved) };
  }

  async findAll() {
    const items = await this.configRepository.find({
      relations: ['debitAccount', 'creditAccount'],
      order: { moduleName: 'ASC' },
    });
    const mapped = items.map((item) => this.mapResponse(item));
    return {
      items: mapped,
      total: mapped.length,
      page: 1,
      pageSize: mapped.length || 10,
      totalPages: 1,
    };
  }

  async findOne(id: string) {
    const item = await this.configRepository.findOne({
      where: { id },
      relations: ['debitAccount', 'creditAccount'],
    });
    if (!item) throw new NotFoundException('Config not found');
    return { data: this.mapResponse(item) };
  }

  async findByModule(moduleName: string) {
    return this.configRepository.findOne({
      where: { moduleName, isActive: true },
    });
  }

  async update(id: string, updateDto: UpdateAccountingConfigsCoreDto) {
    const config = await this.configRepository.findOne({
      where: { id },
    });
    if (!config) throw new NotFoundException('Config not found');

    if (updateDto.debit_account_id) {
      const dbAccount = await this.accountRepository.findOne({
        where: { id: updateDto.debit_account_id },
      });
      if (!dbAccount) throw new NotFoundException('Debit account not found');
    }
    if (updateDto.credit_account_id) {
      const crAccount = await this.accountRepository.findOne({
        where: { id: updateDto.credit_account_id },
      });
      if (!crAccount) throw new NotFoundException('Credit account not found');
    }

    if (updateDto.module !== undefined) config.moduleName = updateDto.module;
    if (updateDto.debit_account_id !== undefined)
      config.debitAccountId = updateDto.debit_account_id;
    if (updateDto.credit_account_id !== undefined)
      config.creditAccountId = updateDto.credit_account_id;
    if (updateDto.is_active !== undefined)
      config.isActive = updateDto.is_active;

    const saved = await this.configRepository.save(config);
    const reloaded = await this.configRepository.findOne({
      where: { id: saved.id },
      relations: ['debitAccount', 'creditAccount'],
    });
    return { data: this.mapResponse(reloaded!) };
  }

  async remove(id: string) {
    const config = await this.configRepository.findOne({
      where: { id },
    });
    if (!config) throw new NotFoundException('Config not found');
    await this.configRepository.remove(config);
    return { message: 'Deleted' };
  }
}
