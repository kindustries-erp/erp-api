import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ErpChartOfAccount } from '../journal-entries/entities/erp_chart_of_account.entity';
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from './dto/update-chart-of-account.dto';

export interface ChartOfAccountsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
}

@Injectable()
export class ChartOfAccountsService {
  constructor(
    @InjectRepository(ErpChartOfAccount)
    private readonly repo: Repository<ErpChartOfAccount>,
  ) {}

  async create(dto: CreateChartOfAccountDto): Promise<ErpChartOfAccount> {
    const exists = await this.repo.findOne({
      where: { accountCode: dto.account_code },
    });
    if (exists) {
      throw new ConflictException(
        `Số hiệu tài khoản "${dto.account_code}" đã tồn tại`,
      );
    }

    if (dto.parent_account_id) {
      const parent = await this.repo.findOne({
        where: { id: dto.parent_account_id },
      });
      if (!parent) {
        throw new NotFoundException('Tài khoản cha không tồn tại');
      }
    }

    const entity = this.repo.create({
      accountCode: dto.account_code,
      accountName: dto.account_name,
      accountType: dto.account_type,
      normalBalance: dto.normal_balance,
      parentAccountId: dto.parent_account_id ?? null,
      level: dto.level ?? 1,
      isCashAccount: dto.is_cash_account ?? false,
      isReceivableAccount: dto.is_receivable_account ?? false,
      isPayableAccount: dto.is_payable_account ?? false,
      description: dto.note ?? null,
      isActive: dto.is_active ?? true,
    });

    const saved = await this.repo.save(entity);
    return saved;
  }

  async findAll(query: ChartOfAccountsQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 500);
    const skip = (page - 1) * pageSize;

    const where: any = { isActive: true };
    if (query.search) {
      // search by code or name
      return this.findAllWithSearch(query.search, page, pageSize, skip);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { accountCode: 'ASC' },
      skip,
      take: pageSize,
    });

    return {
      items: items.map(this.toResponse),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async findAllWithSearch(
    search: string,
    page: number,
    pageSize: number,
    skip: number,
  ) {
    const [byCode, totalByCode] = await this.repo.findAndCount({
      where: { isActive: true, accountCode: ILike(`%${search}%`) },
      order: { accountCode: 'ASC' },
      skip,
      take: pageSize,
    });

    if (totalByCode > 0) {
      return {
        items: byCode.map(this.toResponse),
        total: totalByCode,
        page,
        pageSize,
        totalPages: Math.ceil(totalByCode / pageSize),
      };
    }

    const [byName, totalByName] = await this.repo.findAndCount({
      where: { isActive: true, accountName: ILike(`%${search}%`) },
      order: { accountCode: 'ASC' },
      skip,
      take: pageSize,
    });

    return {
      items: byName.map(this.toResponse),
      total: totalByName,
      page,
      pageSize,
      totalPages: Math.ceil(totalByName / pageSize),
    };
  }

  async findOne(id: string): Promise<ErpChartOfAccount> {
    const account = await this.repo.findOne({ where: { id } });
    if (!account)
      throw new NotFoundException('Tài khoản kế toán không tồn tại');
    return account;
  }

  async update(
    id: string,
    dto: UpdateChartOfAccountDto,
  ): Promise<ErpChartOfAccount> {
    const account = await this.findOne(id);

    if (dto.account_code && dto.account_code !== account.accountCode) {
      const existing = await this.repo.findOne({
        where: { accountCode: dto.account_code },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Số hiệu tài khoản "${dto.account_code}" đã tồn tại`,
        );
      }
    }

    if (dto.parent_account_id !== undefined) {
      if (dto.parent_account_id) {
        if (dto.parent_account_id === id) {
          throw new BadRequestException('Tài khoản cha không thể là chính nó');
        }
        const parent = await this.repo.findOne({
          where: { id: dto.parent_account_id },
        });
        if (!parent) throw new NotFoundException('Tài khoản cha không tồn tại');
        account.parentAccountId = dto.parent_account_id;
      } else {
        account.parentAccountId = null;
      }
    }

    if (dto.account_code !== undefined) account.accountCode = dto.account_code;
    if (dto.account_name !== undefined) account.accountName = dto.account_name;
    if (dto.account_type !== undefined) account.accountType = dto.account_type;
    if (dto.normal_balance !== undefined)
      account.normalBalance = dto.normal_balance;
    if (dto.level !== undefined) account.level = dto.level;
    if (dto.is_cash_account !== undefined)
      account.isCashAccount = dto.is_cash_account;
    if (dto.is_receivable_account !== undefined)
      account.isReceivableAccount = dto.is_receivable_account;
    if (dto.is_payable_account !== undefined)
      account.isPayableAccount = dto.is_payable_account;
    if (dto.is_active !== undefined) account.isActive = dto.is_active;
    if (dto.note !== undefined) account.description = dto.note ?? null;

    return this.repo.save(account);
  }

  async remove(id: string): Promise<{ message: string }> {
    const account = await this.findOne(id);
    // Soft delete (mark inactive)
    account.isActive = false;
    await this.repo.save(account);
    return { message: 'Đã ẩn tài khoản kế toán' };
  }

  /** Lookup danh sách flat cho combobox (tối đa 500) */
  async findForLookup(search?: string) {
    const where: any = { isActive: true };
    if (search) {
      return this.findForLookupWithSearch(search);
    }
    const items = await this.repo.find({
      where,
      order: { accountCode: 'ASC' },
      take: 500,
    });
    return { items: items.map(this.toResponse) };
  }

  private async findForLookupWithSearch(search: string) {
    const byCode = await this.repo.find({
      where: { isActive: true, accountCode: ILike(`%${search}%`) },
      order: { accountCode: 'ASC' },
      take: 100,
    });
    if (byCode.length > 0) return { items: byCode.map(this.toResponse) };

    const byName = await this.repo.find({
      where: { isActive: true, accountName: ILike(`%${search}%`) },
      order: { accountCode: 'ASC' },
      take: 100,
    });
    return { items: byName.map(this.toResponse) };
  }

  private readonly toResponse = (a: ErpChartOfAccount) => ({
    id: a.id,
    account_code: a.accountCode,
    account_name: a.accountName,
    account_type: a.accountType,
    normal_balance: a.normalBalance,
    parent_account_id: a.parentAccountId,
    level: a.level,
    is_cash_account: a.isCashAccount,
    is_receivable_account: a.isReceivableAccount,
    is_payable_account: a.isPayableAccount,
    description: a.description,
    is_active: a.isActive,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  });
}
