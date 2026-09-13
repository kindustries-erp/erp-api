import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraReceivable } from '../entities/kgara_receivable.entity';
import { KgaraPayable } from '../entities/kgara_payable.entity';
import { GwSyncStatus } from '../entities/kgara_sync_run.entity';
import { KgaraClientService } from '../kgara-client.service';
import { SyncRunLoggerService } from './sync-run-logger.service';
import { parseSafeDate } from '../utils/kgara-parser.util';

@Injectable()
export class SyncDebtService {
  private readonly logger = new Logger(SyncDebtService.name);

  constructor(
    @InjectRepository(KgaraReceivable)
    private readonly receivableRepo: Repository<KgaraReceivable>,
    @InjectRepository(KgaraPayable)
    private readonly payableRepo: Repository<KgaraPayable>,
    private readonly client: KgaraClientService,
    private readonly syncRunLogger: SyncRunLoggerService,
  ) {}

  async syncReceivables(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<void> {
    this.logger.log(`Syncing receivables for branch ${branchExternalId}...`);
    let page = 1;
    let totalPages = 1;
    let totalRows = 0;

    const run = await this.syncRunLogger.createSyncRun(
      branchExternalId,
      '/api/v1/gr/exports/receivables',
      { from, to, updatedSince },
      200,
    );

    try {
      do {
        const response = await this.client.getReceivables(
          branchExternalId,
          from,
          to,
          updatedSince,
          page,
          200,
        );
        const receivables = response?.data || [];
        totalPages = response?.pagination?.totalPages || 1;
        const dataAsOf = response?.dataAsOf;

        const pFrom = parseSafeDate(from) || new Date('2000-01-01');
        const pTo = parseSafeDate(to) || new Date('2099-12-31');

        for (const r of receivables) {
          let rec = await this.receivableRepo.findOne({
            where: {
              branchExternalId,
              hdPhieuDichVuId: r.HdPhieuDichVuID,
              soChungTu: r.SoChungTu || '',
              periodFrom: pFrom,
              periodTo: pTo,
            },
          });
          if (!rec) {
            rec = new KgaraReceivable();
            rec.branchExternalId = branchExternalId;
            rec.hdPhieuDichVuId = r.HdPhieuDichVuID;
            rec.soChungTu = r.SoChungTu || '';
            rec.periodFrom = pFrom;
            rec.periodTo = pTo;
          }
          rec.khachHangCode = r.KhachHangCode;
          rec.khachHangName = r.KhachHangName || r.TenKhachHang;
          rec.bienSoXe = r.BienSoXe;
          rec.soKhung = r.SoKhung;
          rec.tienThanhToan = r.TienThanhToan;
          rec.tienDaThanhToan = r.TienDaThanhToan;
          rec.ngayPhatSinh = parseSafeDate(r.NgayPhatSinh);
          rec.dataAsOf = parseSafeDate(dataAsOf);
          rec.rawData = r;

          await this.receivableRepo.save(rec);
          totalRows++;
        }
        page++;
      } while (page <= totalPages);

      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        totalRows,
        undefined,
        200,
      );
      this.logger.log(
        `Finished syncing receivables for branch ${branchExternalId}.`,
      );
    } catch (error: any) {
      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        totalRows,
        error.message,
      );
      throw error;
    }
  }

  async syncPayables(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<void> {
    this.logger.log(`Syncing payables for branch ${branchExternalId}...`);
    let page = 1;
    let totalPages = 1;
    let totalRows = 0;

    const run = await this.syncRunLogger.createSyncRun(
      branchExternalId,
      '/api/v1/gr/exports/payables',
      { from, to, updatedSince },
      200,
    );

    try {
      do {
        const response = await this.client.getPayables(
          branchExternalId,
          from,
          to,
          updatedSince,
          page,
          200,
        );
        // V2 Payables uses extra 'results' wrapper
        const payables = response?.results?.data || [];
        totalPages = response?.results?.pagination?.totalPages || 1;
        const dataAsOf = response?.dataAsOf;

        const pFrom = parseSafeDate(from) || new Date('2000-01-01');
        const pTo = parseSafeDate(to) || new Date('2099-12-31');

        for (const p of payables) {
          let pay = await this.payableRepo.findOne({
            where: {
              branchExternalId,
              taiKhoanId: p.TaiKhoanID,
              doiTacId: p.DoiTacID,
              maSoTienTe: p.MaSoTienTe || 'VND',
              maSoVuViec: p.MaSoVuViec || '',
              periodFrom: pFrom,
              periodTo: pTo,
            },
          });
          if (!pay) {
            pay = new KgaraPayable();
            pay.branchExternalId = branchExternalId;
            pay.taiKhoanId = p.TaiKhoanID;
            pay.doiTacId = p.DoiTacID;
            pay.maSoTienTe = p.MaSoTienTe || 'VND';
            pay.maSoVuViec = p.MaSoVuViec || '';
            pay.periodFrom = pFrom;
            pay.periodTo = pTo;
          }
          pay.maSoTaiKhoan = p.MaSoTaiKhoan;
          pay.tenTaiKhoan = p.TenTaiKhoan;
          pay.maSoDoiTac = p.MaSoDoiTac;
          pay.tenDoiTac = p.TenDoiTac;
          pay.tenTienTe = p.TenTienTe;
          pay.tenVuViec = p.TenVuViec;
          pay.ghiChuDoiTac = p.GhiChuDoiTac;
          pay.maSoNhomDoiTac = p.MaSoNhomDoiTac;
          pay.tenNhomDoiTac = p.TenNhomDoiTac;
          pay.dkNo = p.DKNo;
          pay.dkCo = p.DKCo;
          pay.psNo = p.PSNo;
          pay.psCo = p.PSCo;
          pay.ckNo = p.CKNo;
          pay.ckCo = p.CKCo;
          pay.tyGiaCk = p.TyGiaCK;
          pay.dkNTeNo = p.DKNTeNo;
          pay.dkNTeCo = p.DKNTeCo;
          pay.psNTeNo = p.PSNTeNo;
          pay.psNTeCo = p.PSNTeCo;
          pay.ckNTeNo = p.CKNTeNo;
          pay.ckNTeCo = p.CKNTeCo;
          pay.tyGiaDk = p.TyGiaDK;
          pay.tyGiaPsNo = p.TyGiaPSNo;
          pay.tyGiaPsCo = p.TyGiaPSCo;
          pay.dataAsOf = parseSafeDate(dataAsOf);
          pay.rawData = p;

          await this.payableRepo.save(pay);
          totalRows++;
        }
        page++;
      } while (page <= totalPages);

      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        totalRows,
        undefined,
        200,
      );
      this.logger.log(
        `Finished syncing payables for branch ${branchExternalId}.`,
      );
    } catch (error: any) {
      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        totalRows,
        error.message,
      );
      throw error;
    }
  }
}
