import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpExpenseAccountRule } from '../entities/erp_expense_account_rule.entity';
import { ErpChartOfAccount } from '../../accounting-core/entities/erp_chart_of_account.entity';

export interface ResolvedExpenseAccounts {
  debitAccountId: string;
  debitAccountCode: string;
  creditAccountId: string;
  creditAccountCode: string;
  vatAccountId?: string;
  vatAccountCode?: string;
}

@Injectable()
export class SmartAccountMappingService {
  private readonly logger = new Logger(SmartAccountMappingService.name);

  constructor(
    @InjectRepository(ErpExpenseAccountRule)
    private readonly ruleRepo: Repository<ErpExpenseAccountRule>,
    @InjectRepository(ErpChartOfAccount)
    private readonly coaRepo: Repository<ErpChartOfAccount>,
  ) {}

  async findAccountByCode(code: string): Promise<ErpChartOfAccount | null> {
    const exact = await this.coaRepo.findOne({
      where: { accountCode: code, isDeleted: false, isActive: true },
    });
    if (exact) return exact;

    // Fallback if T-prefix vs 0-prefix (e.g. T0001 <-> 0001)
    if (code.startsWith('T000')) {
      const altCode = code.slice(1);
      const alt = await this.coaRepo.findOne({
        where: { accountCode: altCode, isDeleted: false, isActive: true },
      });
      if (alt) return alt;
    }

    // Prefix search (e.g. 642 -> 6422 or 642)
    const starts = await this.coaRepo
      .createQueryBuilder('coa')
      .where('coa.accountCode LIKE :prefix', { prefix: `${code}%` })
      .andWhere('coa.isDeleted = false')
      .andWhere('coa.isActive = true')
      .orderBy('LENGTH(coa.accountCode)', 'ASC')
      .addOrderBy('coa.accountCode', 'ASC')
      .getOne();

    return starts;
  }

  async resolveExpenseAccounts(
    categoryKey: string,
    accrualMode: 'NONE' | 'ACCRUED' | 'SETTLED' = 'NONE',
  ): Promise<ResolvedExpenseAccounts> {
    let rule = await this.ruleRepo.findOne({
      where: { categoryKey, accrualMode, isActive: true },
    });

    if (!rule && accrualMode !== 'NONE') {
      rule = await this.ruleRepo.findOne({
        where: { categoryKey, isActive: true },
      });
    }

    let debitCode = '6422';
    let creditCode = '1121';
    let vatCode: string | undefined = undefined;

    if (accrualMode === 'ACCRUED') {
      debitCode = rule?.accrualDebitAccountCode || '6422';
      creditCode = rule?.accrualCreditAccountCode || '335';
    } else if (accrualMode === 'SETTLED') {
      debitCode = rule?.settleDebitAccountCode || '335';
      creditCode = rule?.settleCreditAccountCode || '331';
      vatCode = rule?.settleVatAccountCode || '1331';
    } else {
      debitCode = rule?.directDebitAccountCode || '6422';
      creditCode = rule?.directCreditAccountCode || '1121';
    }

    const debitAcc = await this.findAccountByCode(debitCode);
    const creditAcc = await this.findAccountByCode(creditCode);

    if (!debitAcc || !creditAcc) {
      this.logger.warn(
        `Không tìm thấy đầy đủ tài khoản cho rule ${categoryKey} (${debitCode}/${creditCode}). Fallback sang 642/1121.`,
      );
    }

    const fallbackDebit = debitAcc || (await this.findAccountByCode('642'));
    const fallbackCredit =
      creditAcc ||
      (accrualMode === 'ACCRUED'
        ? await this.findAccountByCode('335')
        : await this.findAccountByCode('1121'));

    if (!fallbackDebit || !fallbackCredit) {
      throw new NotFoundException(
        `Không tìm thấy tài khoản kế toán hợp lệ trong hệ thống cho nghiệp vụ ${categoryKey}.`,
      );
    }

    let vatAcc: ErpChartOfAccount | null = null;
    if (vatCode) {
      vatAcc = await this.findAccountByCode(vatCode);
    }

    return {
      debitAccountId: fallbackDebit.id,
      debitAccountCode: fallbackDebit.accountCode,
      creditAccountId: fallbackCredit.id,
      creditAccountCode: fallbackCredit.accountCode,
      vatAccountId: vatAcc?.id,
      vatAccountCode: vatAcc?.accountCode,
    };
  }

  async getAllRules(): Promise<ErpExpenseAccountRule[]> {
    return this.ruleRepo.find({
      order: { categoryKey: 'ASC', accrualMode: 'ASC' },
    });
  }

  async updateRule(
    id: string,
    data: Partial<ErpExpenseAccountRule>,
  ): Promise<ErpExpenseAccountRule> {
    const existing = await this.ruleRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Expense account rule ${id} not found`);
    }
    Object.assign(existing, data);
    return this.ruleRepo.save(existing);
  }
}
