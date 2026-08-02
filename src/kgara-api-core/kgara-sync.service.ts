import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraCase } from './entities/kgara_case.entity';
import { KgaraClientService } from './kgara-client.service';
import { KgaraReceivable } from './entities/kgara_receivable.entity';
import { KgaraPayable } from './entities/kgara_payable.entity';
import { KgaraCaseService } from './entities/kgara_case_service.entity';
import { GwSyncRun, GwSyncStatus } from './entities/kgara_sync_run.entity';
import { KgaraGrossProfit } from './entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from './entities/kgara_case_linked_invoice.entity';

@Injectable()
export class KgaraSyncService {
  private readonly logger = new Logger(KgaraSyncService.name);

  constructor(
    @InjectRepository(KgaraBranch)
    private branchRepo: Repository<KgaraBranch>,
    @InjectRepository(KgaraCase)
    private caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraReceivable)
    private receivableRepo: Repository<KgaraReceivable>,
    @InjectRepository(KgaraPayable)
    private payableRepo: Repository<KgaraPayable>,
    @InjectRepository(KgaraCaseService)
    private caseServiceRepo: Repository<KgaraCaseService>,
    @InjectRepository(GwSyncRun)
    private syncRunRepo: Repository<GwSyncRun>,
    @InjectRepository(KgaraGrossProfit)
    private grossProfitRepo: Repository<KgaraGrossProfit>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
    private client: KgaraClientService,
  ) {}

  private async createSyncRun(
    branchId: string | null,
    endpoint: string,
    queryParams: any,
    pageSize: number,
  ): Promise<GwSyncRun> {
    const run = new GwSyncRun();
    run.branchExternalId = branchId;
    run.endpoint = endpoint;
    run.queryParams = queryParams;
    run.pageSize = pageSize;
    run.requestStartedAt = new Date();
    return this.syncRunRepo.save(run);
  }

  private async closeSyncRun(
    run: GwSyncRun,
    status: GwSyncStatus,
    rowCount: number,
    errorMsg?: string,
    responseStatus?: number,
    dataAsOf?: string,
  ) {
    run.requestEndedAt = new Date();
    run.status = status;
    run.rowCount = rowCount;
    if (errorMsg) run.errorMessage = errorMsg;
    if (responseStatus) run.responseStatus = responseStatus;
    if (dataAsOf) run.dataAsOf = new Date(dataAsOf);
    await this.syncRunRepo.save(run);
  }

  async syncBranches(): Promise<void> {
    this.logger.log('Syncing Kgara branches...');
    const run = await this.createSyncRun(null, '/api/v1/donvi/list', {}, 0);
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
      await this.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        branches.length,
        undefined,
        200,
      );
      this.logger.log('Finished syncing branches.');
    } catch (error: any) {
      await this.closeSyncRun(run, GwSyncStatus.FAILED, 0, error.message);
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

    // We record the start time before we make the first request
    // This will be used as the watermark for the next incremental sync
    const syncStartedAt = new Date().toISOString();
    const run = await this.createSyncRun(
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

          // Typed mappings - ERP fields are explicitly omitted (not overwritten)
          gwCase.soChungTu = c.SoChungTu;
          gwCase.bienSoXe = c.BienSoXe;
          gwCase.khachHangCode = c.KhachHangCode;
          gwCase.khachHangName = c.KhachHangName || c.TenKhachHang;
          gwCase.tinhTrangDichVu = c.TinhTrangDichVu;
          gwCase.tenTinhTrangDichVu = c.TenTinhTrangDichVu;
          gwCase.tienCoThue = c.TienCoThue;
          gwCase.tienDaThanhToan = c.TienDaThanhToan;
          gwCase.tienConPhaiThanhToan = c.TienConPhaiThanhToan;
          if (c.DoanhThu !== undefined) gwCase.doanhThu = c.DoanhThu;
          if (c.ChiPhi !== undefined) gwCase.chiPhi = c.ChiPhi;
          if (c.LoiNhuan !== undefined) gwCase.loiNhuan = c.LoiNhuan;
          gwCase.ngayPhatSinh = c.NgayPhatSinhFull
            ? new Date(c.NgayPhatSinhFull)
            : c.NgayPhatSinh
              ? new Date(c.NgayPhatSinh)
              : null;
          gwCase.ngayTiepNhan = c.NgayTiepNhan
            ? new Date(c.NgayTiepNhan)
            : null;
          gwCase.ngayHoanThanhCongViec = c.NgayHoanThanhCongViec
            ? new Date(c.NgayHoanThanhCongViec)
            : null;
          gwCase.ngayGiaoXeFull = c.NgayGiaoXeFull
            ? new Date(c.NgayGiaoXeFull)
            : null;
          gwCase.soKhung = c.SoKhung;
          gwCase.dataAsOf = dataAsOf ? new Date(dataAsOf) : null;

          const caseDate =
            gwCase.ngayHoanThanhCongViec ||
            gwCase.ngayPhatSinh ||
            gwCase.ngayTiepNhan;
          if (caseDate) {
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

          // Optionally, auto fetch detail for newly changed cases if desired.
          // For now, we rely on a separate job or client request to fetch detail.
        }
        page++;
      } while (page <= totalPages);

      // Sync gross profit details to map financial data to cases
      try {
        const dateRangesToSync: { from: string; to: string }[] = [];

        if (from && to) {
          dateRangesToSync.push({
            from: from.split('T')[0],
            to: to.split('T')[0],
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
            const d = new Date(isoStr);
            if (d < firstDay || d > lastDay) {
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

          if (profitResponse?.Groups) {
            for (const group of profitResponse.Groups) {
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

      await this.closeSyncRun(
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
        deletionResult = await this.detectAndMarkDeletedCases(
          branchExternalId,
          from,
          to,
          syncedIds,
        );
      }

      return deletionResult;
    } catch (error: any) {
      await this.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        totalRows,
        error.message,
      );
      throw error;
    }
  }

  async syncGrossProfitForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing gross profit ONLY for branch ${branchExternalId}...`,
    );
    try {
      const dateRangesToSync: { from: string; to: string }[] = [];
      if (from && to) {
        dateRangesToSync.push({
          from: from.split('T')[0],
          to: to.split('T')[0],
        });
      } else {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        dateRangesToSync.push({
          from: firstDay.toLocaleDateString('en-CA'),
          to: lastDay.toLocaleDateString('en-CA'),
        });
      }

      for (const range of dateRangesToSync) {
        const profitResponse = await this.client.getGrossProfitDetail(
          branchExternalId,
          range.from,
          range.to,
        );

        const results = profitResponse?.results;
        if (results?.Groups) {
          for (const group of results.Groups) {
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
      throw err;
    }
  }

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

    const run = await this.createSyncRun(
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

        for (const r of receivables) {
          const pFrom = from ? new Date(from) : new Date('2000-01-01');
          const pTo = to ? new Date(to) : new Date('2099-12-31');

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
          rec.ngayPhatSinh = r.NgayPhatSinh ? new Date(r.NgayPhatSinh) : null;
          rec.dataAsOf = dataAsOf ? new Date(dataAsOf) : null;
          rec.rawData = r;

          await this.receivableRepo.save(rec);
          totalRows++;
        }
        page++;
      } while (page <= totalPages);

      await this.closeSyncRun(
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
      await this.closeSyncRun(
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

    const run = await this.createSyncRun(
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

        for (const p of payables) {
          const pFrom = from ? new Date(from) : new Date('2000-01-01');
          const pTo = to ? new Date(to) : new Date('2099-12-31');

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
          pay.dataAsOf = dataAsOf ? new Date(dataAsOf) : null;
          pay.rawData = p;

          await this.payableRepo.save(pay);
          totalRows++;
        }
        page++;
      } while (page <= totalPages);

      await this.closeSyncRun(
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
      await this.closeSyncRun(
        run,
        GwSyncStatus.FAILED,
        totalRows,
        error.message,
      );
      throw error;
    }
  }

  async syncCaseDetail(caseId: string, branchExternalId: string): Promise<any> {
    this.logger.log(`Syncing case detail for case ${caseId}...`);
    const run = await this.createSyncRun(
      branchExternalId,
      '/api/v1/gr/cases/detail',
      { id: caseId },
      1,
    );

    try {
      const response = await this.client.getCaseDetail(
        caseId,
        branchExternalId,
      );
      const caseData = response?.data;
      if (!caseData) {
        await this.closeSyncRun(
          run,
          GwSyncStatus.FAILED,
          0,
          'No data returned',
        );
        return null;
      }

      // Update case if exists
      let gwCase = await this.caseRepo.findOne({
        where: { hdPhieuDichVuId: caseId },
      });
      if (!gwCase) {
        gwCase = new KgaraCase();
        gwCase.hdPhieuDichVuId = caseId;
        gwCase.branchExternalId = branchExternalId;
      }

      // Selective mappings
      gwCase.soChungTu = caseData.SoChungTu;
      gwCase.bienSoXe = caseData.BienSoXe;
      gwCase.khachHangCode = caseData.KhachHangCode;
      gwCase.khachHangName = caseData.KhachHangName || caseData.TenKhachHang;
      gwCase.tinhTrangDichVu = caseData.TinhTrangDichVu;
      gwCase.tienCoThue = caseData.TienCoThue;
      gwCase.tienDaThanhToan = caseData.TienDaThanhToan;
      gwCase.tienConPhaiThanhToan = caseData.TienConPhaiThanhToan;
      gwCase.ngayPhatSinh = caseData.NgayPhatSinhFull
        ? new Date(caseData.NgayPhatSinhFull)
        : caseData.NgayPhatSinh
          ? new Date(caseData.NgayPhatSinh)
          : null;
      gwCase.ngayTiepNhan = caseData.NgayTiepNhan
        ? new Date(caseData.NgayTiepNhan)
        : null;
      gwCase.ngayHoanThanhCongViec = caseData.NgayHoanThanhCongViec
        ? new Date(caseData.NgayHoanThanhCongViec)
        : null;
      gwCase.ngayGiaoXeFull = caseData.NgayGiaoXeFull
        ? new Date(caseData.NgayGiaoXeFull)
        : null;
      gwCase.soKhung = caseData.SoKhung;
      gwCase.dataAsOf = response.dataAsOf ? new Date(response.dataAsOf) : null;
      gwCase.rawData = caseData;

      // Restore case if it was previously soft-deleted
      if (gwCase.kgaraDeletedAt) {
        gwCase.kgaraDeletedAt = null;
        gwCase.kgaraDeleteCount = 0;
        this.logger.log(`Case ${caseId} was restored from soft-delete.`);
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
            srv.hdPhieuDichVuId = caseId;
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

      await this.closeSyncRun(
        run,
        GwSyncStatus.SUCCESS,
        1 + linesCount,
        undefined,
        200,
      );
      this.logger.log(`Finished syncing case detail for case ${caseId}.`);
      return caseData;
    } catch (error: any) {
      await this.closeSyncRun(run, GwSyncStatus.FAILED, 0, error.message);
      throw error;
    }
  }

  /**
   * Helper to perform incremental sync using previous successful sync run watermark
   */
  async getIncrementalWatermark(
    branchExternalId: string,
    endpoint: string,
  ): Promise<string | undefined> {
    const lastRun = await this.syncRunRepo.findOne({
      where: { branchExternalId, endpoint, status: GwSyncStatus.SUCCESS },
      order: { requestStartedAt: 'DESC' },
    });
    if (!lastRun) return undefined;

    // Substract 10 minutes overlap as recommended
    const watermark = new Date(
      lastRun.requestStartedAt.getTime() - 10 * 60 * 1000,
    );
    return watermark.toISOString();
  }

  /**
   * Helper to detect and mark soft-deleted cases that no longer exist on Kgara.
   */
  async detectAndMarkDeletedCases(
    branchExternalId: string,
    from: string,
    to: string,
    syncedIds: Set<string>,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    this.logger.log(
      `Running deletion detection for branch ${branchExternalId} from ${from} to ${to}...`,
    );

    // Find all cases in ERP for this branch and date range
    const erpCases = await this.caseRepo
      .createQueryBuilder('case')
      .where('case.branchExternalId = :branchExternalId', { branchExternalId })
      .andWhere('case.ngayPhatSinh >= :from', { from })
      .andWhere('case.ngayPhatSinh <= :to', { to })
      .andWhere('case.kgaraDeletedAt IS NULL')
      .getMany();

    const deletedCases = erpCases.filter(
      (c) => !syncedIds.has(c.hdPhieuDichVuId),
    );

    if (deletedCases.length === 0) {
      return { deletedCount: 0, withLinkedInvoices: [] };
    }

    const casesWithInvoices: string[] = [];

    for (const c of deletedCases) {
      // Check if case has linked invoices
      const hasLinks = await this.linkedInvoiceRepo.count({
        where: { caseDbId: c.id },
      });

      if (hasLinks > 0) {
        casesWithInvoices.push(c.hdPhieuDichVuId);
      }

      c.kgaraDeleteCount += 1;

      // If deleted 2 or more times, mark as definitely deleted
      if (c.kgaraDeleteCount >= 2) {
        c.kgaraDeletedAt = new Date();
      }

      await this.caseRepo.save(c);

      this.logger.warn(
        `Case ${c.hdPhieuDichVuId} marked as deleted (count: ${c.kgaraDeleteCount}). Has linked invoices: ${hasLinks > 0}`,
      );
    }

    // Only count cases that actually reached the kgaraDeletedAt state,
    // or we can count all soft-delete increments. Let's return the count of newly flagged or confirmed deleted cases.
    return {
      deletedCount: deletedCases.length,
      withLinkedInvoices: casesWithInvoices,
    };
  }
}
