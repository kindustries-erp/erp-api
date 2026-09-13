import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { GwSyncStatus } from '../entities/kgara_sync_run.entity';
import { KgaraClientService } from '../kgara-client.service';
import { SyncRunLoggerService } from './sync-run-logger.service';
import { SyncDeletionService } from './sync-deletion.service';
import { SyncGrossProfitService } from './sync-gross-profit.service';
import {
  parseSafeDate,
  extractNetPayableAmount,
} from '../utils/kgara-parser.util';

@Injectable()
export class SyncCaseService {
  private readonly logger = new Logger(SyncCaseService.name);

  constructor(
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseService)
    private readonly caseServiceRepo: Repository<KgaraCaseService>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfitRepo: Repository<KgaraGrossProfit>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    private readonly client: KgaraClientService,
    private readonly syncRunLogger: SyncRunLoggerService,
    private readonly syncDeletion: SyncDeletionService,
    private readonly syncGrossProfit: SyncGrossProfitService,
  ) {}

  async syncBranches(): Promise<void> {
    this.logger.log('Syncing Kgara branches...');
    const run = await this.syncRunLogger.createSyncRun(
      null,
      '/api/v1/donvi/list',
      {},
      0,
    );
    try {
      const branches = await this.client.getBranches();
      for (const b of branches) {
        let branch = await this.branchRepo.findOne({
          where: { externalId: b.DonViID },
        });
        if (!branch) {
          branch = new KgaraBranch();
          branch.externalId = b.DonViID;
        }
        branch.code = b.MaSo;
        branch.name = b.TenDonVi;
        branch.parentId = b.ParentID || null;
        await this.branchRepo.save(branch);
      }
      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        branches.length,
        undefined,
        200,
      );
      this.logger.log('Finished syncing branches.');
    } catch (error: any) {
      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        0,
        error.message,
      );
      throw error;
    }
  }

  async syncCasesForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    this.logger.log(`Syncing cases for branch ${branchExternalId}...`);
    let page = 1;
    let totalPages = 1;
    let totalRows = 0;

    const run = await this.syncRunLogger.createSyncRun(
      branchExternalId,
      '/api/v1/gr/cases/list',
      { from, to, updatedSince },
      200,
    );

    try {
      const updatedCaseDates = new Set<string>();
      const syncedIds = new Set<string>();
      do {
        const response = await this.client.getCases(
          branchExternalId,
          from,
          to,
          updatedSince,
          page,
          200,
        );
        const cases = response?.data || [];
        totalPages = response?.pagination?.totalPages || 1;
        const dataAsOf = response?.dataAsOf;

        for (const c of cases) {
          let gwCase = await this.caseRepo.findOne({
            where: { hdPhieuDichVuId: c.HdPhieuDichVuID },
          });
          if (!gwCase) {
            gwCase = new KgaraCase();
            gwCase.hdPhieuDichVuId = c.HdPhieuDichVuID;
          }

          syncedIds.add(c.HdPhieuDichVuID);

          // State transitions handling
          const previousStatus = gwCase.tinhTrangDichVu;
          const newStatus = c.TinhTrangDichVu;

          // Typed mappings - ERP fields are explicitly omitted (not overwritten)
          const netPayable = extractNetPayableAmount(c);
          gwCase.soChungTu = c.SoChungTu;
          gwCase.bienSoXe = c.BienSoXe;
          gwCase.khachHangCode = c.KhachHangCode;
          gwCase.khachHangName = c.KhachHangName || c.TenKhachHang;
          gwCase.tinhTrangDichVu = newStatus;
          gwCase.tenTinhTrangDichVu = c.TenTinhTrangDichVu;
          gwCase.tienCoThue = netPayable;
          gwCase.tienDaThanhToan = c.TienDaThanhToan;
          gwCase.tienConPhaiThanhToan = Math.max(
            0,
            netPayable - Number(c.TienDaThanhToan || 0),
          );

          if (gwCase.id) {
            const existingSettlements = await this.settlementRepo.find({
              where: { caseId: gwCase.id },
            });
            if (existingSettlements?.length > 0) {
              const totalReceipts = existingSettlements
                .filter((s) => s.settlementType === 'RECEIPT')
                .reduce((sum, s) => sum + Number(s.amount || 0), 0);
              gwCase.tienDaThanhToan = totalReceipts;
              gwCase.tienConPhaiThanhToan = Math.max(
                0,
                netPayable - totalReceipts,
              );
            }
          }

          if (newStatus === 9) {
            // Cancelled: Clear gross profit
            gwCase.doanhThu = 0;
            gwCase.chiPhi = 0;
            gwCase.loiNhuan = 0;
            await this.grossProfitRepo.delete({
              hdPhieuDichVuId: c.HdPhieuDichVuID,
            });

            if (gwCase.id) {
              const hasInvoices = await this.linkedInvoiceRepo.count({
                where: { caseDbId: gwCase.id },
              });
              const hasSettlements = await this.settlementRepo.count({
                where: { caseId: gwCase.id },
              });
              if (hasInvoices > 0 || hasSettlements > 0) {
                this.logger.warn(
                  `ALERT: Cancelled case ${gwCase.soChungTu || gwCase.hdPhieuDichVuId} has active linked invoices (${hasInvoices}) or settlements (${hasSettlements})!`,
                );
              }
            }
          } else if (previousStatus === 3 && newStatus !== 3) {
            // Reverted from Completed (3) to In-progress: Reset GP
            gwCase.doanhThu = null;
            gwCase.chiPhi = null;
            gwCase.loiNhuan = null;
            await this.grossProfitRepo.delete({
              hdPhieuDichVuId: c.HdPhieuDichVuID,
            });
            this.logger.log(
              `Case ${gwCase.soChungTu || gwCase.hdPhieuDichVuId} reverted from Completed (3) to In-Progress (${newStatus}). Gross profit reset.`,
            );
          } else if (newStatus === 3) {
            // Only completed status has Gross Profit
            if (c.DoanhThu !== undefined) gwCase.doanhThu = c.DoanhThu;
            if (c.ChiPhi !== undefined) gwCase.chiPhi = c.ChiPhi;
            if (c.LoiNhuan !== undefined) gwCase.loiNhuan = c.LoiNhuan;
          } else {
            // Non-completed status: Do not retain gross profit
            gwCase.doanhThu = null;
            gwCase.chiPhi = null;
            gwCase.loiNhuan = null;
          }
          gwCase.ngayPhatSinh =
            parseSafeDate(c.NgayPhatSinhFull) || parseSafeDate(c.NgayPhatSinh);
          gwCase.ngayTiepNhan = parseSafeDate(c.NgayTiepNhan);
          gwCase.ngayHoanThanhCongViec = parseSafeDate(c.NgayHoanThanhCongViec);
          gwCase.ngayGiaoXeFull = parseSafeDate(c.NgayGiaoXeFull);
          gwCase.soKhung = c.SoKhung;
          gwCase.dataAsOf = parseSafeDate(dataAsOf);

          const caseDate =
            gwCase.ngayHoanThanhCongViec ||
            gwCase.ngayPhatSinh ||
            gwCase.ngayTiepNhan;
          if (caseDate && !isNaN(caseDate.getTime())) {
            updatedCaseDates.add(caseDate.toISOString());
          }

          gwCase.branchExternalId = branchExternalId;
          gwCase.rawData = c;

          // Restore case if it was previously soft-deleted
          if (gwCase.kgaraDeletedAt) {
            gwCase.kgaraDeletedAt = null;
            gwCase.kgaraDeleteCount = 0;
            this.logger.log(
              `Case ${gwCase.hdPhieuDichVuId} was restored from soft-delete.`,
            );
          }

          await this.caseRepo.save(gwCase);
          totalRows++;
        }
        page++;
      } while (page <= totalPages);

      // Sync gross profit details to map financial data to cases
      try {
        const dateRangesToSync: { from: string; to: string }[] = [];

        const parsedFrom = parseSafeDate(from);
        const parsedTo = parseSafeDate(to);

        if (parsedFrom && parsedTo) {
          dateRangesToSync.push({
            from: parsedFrom.toISOString().split('T')[0],
            to: parsedTo.toISOString().split('T')[0],
          });
        } else {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

          dateRangesToSync.push({
            from: firstDay.toLocaleDateString('en-CA'),
            to: lastDay.toLocaleDateString('en-CA'),
          });

          const monthsToSync = new Set<string>();
          for (const isoStr of updatedCaseDates) {
            const d = parseSafeDate(isoStr);
            if (d && (d < firstDay || d > lastDay)) {
              monthsToSync.add(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
              );
            }
          }

          for (const yyyyMm of monthsToSync) {
            const [y, m] = yyyyMm.split('-');
            const fd = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
              'en-CA',
            );
            const ld = new Date(Number(y), Number(m), 0).toLocaleDateString(
              'en-CA',
            );
            dateRangesToSync.push({ from: fd, to: ld });
          }
        }

        for (const range of dateRangesToSync) {
          const profitResponse = await this.client.getGrossProfitDetail(
            branchExternalId,
            range.from,
            range.to,
          );

          const groups =
            profitResponse?.results?.Groups || profitResponse?.Groups;
          if (groups) {
            for (const group of groups) {
              if (group.Items) {
                for (const item of group.Items) {
                  if (item.VuViecID) {
                    await this.grossProfitRepo.upsert(
                      {
                        hdPhieuDichVuId: item.VuViecID,
                        branchExternalId,
                        vuViecCode: item.VuViecCode,
                        vuViecName: item.VuViecName,
                        tenKhachHang: item.TenKhachHang,
                        doanhThu: item.DoanhThu,
                        chiPhi: item.ChiPhi,
                        loiNhuan: item.LoiNhuan,
                        reportFrom: range.from,
                        reportTo: range.to,
                        rawData: item,
                      },
                      ['hdPhieuDichVuId'],
                    );
                  }
                }
              }
            }
          }
          this.logger.log(
            `Synced gross profit for branch ${branchExternalId} from ${range.from} to ${range.to}`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed to sync gross profit: ${err.message}`);
      }

      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        totalRows,
        undefined,
        200,
      );
      this.logger.log(`Finished syncing cases for branch ${branchExternalId}.`);

      // 4. Soft-delete detection if full range was provided
      let deletionResult: {
        deletedCount: number;
        withLinkedInvoices: string[];
      } = {
        deletedCount: 0,
        withLinkedInvoices: [],
      };
      if (from && to) {
        deletionResult = await this.syncDeletion.detectAndMarkDeletedCases(
          branchExternalId,
          from,
          to,
          syncedIds,
        );
      }

      return deletionResult;
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

  async syncCaseDetail(branchExternalId: string, caseId: string): Promise<any> {
    this.logger.log(`Syncing detail for case ${caseId}...`);

    // Resolve targetCaseId and effectiveBranchId if an ERP internal UUID or soChungTu was passed
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        caseId,
      );
    let gwCase = await this.caseRepo.findOne({
      where: [
        { hdPhieuDichVuId: caseId },
        ...(isUuid ? [{ id: caseId }] : []),
        { soChungTu: caseId },
      ],
    });

    const targetCaseId = gwCase?.hdPhieuDichVuId || caseId;
    const effectiveBranchId =
      branchExternalId || gwCase?.branchExternalId || '';

    const run = await this.syncRunLogger.createSyncRun(
      effectiveBranchId,
      `/api/v1/gr/cases/detail/${targetCaseId}`,
      {},
      1,
    );

    try {
      const response = await this.client.getCaseDetail(
        targetCaseId,
        effectiveBranchId,
      );
      const caseData = response?.data;
      if (!caseData) {
        throw new Error(`Case ${targetCaseId} detail not found on Kgara`);
      }

      // Update case if exists
      if (!gwCase) {
        gwCase = await this.caseRepo.findOne({
          where: { hdPhieuDichVuId: targetCaseId },
        });
      }
      if (!gwCase) {
        gwCase = new KgaraCase();
        gwCase.hdPhieuDichVuId = targetCaseId;
        gwCase.branchExternalId = effectiveBranchId;
      }

      // State transitions handling
      const previousStatus = gwCase.tinhTrangDichVu;
      const newStatus = caseData.TinhTrangDichVu;

      // Selective mappings
      const netPayable = extractNetPayableAmount(caseData);
      gwCase.soChungTu = caseData.SoChungTu;
      gwCase.bienSoXe = caseData.BienSoXe;
      gwCase.khachHangCode = caseData.KhachHangCode;
      gwCase.khachHangName = caseData.KhachHangName || caseData.TenKhachHang;
      gwCase.tinhTrangDichVu = newStatus;
      gwCase.tenTinhTrangDichVu = caseData.TenTinhTrangDichVu;
      gwCase.tienCoThue = netPayable;
      gwCase.tienDaThanhToan = caseData.TienDaThanhToan;
      gwCase.tienConPhaiThanhToan = Math.max(
        0,
        netPayable - Number(caseData.TienDaThanhToan || 0),
      );

      if (gwCase.id) {
        const existingSettlements = await this.settlementRepo.find({
          where: { caseId: gwCase.id },
        });
        if (existingSettlements?.length > 0) {
          const totalReceipts = existingSettlements
            .filter((s) => s.settlementType === 'RECEIPT')
            .reduce((sum, s) => sum + Number(s.amount || 0), 0);
          gwCase.tienDaThanhToan = totalReceipts;
          gwCase.tienConPhaiThanhToan = Math.max(0, netPayable - totalReceipts);
        }
      }

      if (newStatus === 9) {
        // Cancelled: Clear gross profit
        gwCase.doanhThu = 0;
        gwCase.chiPhi = 0;
        gwCase.loiNhuan = 0;
        await this.grossProfitRepo.delete({ hdPhieuDichVuId: targetCaseId });

        if (gwCase.id) {
          const hasInvoices = await this.linkedInvoiceRepo.count({
            where: { caseDbId: gwCase.id },
          });
          const hasSettlements = await this.settlementRepo.count({
            where: { caseId: gwCase.id },
          });
          if (hasInvoices > 0 || hasSettlements > 0) {
            this.logger.warn(
              `ALERT: Cancelled case ${gwCase.soChungTu || gwCase.hdPhieuDichVuId} has active linked invoices (${hasInvoices}) or settlements (${hasSettlements})!`,
            );
          }
        }
      } else if (previousStatus === 3 && newStatus !== 3) {
        // Reverted from Completed (3) to In-progress: Reset GP
        gwCase.doanhThu = null;
        gwCase.chiPhi = null;
        gwCase.loiNhuan = null;
        await this.grossProfitRepo.delete({ hdPhieuDichVuId: targetCaseId });
        this.logger.log(
          `Case ${gwCase.soChungTu || gwCase.hdPhieuDichVuId} reverted from Completed (3) to In-Progress (${newStatus}). Gross profit reset.`,
        );
      } else if (newStatus === 3) {
        // Only completed status has Gross Profit
        if (caseData.DoanhThu !== undefined)
          gwCase.doanhThu = caseData.DoanhThu;
        if (caseData.ChiPhi !== undefined) gwCase.chiPhi = caseData.ChiPhi;
        if (caseData.LoiNhuan !== undefined)
          gwCase.loiNhuan = caseData.LoiNhuan;
      } else {
        // Non-completed status: Do not retain gross profit
        gwCase.doanhThu = null;
        gwCase.chiPhi = null;
        gwCase.loiNhuan = null;
      }
      gwCase.ngayPhatSinh =
        parseSafeDate(caseData.NgayPhatSinhFull) ||
        parseSafeDate(caseData.NgayPhatSinh);
      gwCase.ngayTiepNhan = parseSafeDate(caseData.NgayTiepNhan);
      gwCase.ngayHoanThanhCongViec = parseSafeDate(
        caseData.NgayHoanThanhCongViec,
      );
      gwCase.ngayGiaoXeFull = parseSafeDate(caseData.NgayGiaoXeFull);
      gwCase.soKhung = caseData.SoKhung;
      gwCase.dataAsOf = parseSafeDate(response.dataAsOf);
      gwCase.rawData = caseData;

      // Restore case if it was previously soft-deleted
      if (gwCase.kgaraDeletedAt) {
        gwCase.kgaraDeletedAt = null;
        gwCase.kgaraDeleteCount = 0;
        this.logger.log(`Case ${targetCaseId} was restored from soft-delete.`);
      }

      await this.caseRepo.save(gwCase);

      // Sync Case Services (Lines)
      let linesCount = 0;
      if (
        caseData.ListPhieuDichVuChiTiet &&
        Array.isArray(caseData.ListPhieuDichVuChiTiet)
      ) {
        for (const s of caseData.ListPhieuDichVuChiTiet) {
          let srv = await this.caseServiceRepo.findOne({
            where: { hdPhieuDichVuChiTietId: s.HdPhieuDichVuChiTietID },
          });
          if (!srv) {
            srv = new KgaraCaseService();
            srv.hdPhieuDichVuChiTietId = s.HdPhieuDichVuChiTietID;
            srv.hdPhieuDichVuId = targetCaseId;
          }

          srv.noiDungChiTiet = s.NoiDungChiTiet;
          srv.sanPhamCode = s.SanPhamCode;
          srv.sanPhamName = s.SanPhamName;
          srv.loaiSanPhamCode = s.LoaiSanPhamCode;
          srv.donViTinhText = s.DonViTinhText;
          srv.soLuongHoaDon = s.SoLuongHoaDon;
          srv.donGia = s.DonGia;
          srv.tienChuaThue = s.TienChuaThue;
          srv.thueSuat = s.ThueSuat;
          srv.tienCoThue = s.TienCoThue;
          srv.soGioCongLam = s.SoGioCongLam;
          srv.tienDichVu = s.TienDichVu;
          srv.tienPhuTung = s.TienPhuTung;
          srv.giaVonPhuTung = s.GiaVonPhuTung;
          srv.tyLeChietKhauCt = s.TyLeChietKhauCt || s.TyLeChietKhauCT;
          srv.tienChietKhauCt = s.TienChietKhauCt || s.TienChietKhauCT;
          srv.khoCode = s.KhoCode;
          srv.tienPhuPhi = s.TienPhuPhi;

          srv.rawData = s;
          await this.caseServiceRepo.save(srv);
          linesCount++;
        }
      }

      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        1 + linesCount,
        undefined,
        200,
      );
      this.logger.log(`Finished syncing case detail for case ${targetCaseId}.`);
      return caseData;
    } catch (error: any) {
      await this.syncRunLogger.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        0,
        error.message,
      );
      throw error;
    }
  }
}
