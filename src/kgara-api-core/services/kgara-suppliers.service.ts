import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import {
  KgaraSuppliersDebtQueryEngine,
  GetSuppliersDebtParams,
  SupplierDebtSummary,
  FormattedSupplierDebtItem,
} from './engines/kgara-suppliers-debt-query.engine';

export type {
  GetSuppliersDebtParams,
  SupplierDebtSummary,
  FormattedSupplierDebtItem,
};

@Injectable()
export class KgaraSuppliersService {
  constructor(
    private readonly debtQueryEngine: KgaraSuppliersDebtQueryEngine,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
  ) {}

  async getSuppliersDebt(params: GetSuppliersDebtParams) {
    return this.debtQueryEngine.getSuppliersDebt(params);
  }

  async getSuppliersDebtColumnOptions(
    branchId: string,
    column: string,
    search: string = '',
    page: string | number = 1,
    pageSize: string | number = 20,
    filtersStr?: string,
  ) {
    return this.debtQueryEngine.getSuppliersDebtColumnOptions(
      branchId,
      column,
      search,
      page,
      pageSize,
      filtersStr,
    );
  }

  async getCasesBySupplier(branchId: string, supplierId: string) {
    const cases = await this.caseRepo
      .createQueryBuilder('c')
      .where('(c.khachHangCode = :id OR c.id = :id OR c.soChungTu = :id)', {
        id: supplierId,
      })
      .andWhere('c.kgaraDeletedAt IS NULL')
      .getMany();

    return {
      payables: [],
      linkedCases: cases,
    };
  }
}
