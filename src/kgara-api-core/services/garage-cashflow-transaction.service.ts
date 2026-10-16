import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCase } from '../entities/kgara_case.entity';
import { AuditCoreService } from '../../audit-core/audit-core.service';
import {
  CreateKgaraCashflowVoucherDto,
  UpdateKgaraCashflowVoucherDto,
  KgaraCashflowVoucherResponseDto,
  toKgaraCashflowVoucherResponse,
} from '../dto/garage-cashflow.dto';
import { extractNetPayableAmount } from '../utils/kgara-parser.util';

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
    @Optional()
    private readonly auditCoreService?: AuditCoreService,
  ) {}

  async createVoucher(
    dto: CreateKgaraCashflowVoucherDto,
    user?: { sub?: string; email?: string },
  ): Promise<KgaraCashflowVoucherResponseDto> {
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

      const paymentStatus: 'PENDING' | 'APPROVED' | 'PAID' | null =
        dto.voucherType === 'PAYMENT' ? dto.paymentStatus || 'PENDING' : null;

      const newVoucher = queryRunner.manager.create(KgaraCashflowVoucher, {
        voucherCode: generatedCode,
        voucherType: dto.voucherType,
        paymentStatus,
        amount: dto.amount,
        transDate: dto.transDate || now.toISOString().slice(0, 10),
        caseId: dto.caseId || undefined,
        licensePlate: dto.licensePlate || caseRef?.bienSoXe || undefined,
        paymentMethod: dto.paymentMethod || undefined,
        paymentContent: dto.paymentContent || undefined,
        partnerName: dto.partnerName || caseRef?.khachHangName || undefined,
        erpBankTransactionId: dto.erpBankTransactionId || undefined,
        erpCashVoucherId: dto.erpCashVoucherId || undefined,
        note: dto.note || undefined,
        createdBy: user?.email || user?.sub || 'Hệ thống',
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

        await this._recalculateCaseDebt(queryRunner, dto.caseId);
      }

      await queryRunner.commitTransaction();

      if (this.auditCoreService) {
        this.auditCoreService.recordAction({
          actorUserId: user?.sub || null,
          actorEmail: user?.email || null,
          actionType: 'CREATE',
          module: 'garage',
          entityType: 'garage_cashflow_voucher',
          entityId: savedVoucher.id,
          message: `Khởi tạo ${savedVoucher.voucherType === 'RECEIPT' ? 'phiếu thu' : 'phiếu chi'} ${savedVoucher.voucherCode} (${Number(savedVoucher.amount).toLocaleString('vi-VN')} đ)`,
          afterSnapshot: { ...savedVoucher },
        });
      }

      return toKgaraCashflowVoucherResponse(savedVoucher);
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
    user?: { sub?: string; email?: string },
  ): Promise<KgaraCashflowVoucherResponseDto> {
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

      const beforeSnapshot = { ...existingVoucher };
      queryRunner.manager.merge(KgaraCashflowVoucher, existingVoucher, dto);
      if (newType === 'PAYMENT') {
        if (dto.paymentStatus !== undefined) {
          existingVoucher.paymentStatus = dto.paymentStatus;
        } else if (!existingVoucher.paymentStatus) {
          existingVoucher.paymentStatus = 'PENDING';
        }
      } else {
        existingVoucher.paymentStatus = null;
      }
      if (
        newCaseId &&
        dto.licensePlate === undefined &&
        (!existingVoucher.licensePlate || oldCaseId !== newCaseId)
      ) {
        const kCase = await queryRunner.manager.findOne(KgaraCase, {
          where: { id: newCaseId },
        });
        if (kCase?.bienSoXe) existingVoucher.licensePlate = kCase.bienSoXe;
      }
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

      if (oldCaseId && oldCaseId !== newCaseId) {
        await this._recalculateCaseDebt(queryRunner, oldCaseId);
      }
      if (newCaseId) {
        await this._recalculateCaseDebt(queryRunner, newCaseId);
      }

      if (updatedVoucher.caseId) {
        const kCase = await queryRunner.manager.findOne(KgaraCase, {
          where: { id: updatedVoucher.caseId },
          select: [
            'id',
            'soChungTu',
            'bienSoXe',
            'khachHangName',
            'khachHangCode',
          ],
        });
        if (kCase) updatedVoucher.case = kCase;
      }

      await queryRunner.commitTransaction();

      if (this.auditCoreService) {
        this.auditCoreService.recordAction({
          actorUserId: user?.sub || null,
          actorEmail: user?.email || null,
          actionType: 'UPDATE',
          module: 'garage',
          entityType: 'garage_cashflow_voucher',
          entityId: updatedVoucher.id,
          message: `Cập nhật ${updatedVoucher.voucherType === 'RECEIPT' ? 'phiếu thu' : 'phiếu chi'} ${updatedVoucher.voucherCode}`,
          beforeSnapshot,
          afterSnapshot: { ...updatedVoucher },
        });
      }

      return toKgaraCashflowVoucherResponse(updatedVoucher);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteVoucher(
    id: string,
    user?: { sub?: string; email?: string },
  ): Promise<void> {
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

      if (
        existingVoucher.erpBankTransactionId ||
        existingVoucher.erpCashVoucherId
      ) {
        throw new BadRequestException(
          'Không thể xóa phiếu thu/chi đã được đồng bộ với sao kê ngân hàng hoặc sổ quỹ ERP. Vui lòng gỡ liên kết trước.',
        );
      }

      const existingSettlement = await queryRunner.manager.findOne(
        KgaraCaseSettlement,
        {
          where: { cashflowVoucherId: id },
        },
      );

      let relatedCaseId: string | undefined;
      if (existingSettlement) {
        relatedCaseId = existingSettlement.caseId;
        await queryRunner.manager.remove(existingSettlement);
      }

      await queryRunner.manager.remove(existingVoucher);

      if (relatedCaseId) {
        await this._recalculateCaseDebt(queryRunner, relatedCaseId);
      }

      await queryRunner.commitTransaction();

      if (this.auditCoreService) {
        this.auditCoreService.recordAction({
          actorUserId: user?.sub || null,
          actorEmail: user?.email || null,
          actionType: 'DELETE',
          module: 'garage',
          entityType: 'garage_cashflow_voucher',
          entityId: id,
          message: `Xóa ${existingVoucher.voucherType === 'RECEIPT' ? 'phiếu thu' : 'phiếu chi'} ${existingVoucher.voucherCode}`,
          beforeSnapshot: { ...existingVoucher },
        });
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async _recalculateCaseDebt(
    queryRunner: QueryRunner,
    caseId: string,
  ): Promise<void> {
    const kCase = await queryRunner.manager.findOne(KgaraCase, {
      where: { id: caseId },
    });
    if (!kCase) return;

    const settlements = await queryRunner.manager.find(KgaraCaseSettlement, {
      where: { caseId },
    });
    const netPayable = extractNetPayableAmount(kCase);

    if (settlements.length > 0) {
      const totalReceipts = settlements
        .filter((s) => s.settlementType === 'RECEIPT')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      kCase.tienDaThanhToan = totalReceipts;
      kCase.tienConPhaiThanhToan = Math.max(0, netPayable - totalReceipts);
    } else {
      const rawPaid = Number(kCase.rawData?.TienDaThanhToan || 0);
      kCase.tienDaThanhToan = rawPaid;
      kCase.tienConPhaiThanhToan = Math.max(0, netPayable - rawPaid);
    }
    await queryRunner.manager.save(KgaraCase, kCase);
  }
}
