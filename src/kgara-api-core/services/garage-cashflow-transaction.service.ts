import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCase } from '../entities/kgara_case.entity';
import {
  CreateKgaraCashflowVoucherDto,
  UpdateKgaraCashflowVoucherDto,
} from '../dto/garage-cashflow.dto';

@Injectable()
export class GarageCashflowTransactionService {
  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    private readonly dataSource: DataSource,
  ) {}

  async createVoucher(
    dto: CreateKgaraCashflowVoucherDto,
  ): Promise<KgaraCashflowVoucher> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      const codePrefix = dto.voucherType === 'RECEIPT' ? 'PT-GARA' : 'PC-GARA';
      const dateStr = now
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '')
        .substring(2);
      const randomSeq = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      const generatedCode =
        dto.voucherCode || `${codePrefix}-${dateStr}-${randomSeq}`;

      let caseRef: KgaraCase | undefined;
      if (dto.caseId) {
        const kCase = await queryRunner.manager.findOne(KgaraCase, {
          where: { id: dto.caseId },
        });
        if (!kCase) {
          throw new NotFoundException(`Case ${dto.caseId} not found`);
        }
        caseRef = kCase;
      }

      const newVoucher = queryRunner.manager.create(KgaraCashflowVoucher, {
        voucherCode: generatedCode,
        voucherType: dto.voucherType,
        amount: dto.amount,
        transDate: dto.transDate || now.toISOString().slice(0, 10),
        caseId: dto.caseId || undefined,
        erpBankTransactionId: dto.erpBankTransactionId || undefined,
        erpCashVoucherId: dto.erpCashVoucherId || undefined,
        note: dto.note || undefined,
      });

      const savedVoucher = await queryRunner.manager.save(newVoucher);

      if (dto.caseId) {
        let paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER' = 'CASH';
        if (dto.paymentMethod === 'Chuyển khoản')
          paymentMethod = 'BANK_TRANSFER';
        else if (dto.paymentMethod === 'Tiền mặt') paymentMethod = 'CASH';
        else if (
          dto.paymentMethod === 'Quẹt thẻ' ||
          dto.paymentMethod === 'Thẻ'
        )
          paymentMethod = 'POS';
        else if (dto.paymentMethod) paymentMethod = 'OTHER';

        const newSettlement = queryRunner.manager.create(KgaraCaseSettlement, {
          caseId: dto.caseId || undefined,
          settlementType: dto.voucherType,
          amount: dto.amount,
          transDate: dto.transDate || now.toISOString().slice(0, 10),
          bankTransactionId: dto.erpBankTransactionId || undefined,
          cashflowVoucherId: savedVoucher.id,
          sourceChannel: 'ON_SYSTEM',
          paymentMethod,
          payerType: 'KH',
          note: dto.note || undefined,
          partnerName: dto.partnerName || caseRef?.khachHangName || undefined,
        });
        await queryRunner.manager.save(newSettlement);
      }

      await queryRunner.commitTransaction();
      return savedVoucher;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateVoucher(
    id: string,
    dto: UpdateKgaraCashflowVoucherDto,
  ): Promise<KgaraCashflowVoucher> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingVoucher = await queryRunner.manager.findOne(
        KgaraCashflowVoucher,
        { where: { id } },
      );
      if (!existingVoucher) {
        throw new NotFoundException(`Voucher ${id} not found`);
      }

      const oldCaseId = existingVoucher.caseId;
      const newCaseId = dto.caseId !== undefined ? dto.caseId : oldCaseId;
      const oldAmount = existingVoucher.amount;
      const newAmount = dto.amount !== undefined ? dto.amount : oldAmount;
      const oldTransDate = existingVoucher.transDate;
      const newTransDate =
        dto.transDate !== undefined ? dto.transDate : oldTransDate;
      const oldType = existingVoucher.voucherType;
      const newType = dto.voucherType !== undefined ? dto.voucherType : oldType;

      queryRunner.manager.merge(KgaraCashflowVoucher, existingVoucher, dto);
      const updatedVoucher = await queryRunner.manager.save(existingVoucher);

      const existingSettlement = await queryRunner.manager.findOne(
        KgaraCaseSettlement,
        {
          where: { cashflowVoucherId: id },
        },
      );

      if (existingSettlement) {
        if (newCaseId === null && oldCaseId) {
          await queryRunner.manager.remove(existingSettlement);
        } else {
          existingSettlement.caseId = newCaseId || undefined;
          existingSettlement.amount = newAmount;
          existingSettlement.transDate = newTransDate;
          existingSettlement.settlementType = newType;
          if (dto.note !== undefined) existingSettlement.note = dto.note;
          if (dto.erpBankTransactionId !== undefined)
            existingSettlement.bankTransactionId = dto.erpBankTransactionId;

          if (dto.paymentMethod !== undefined) {
            let pm: 'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER' = 'CASH';
            if (dto.paymentMethod === 'Chuyển khoản') pm = 'BANK_TRANSFER';
            else if (dto.paymentMethod === 'Tiền mặt') pm = 'CASH';
            else if (
              dto.paymentMethod === 'Quẹt thẻ' ||
              dto.paymentMethod === 'Thẻ'
            )
              pm = 'POS';
            else if (dto.paymentMethod) pm = 'OTHER';
            existingSettlement.paymentMethod = pm;
          }
          if (dto.partnerName !== undefined) {
            existingSettlement.partnerName = dto.partnerName;
          }
          await queryRunner.manager.save(existingSettlement);
        }
      } else if (newCaseId) {
        let partnerName: string | undefined = undefined;
        const kCase = await queryRunner.manager.findOne(KgaraCase, {
          where: { id: newCaseId },
        });
        if (kCase) partnerName = kCase.khachHangName || undefined;

        let paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'POS' | 'OTHER' = 'CASH';
        if (dto.paymentMethod === 'Chuyển khoản')
          paymentMethod = 'BANK_TRANSFER';
        else if (dto.paymentMethod === 'Tiền mặt') paymentMethod = 'CASH';
        else if (
          dto.paymentMethod === 'Quẹt thẻ' ||
          dto.paymentMethod === 'Thẻ'
        )
          paymentMethod = 'POS';
        else if (dto.paymentMethod) paymentMethod = 'OTHER';

        const newSettlement = queryRunner.manager.create(KgaraCaseSettlement, {
          caseId: newCaseId,
          settlementType: newType,
          amount: newAmount,
          transDate: newTransDate || undefined,
          bankTransactionId: updatedVoucher.erpBankTransactionId || undefined,
          cashflowVoucherId: updatedVoucher.id,
          sourceChannel: 'ON_SYSTEM',
          paymentMethod,
          payerType: 'KH',
          note: updatedVoucher.note || undefined,
          partnerName: dto.partnerName || partnerName,
        });
        await queryRunner.manager.save(newSettlement);
      }

      await queryRunner.commitTransaction();
      return updatedVoucher;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteVoucher(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingVoucher = await queryRunner.manager.findOne(
        KgaraCashflowVoucher,
        { where: { id } },
      );
      if (!existingVoucher) {
        throw new NotFoundException(`Voucher ${id} not found`);
      }

      const existingSettlement = await queryRunner.manager.findOne(
        KgaraCaseSettlement,
        {
          where: { cashflowVoucherId: id },
        },
      );

      if (existingSettlement) {
        await queryRunner.manager.remove(existingSettlement);
      }

      await queryRunner.manager.remove(existingVoucher);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
