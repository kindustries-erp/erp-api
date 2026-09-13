import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Express } from 'express';
import * as crypto from 'crypto';
import { Brackets, Repository } from 'typeorm';
import { ErpBankAccount } from '../entities/erp_bank_account.entity';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { CreateBankTransactionDto } from '../dto/create-bank-transaction.dto';
import { parseTcbCsv, parseTcbXlsx } from '../parsers/tcb.parser';
import { parseBidvXlsx } from '../parsers/bidv.parser';
import { parseCashXlsx } from '../parsers/cash.parser';

@Injectable()
export class TransactionImportService {
  constructor(
    @InjectRepository(ErpBankAccount)
    private readonly bankAccountRepo: Repository<ErpBankAccount>,
    @InjectRepository(ErpBankTransaction)
    private readonly transactionRepo: Repository<ErpBankTransaction>,
  ) {}

  async importFiles(
    files: Express.Multer.File[],
    branchId: string,
    bankAccountId?: string,
    cashBookId?: string,
  ) {
    if (!bankAccountId && !cashBookId) {
      throw new BadRequestException(
        'Must provide either bankAccountId or cashBookId',
      );
    }

    let bankCode: string | undefined;
    let expectedAccountNumber: string | undefined;
    if (bankAccountId) {
      const bankAccount = await this.bankAccountRepo.findOne({
        where: { id: bankAccountId },
      });
      if (bankAccount) {
        bankCode = bankAccount.bankCode?.toUpperCase();
        expectedAccountNumber = bankAccount.accountNumber;
      }
    }

    let allDtos: CreateBankTransactionDto[] = [];

    for (const file of files) {
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      let dtos: CreateBankTransactionDto[] = [];

      if (ext === 'csv') {
        if (bankCode && bankCode !== 'TCB') {
          throw new BadRequestException(
            'Định dạng CSV hiện tại chỉ hỗ trợ cho sao kê TCB. Vui lòng sử dụng file excel.',
          );
        }
        dtos = parseTcbCsv(
          file.buffer,
          branchId,
          bankAccountId,
          cashBookId,
          expectedAccountNumber,
        );
      } else if (ext === 'xlsx') {
        if (cashBookId) {
          dtos = await parseCashXlsx(
            file.buffer,
            branchId,
            bankAccountId,
            cashBookId,
          );
        } else {
          const isTcb =
            bankCode === 'TCB' ||
            (!bankCode && file.originalname.toLowerCase().includes('tcb'));

          if (isTcb) {
            dtos = await parseTcbXlsx(
              file.buffer,
              branchId,
              bankAccountId,
              cashBookId,
              expectedAccountNumber,
            );
          } else {
            dtos = await parseBidvXlsx(
              file.buffer,
              branchId,
              bankAccountId,
              cashBookId,
              expectedAccountNumber,
            );
          }
        }
      } else {
        throw new BadRequestException(
          `Unsupported file format: ${file.originalname}. Please upload .csv or .xlsx`,
        );
      }

      allDtos = [...allDtos, ...dtos];
    }

    if (allDtos.length === 0) {
      throw new BadRequestException(
        'No valid transactions found in the uploaded files',
      );
    }

    const startDate = new Date(
      Math.min(...allDtos.map((d) => new Date(d.transDate).getTime())),
    );
    const endDate = new Date(
      Math.max(...allDtos.map((d) => new Date(d.transDate).getTime())),
    );

    startDate.setDate(startDate.getDate() - 2);
    endDate.setDate(endDate.getDate() + 2);

    const referenceNumbers = allDtos
      .map((d) => d.referenceNumber)
      .filter(Boolean);

    const existingQb = this.transactionRepo
      .createQueryBuilder('txn')
      .where('txn.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            'txn.transDate >= :startDate AND txn.transDate <= :endDate',
            {
              startDate,
              endDate,
            },
          );
          if (referenceNumbers.length > 0) {
            qb.orWhere('txn.referenceNumber IN (:...referenceNumbers)', {
              referenceNumbers,
            });
          }
        }),
      );

    if (bankAccountId) {
      existingQb.andWhere('txn.bankAccountId = :bankAccountId', {
        bankAccountId,
      });
    }
    if (cashBookId) {
      existingQb.andWhere('txn.cashBookId = :cashBookId', { cashBookId });
    }

    const existingTxns = await existingQb.getMany();

    const existingMap = new Map<string, ErpBankTransaction>();
    for (const t of existingTxns) {
      const key = t.referenceNumber
        ? `REF_${t.referenceNumber}`
        : `${new Date(t.transDate).toISOString()}_${Number(t.debitAmount || 0)}_${Number(t.creditAmount || 0)}_${(t.description || '').trim()}`;
      existingMap.set(key, t);
    }

    const newDtos: CreateBankTransactionDto[] = [];
    const updateEntities: ErpBankTransaction[] = [];
    let skippedCount = 0;

    const importBatchId = crypto.randomUUID();

    for (const d of allDtos) {
      const key = d.referenceNumber
        ? `REF_${d.referenceNumber}`
        : `${new Date(d.transDate).toISOString()}_${Number(d.debitAmount || 0)}_${Number(d.creditAmount || 0)}_${(d.description || '').trim()}`;

      const existing = existingMap.get(key);
      if (!existing) {
        newDtos.push(d);
      } else {
        let hasChanges = false;

        const dTransStr = new Date(d.transDate).toISOString();
        const eTransStr = new Date(existing.transDate).toISOString();
        if (dTransStr !== eTransStr) {
          existing.transDate = new Date(d.transDate);
          hasChanges = true;
        }

        const dEfdStr = d.efdDate ? new Date(d.efdDate).toISOString() : null;
        const eEfdStr = existing.efdDate
          ? new Date(existing.efdDate).toISOString()
          : null;
        if (dEfdStr !== eEfdStr) {
          existing.efdDate = d.efdDate ? new Date(d.efdDate) : null;
          hasChanges = true;
        }

        if (Number(existing.debitAmount) !== Number(d.debitAmount || 0)) {
          existing.debitAmount = Number(d.debitAmount || 0);
          hasChanges = true;
        }
        if (Number(existing.creditAmount) !== Number(d.creditAmount || 0)) {
          existing.creditAmount = Number(d.creditAmount || 0);
          hasChanges = true;
        }
        if (
          d.balance !== undefined &&
          Number(existing.balance) !== Number(d.balance)
        ) {
          existing.balance = Number(d.balance);
          hasChanges = true;
        }
        if (
          d.description !== undefined &&
          existing.description !== d.description
        ) {
          existing.description = d.description;
          hasChanges = true;
        }
        if (
          d.correspondentAccount !== undefined &&
          existing.correspondentAccount !== d.correspondentAccount
        ) {
          existing.correspondentAccount = d.correspondentAccount;
          hasChanges = true;
        }
        if (
          d.correspondentName !== undefined &&
          existing.correspondentName !== d.correspondentName
        ) {
          existing.correspondentName = d.correspondentName;
          hasChanges = true;
        }
        if (
          d.correspondentBank !== undefined &&
          existing.correspondentBank !== d.correspondentBank
        ) {
          existing.correspondentBank = d.correspondentBank;
          hasChanges = true;
        }
        if (d.seqNo !== undefined && existing.seqNo !== d.seqNo) {
          existing.seqNo = d.seqNo;
          hasChanges = true;
        }
        if (d.stt !== undefined && existing.stt !== d.stt) {
          existing.stt = d.stt;
          hasChanges = true;
        }

        if (hasChanges) {
          updateEntities.push(existing);
        } else {
          skippedCount++;
        }
      }
    }

    if (newDtos.length === 0 && updateEntities.length === 0) {
      throw new BadRequestException(
        'Tất cả giao dịch trong file này đã tồn tại và không có thay đổi nào trong hệ thống',
      );
    }

    const entities = newDtos.map((dto) =>
      this.transactionRepo.create({ ...dto, importBatchId }),
    );

    if (entities.length > 0) {
      await this.transactionRepo.save(entities, { chunk: 100 });
    }

    if (updateEntities.length > 0) {
      await this.transactionRepo.save(updateEntities, { chunk: 100 });
    }

    return {
      success: true,
      count: entities.length,
      updatedCount: updateEntities.length,
      skippedCount,
      importBatchId,
    };
  }

  async rollbackBatch(importBatchId: string) {
    const txns = await this.transactionRepo.find({
      where: { importBatchId, isDeleted: false },
    });
    if (txns.length === 0) {
      throw new NotFoundException('Batch not found or already rolled back');
    }

    await this.transactionRepo.update({ importBatchId }, { isDeleted: true });
    return { success: true, rolledBackCount: txns.length };
  }
}
