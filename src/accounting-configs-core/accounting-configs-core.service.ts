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

  async create(createDto: CreateAccountingConfigsCoreDto) {
    const existing = await this.configRepository.findOne({
      where: { moduleName: createDto.moduleName, action: createDto.action },
    });
    if (existing) {
      throw new BadRequestException(
        'Config for this module and action already exists',
      );
    }

    if (createDto.debitAccountId) {
      const dbAccount = await this.accountRepository.findOne({
        where: { id: createDto.debitAccountId },
      });
      if (!dbAccount) throw new NotFoundException('Debit account not found');
    }
    if (createDto.creditAccountId) {
      const crAccount = await this.accountRepository.findOne({
        where: { id: createDto.creditAccountId },
      });
      if (!crAccount) throw new NotFoundException('Credit account not found');
    }

    const config = this.configRepository.create(createDto);
    return this.configRepository.save(config);
  }

  findAll() {
    return this.configRepository.find({
      relations: ['debitAccount', 'creditAccount'],
      order: { moduleName: 'ASC', action: 'ASC' },
    });
  }

  findOne(id: string) {
    return this.configRepository.findOne({
      where: { id },
      relations: ['debitAccount', 'creditAccount'],
    });
  }

  async findByModuleAction(moduleName: string, action: string) {
    return this.configRepository.findOne({
      where: { moduleName, action, isActive: true },
    });
  }

  async update(id: string, updateDto: UpdateAccountingConfigsCoreDto) {
    const config = await this.findOne(id);
    if (!config) throw new NotFoundException('Config not found');

    if (updateDto.debitAccountId) {
      const dbAccount = await this.accountRepository.findOne({
        where: { id: updateDto.debitAccountId },
      });
      if (!dbAccount) throw new NotFoundException('Debit account not found');
    }
    if (updateDto.creditAccountId) {
      const crAccount = await this.accountRepository.findOne({
        where: { id: updateDto.creditAccountId },
      });
      if (!crAccount) throw new NotFoundException('Credit account not found');
    }

    Object.assign(config, updateDto);
    return this.configRepository.save(config);
  }

  async remove(id: string) {
    const config = await this.findOne(id);
    if (!config) throw new NotFoundException('Config not found');
    return this.configRepository.remove(config);
  }
}
