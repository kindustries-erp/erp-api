import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ErpBankAccountBalance } from '../entities/erp_bank_account_balance.entity';
import { ErpCashBookBalance } from '../entities/erp_cash_book_balance.entity';
import { ErpBankStatementFile } from '../entities/erp_bank_statement_file.entity';
import {
  CreateBankAccountBalanceDto,
  UpdateBankAccountBalanceDto,
} from '../dto/create-bank-account-balance.dto';
import {
  CreateCashBookBalanceDto,
  UpdateCashBookBalanceDto,
} from '../dto/create-cash-book-balance.dto';

@Injectable()
export class BalanceStatementLifecycleService {
  constructor(
    @InjectRepository(ErpBankAccountBalance)
    private readonly bankAccountBalanceRepo: Repository<ErpBankAccountBalance>,
    @InjectRepository(ErpCashBookBalance)
    private readonly cashBookBalanceRepo: Repository<ErpCashBookBalance>,
    @InjectRepository(ErpBankStatementFile)
    private readonly statementFileRepo: Repository<ErpBankStatementFile>,
    private readonly dataSource: DataSource,
  ) {}

  async getBankAccountBalances(bankAccountId: string) {
    return this.bankAccountBalanceRepo.find({
      where: { bankAccountId, isDeleted: false },
      order: { periodDate: 'DESC' },
    });
  }

  async createBankAccountBalance(dto: CreateBankAccountBalanceDto) {
    const balance = this.bankAccountBalanceRepo.create(dto);
    return this.bankAccountBalanceRepo.save(balance);
  }

  async updateBankAccountBalance(id: string, dto: UpdateBankAccountBalanceDto) {
    const balance = await this.bankAccountBalanceRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    Object.assign(balance, dto);
    return this.bankAccountBalanceRepo.save(balance);
  }

  async deleteBankAccountBalance(id: string) {
    const balance = await this.bankAccountBalanceRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    balance.isDeleted = true;
    return this.bankAccountBalanceRepo.save(balance);
  }

  async getCashBookBalances(cashBookId: string) {
    return this.cashBookBalanceRepo.find({
      where: { cashBookId, isDeleted: false },
      order: { periodDate: 'DESC' },
    });
  }

  async createCashBookBalance(dto: CreateCashBookBalanceDto) {
    const balance = this.cashBookBalanceRepo.create(dto);
    return this.cashBookBalanceRepo.save(balance);
  }

  async updateCashBookBalance(id: string, dto: UpdateCashBookBalanceDto) {
    const balance = await this.cashBookBalanceRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    Object.assign(balance, dto);
    return this.cashBookBalanceRepo.save(balance);
  }

  async deleteCashBookBalance(id: string) {
    const balance = await this.cashBookBalanceRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    balance.isDeleted = true;
    return this.cashBookBalanceRepo.save(balance);
  }

  async getStatementFiles(params: {
    page?: number;
    pageSize?: number;
    branchId?: string;
    bankAccountId?: string;
    cashBookId?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const qb = this.statementFileRepo
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.bankAccount', 'bankAccount')
      .leftJoinAndSelect('file.cashBook', 'cashBook')
      .where('file.isDeleted = :isDeleted', { isDeleted: false });

    if (params.branchId) {
      qb.andWhere('file.branchId = :branchId', { branchId: params.branchId });
    }
    if (params.bankAccountId) {
      qb.andWhere('file.bankAccountId = :bankAccountId', {
        bankAccountId: params.bankAccountId,
      });
    }
    if (params.cashBookId) {
      qb.andWhere('file.cashBookId = :cashBookId', {
        cashBookId: params.cashBookId,
      });
    }

    qb.orderBy('file.periodDate', 'ASC').addOrderBy('file.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    let mappedItems = items;
    if (items.length > 0) {
      const fileIds = items.map((i) => i.fileId);
      const sysFiles = await this.dataSource.query(
        `SELECT id, filename_download, filename_disk FROM sys_files WHERE id = ANY($1)`,
        [fileIds],
      );
      const sysFileMap = new Map(sysFiles.map((f: any) => [f.id, f]));

      mappedItems = items.map((item) => {
        const fileMeta = sysFileMap.get(item.fileId) as any;
        return {
          ...item,
          fileName: fileMeta
            ? fileMeta.filename_download || fileMeta.filename_disk
            : 'Unknown file',
        };
      }) as any;
    }

    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createStatementFile(
    dto: import('../dto/create-bank-statement-file.dto').CreateBankStatementFileDto,
  ) {
    if (!dto.bankAccountId && !dto.cashBookId) {
      throw new BadRequestException(
        'Must provide either bankAccountId or cashBookId',
      );
    }
    const file = this.statementFileRepo.create(dto);
    return this.statementFileRepo.save(file);
  }

  async deleteStatementFile(id: string) {
    const file = await this.statementFileRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!file) throw new NotFoundException('File not found');

    file.isDeleted = true;
    return this.statementFileRepo.save(file);
  }
}
