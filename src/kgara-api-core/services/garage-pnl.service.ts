import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { GarageOpexService } from './garage-opex.service';
import { ListGarageOpexQueryDto } from '../dto/garage-opex.dto';

@Injectable()
export class GaragePnlService {
  private readonly logger = new Logger(GaragePnlService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    private readonly opexService: GarageOpexService,
  ) {}

  /**
   * 6. Lấy Báo cáo Lợi nhuận (P&L) Garage theo tháng (Doanh thu + Giá vốn + CP vận hành + Hoa hồng -> Lợi nhuận ròng)
   */
  async getPnlReport(year?: number, month?: number) {
    const currentYear = year ? Number(year) : new Date().getFullYear();
    const currentMonth = month ? Number(month) : new Date().getMonth() + 1;
    const periodStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // 1. Tổng hợp Doanh thu & Chi phí giá vốn từ các vụ việc hoàn thành trong tháng
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .leftJoin('erp_module_categories', 'cat', 'cat.id = c.category_id')
      .leftJoin(
        KgaraGrossProfit,
        'gp',
        'gp.hd_phieu_dich_vu_id = c.hd_phieu_dich_vu_id OR gp.vu_viec_code = c.so_chung_tu',
      )
      .select(
        'SUM(COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0))',
        'revenue',
      )
      .addSelect('SUM(COALESCE(gp.chi_phi, c.chi_phi, 0))', 'cogs')
      .addSelect('COUNT(c.id)', 'caseCount')
      // Mảng Ký gửi / Nội bộ (dựa vào category code hoặc classification)
      .addSelect(
        "SUM(CASE WHEN COALESCE(cat.code, c.classification) IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'kyGuiRevenue',
      )
      .addSelect(
        "SUM(CASE WHEN COALESCE(cat.code, c.classification) IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'kyGuiCogs',
      )
      .addSelect(
        "COUNT(CASE WHEN COALESCE(cat.code, c.classification) IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN c.id END)",
        'kyGuiCaseCount',
      )
      // Mảng Sửa chữa chung
      .addSelect(
        "SUM(CASE WHEN COALESCE(cat.code, c.classification) = 'SUA_CHUA_CHUNG' THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'suaChuaChungRevenue',
      )
      .addSelect(
        "SUM(CASE WHEN COALESCE(cat.code, c.classification) = 'SUA_CHUA_CHUNG' THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'suaChuaChungCogs',
      )
      .addSelect(
        "COUNT(CASE WHEN COALESCE(cat.code, c.classification) = 'SUA_CHUA_CHUNG' THEN c.id END)",
        'suaChuaChungCaseCount',
      )
      // Phân khúc OJ
      .addSelect(
        "SUM(CASE WHEN COALESCE(cat.code, c.classification) IN ('OJ', 'OJ_NGOAI') THEN COALESCE(gp.doanh_thu, c.doanh_thu, c.tien_co_thue, 0) ELSE 0 END)",
        'ojRevenue',
      )
      .addSelect(
        "SUM(CASE WHEN COALESCE(cat.code, c.classification) IN ('OJ', 'OJ_NGOAI') THEN COALESCE(gp.chi_phi, c.chi_phi, 0) ELSE 0 END)",
        'ojCogs',
      )
      .addSelect(
        "COUNT(CASE WHEN COALESCE(cat.code, c.classification) IN ('OJ', 'OJ_NGOAI') THEN 1 END)",
        'ojCaseCount',
      )
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec IS NOT NULL')
      .andWhere(
        "TO_CHAR(c.ngay_hoan_thanh_cong_viec, 'YYYY-MM') = :periodStr",
        { periodStr },
      );

    const rawAgg = await qb.getRawOne();
    const revenue = Number(rawAgg?.revenue) || 0;
    const cogsDirect = Number(rawAgg?.cogs) || 0;
    const caseCount = Number(rawAgg?.caseCount) || 0;

    const kyGuiRevenue = Number(rawAgg?.kyGuiRevenue) || 0;
    const kyGuiCogs = Number(rawAgg?.kyGuiCogs) || 0;
    const kyGuiCaseCount = Number(rawAgg?.kyGuiCaseCount) || 0;
    const kyGuiGrossProfit = kyGuiRevenue - kyGuiCogs;

    const suaChuaChungRevenue = Number(rawAgg?.suaChuaChungRevenue) || 0;
    const suaChuaChungCogs = Number(rawAgg?.suaChuaChungCogs) || 0;
    const suaChuaChungCaseCount = Number(rawAgg?.suaChuaChungCaseCount) || 0;
    const suaChuaChungGrossProfit = suaChuaChungRevenue - suaChuaChungCogs;

    const ojRevenue = Number(rawAgg?.ojRevenue) || 0;
    const ojCogsDirect = Number(rawAgg?.ojCogs) || 0;
    const ojCaseCount = Number(rawAgg?.ojCaseCount) || 0;

    // 2. Lấy Chi phí vận hành, Hoa hồng & Chi phí trực tiếp nhập tay từ GarageOpexService
    const opexSummary = await this.opexService.getSummaryByPeriod(
      currentYear,
      currentMonth,
    );

    const cogs = cogsDirect + opexSummary.directCost.total;
    const grossProfit = revenue - cogs;

    const netProfitBeforeCommission = grossProfit - opexSummary.opex.total;

    // 3. Tính toán Tỷ lệ lãi gộp Ký gửi / Tổng Lãi gộp (R_kg)
    // Tỷ lệ = GP_kg / GP (0..100%) khi GP > 0 và GP_kg > 0
    const kyGuiProfitRate =
      grossProfit > 0 && kyGuiGrossProfit > 0
        ? (kyGuiGrossProfit / grossProfit) * 100
        : 0;
    const kyGuiProfitRatioDecimal = kyGuiProfitRate / 100;

    // 4. Tính toán Chi phí bán hàng (Selling Expenses):
    // Hoa hồng cho Sale (10%): Tính trên 10% của Lợi nhuận trước hoa hồng Sale & DV theo Tỷ lệ lợi nhuận gộp do ký gửi
    const netProfitBeforeSellingAndOpex = grossProfit - opexSummary.opex.total;
    const saleCommissionRate = 0.1;
    const saleCommission =
      netProfitBeforeSellingAndOpex > 0
        ? Math.round(
            netProfitBeforeSellingAndOpex *
              kyGuiProfitRatioDecimal *
              saleCommissionRate,
          )
        : 0;

    const sellingItems = [
      {
        categoryKey: 'RATE_LAI_GOP_KY_GUI',
        categoryName: 'Tỷ lệ lãi gộp ký gửi / Lãi gộp',
        amount: kyGuiProfitRate,
        ojAmount: 0,
        note: `Lãi gộp Ký gửi: ${kyGuiGrossProfit.toLocaleString('vi-VN')} đ / Tổng lãi gộp: ${grossProfit.toLocaleString('vi-VN')} đ`,
      },
      {
        categoryKey: 'HOA_HONG_SALE',
        categoryName: 'Hoa hồng cho Sale (10%)',
        amount: saleCommission,
        ojAmount: 0,
        isAutoCalculated: true,
        isReadOnly: true,
        note: 'Tính trên 10% của Lợi nhuận ròng theo Tỷ lệ lợi nhuận gộp do ký gửi / tổng lợi nhuận gộp',
      },
    ];

    const sellingExpenses = {
      total: saleCommission,
      ojTotal: 0,
      items: sellingItems,
    };

    // 5. Lợi nhuận ròng từ hoạt động kinh doanh (Chuẩn kế toán):
    // Lợi nhuận ròng = Lợi nhuận gộp - Chi phí bán hàng - Chi phí vận hành (OPEX)
    const netProfit =
      grossProfit - sellingExpenses.total - opexSummary.opex.total;

    // 6. Thưởng & Hoa hồng Dịch vụ (Trích lập sau Lợi nhuận ròng):
    // Hoa hồng cho DV (10%): Tính trên 10% của Lợi nhuận ròng
    const dvCommissionRate = 0.1;
    const dvCommission =
      netProfit > 0 ? Math.round(netProfit * dvCommissionRate) : 0;

    // Các khoản hoa hồng / điều chỉnh nhập tay thủ công khác (như HOA_HONG_KHAC)
    const manualCommissionItems = (opexSummary.commission?.items || []).filter(
      (item) =>
        item.categoryKey !== 'HOA_HONG_SALE' &&
        item.categoryKey !== 'HOA_HONG_DV',
    );
    const manualCommissionTotal = manualCommissionItems.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );
    const manualCommissionOjTotal = manualCommissionItems.reduce(
      (sum, item) => sum + (Number(item.ojAmount) || 0),
      0,
    );

    const serviceCommissionTotal = dvCommission + manualCommissionTotal;
    const serviceCommissionOjTotal = manualCommissionOjTotal;

    const serviceCommission = {
      total: serviceCommissionTotal,
      ojTotal: serviceCommissionOjTotal,
      dvCommission,
      items: [
        {
          categoryKey: 'HOA_HONG_DV',
          categoryName: 'Hoa hồng cho DV (10%)',
          amount: dvCommission,
          ojAmount: 0,
          isAutoCalculated: true,
          isReadOnly: true,
          note: 'Tính trên 10% Lợi nhuận ròng',
        },
        ...manualCommissionItems,
      ],
    };

    // 7. Lợi nhuận giữ lại của Garage (Sau hoa hồng DV & Thưởng)
    const netProfitAfterCommission = netProfit - serviceCommissionTotal;

    // Backward compatibility tổng hoa hồng
    const totalCommission =
      saleCommission + dvCommission + manualCommissionTotal;
    const totalAutoCommission = saleCommission + dvCommission;

    // 8. Tính toán riêng cho phân khúc OJ
    const ojDirectCostTotal = opexSummary.directCost.ojTotal || 0;
    const ojCogs = ojCogsDirect + ojDirectCostTotal;
    const ojGrossProfit = ojRevenue - ojCogs;
    const ojSellingExpensesTotal = 0;
    const ojOpexTotal = opexSummary.opex.ojTotal || 0;
    const ojNetProfit = ojGrossProfit - ojSellingExpensesTotal - ojOpexTotal;
    const ojSaleCommission = 0; // OJ không tính hoa hồng ký gửi sale
    const ojDvCommission =
      ojNetProfit > 0 ? Math.round(ojNetProfit * dvCommissionRate) : 0;
    const ojCommissionTotal =
      ojSaleCommission + ojDvCommission + manualCommissionOjTotal;
    const ojNetProfitAfterCommission =
      ojNetProfit - ojDvCommission - manualCommissionOjTotal;

    return {
      period: { year: currentYear, month: currentMonth },
      periodStr: `${String(currentMonth).padStart(2, '0')}/${currentYear}`,
      caseCount,
      revenue,
      cogs,
      cogsDirect,
      cogsAdjustment: opexSummary.directCost,
      grossProfit,
      grossMarginRate: revenue > 0 ? (grossProfit / revenue) * 100 : 0,

      // Chi tiết mảng Ký gửi / Nội bộ (từ kgara_cases.classification)
      kyGui: {
        caseCount: kyGuiCaseCount,
        revenue: kyGuiRevenue,
        cogs: kyGuiCogs,
        grossProfit: kyGuiGrossProfit,
        grossProfitRatio: kyGuiProfitRate,
      },

      // Chi tiết mảng Sửa chữa chung
      suaChuaChung: {
        caseCount: suaChuaChungCaseCount,
        revenue: suaChuaChungRevenue,
        cogs: suaChuaChungCogs,
        grossProfit: suaChuaChungGrossProfit,
      },

      sellingExpenses,
      opex: opexSummary.opex,
      netProfit,
      netProfitBeforeCommission: netProfitBeforeSellingAndOpex, // Giữ tương thích
      serviceCommission,

      commission: {
        total: totalCommission,
        ojTotal: ojCommissionTotal,
        // Cấu trúc tự động tính toán
        auto: {
          kyGuiGrossProfit,
          totalGrossProfit: grossProfit,
          kyGuiProfitRate,
          saleCommissionRate: 10,
          saleCommission,
          dvCommissionRate: 10,
          dvCommission,
          totalAuto: totalAutoCommission,
        },
        // Các khoản nhập tay thủ công khác (nếu có)
        manual: {
          total: manualCommissionTotal,
          ojTotal: manualCommissionOjTotal,
          items: manualCommissionItems,
        },
        items: [
          {
            categoryKey: 'RATE_LAI_GOP_KY_GUI',
            categoryName: 'Tỷ lệ lãi gộp ký gửi / Lãi gộp',
            amount: kyGuiProfitRate,
            ojAmount: 0,
            note: `Lãi gộp Ký gửi: ${kyGuiGrossProfit.toLocaleString('vi-VN')} đ / Tổng lãi gộp: ${grossProfit.toLocaleString('vi-VN')} đ`,
          },
          {
            categoryKey: 'HOA_HONG_SALE',
            categoryName: 'Hoa hồng cho Sale (10%)',
            amount: saleCommission,
            ojAmount: 0,
            isAutoCalculated: true,
            isReadOnly: true,
            note: 'Tính trên 10% của Lợi nhuận ròng theo Tỷ lệ lợi nhuận gộp do ký gửi / tổng lợi nhuận gộp',
          },
          {
            categoryKey: 'HOA_HONG_DV',
            categoryName: 'Hoa hồng cho DV (10%)',
            amount: dvCommission,
            ojAmount: ojDvCommission,
            isAutoCalculated: true,
            isReadOnly: true,
            note: 'Tính trên 10% Lợi nhuận ròng sau khi trừ hoa hồng Sale',
          },
          ...manualCommissionItems,
        ],
      },
      netProfitAfterCommission,
      netMarginRate:
        revenue > 0 ? (netProfitAfterCommission / revenue) * 100 : 0,
      oj: {
        caseCount: ojCaseCount,
        revenue: ojRevenue,
        revenueRatio: revenue > 0 ? (ojRevenue / revenue) * 100 : 0,
        cogs: ojCogs,
        cogsDirect: ojCogsDirect,
        cogsAdjustmentTotal: ojDirectCostTotal,
        grossProfit: ojGrossProfit,
        grossMarginRate: ojRevenue > 0 ? (ojGrossProfit / ojRevenue) * 100 : 0,
        sellingExpensesTotal: ojSellingExpensesTotal,
        opexTotal: ojOpexTotal,
        netProfit: ojNetProfit,
        netProfitBeforeCommission: ojGrossProfit - ojOpexTotal,
        serviceCommissionTotal: ojDvCommission + manualCommissionOjTotal,
        commissionTotal: ojCommissionTotal,
        commissionAuto: {
          kyGuiProfitRate: 0,
          saleCommission: ojSaleCommission,
          dvCommission: ojDvCommission,
          totalAuto: ojDvCommission,
        },
        netProfitAfterCommission: ojNetProfitAfterCommission,
        netMarginRate:
          ojRevenue > 0 ? (ojNetProfitAfterCommission / ojRevenue) * 100 : 0,
      },
    };
  }

  /**
   * Lấy danh sách CP Vận hành kết hợp (kèm 2 dòng Hoa hồng Sale & DV tính toán tự động)
   */
  async getCombinedOpexList(query: ListGarageOpexQueryDto) {
    const dbResult = await this.opexService.getList(query);

    // Nếu filter chỉ lấy OPEX hoặc COGS thì không cần inject hoa hồng tự động
    if (query.cost_group === 'OPEX' || query.cost_group === 'COGS') {
      return dbResult;
    }

    // Xác định các kỳ (Year/Month) cần tính hoa hồng tự động
    const periodsToCompute: Array<{ year: number; month: number }> = [];

    if (query.year && query.month) {
      periodsToCompute.push({
        year: Number(query.year),
        month: Number(query.month),
      });
    } else if (query.date_from && query.date_to) {
      const [fromY, fromM] = query.date_from.split('-').map(Number);
      const [toY, toM] = query.date_to.split('-').map(Number);
      if (fromY === toY && fromM === toM) {
        periodsToCompute.push({ year: fromY, month: fromM || 1 });
      } else {
        // Range: duyệt các tháng
        let curY = fromY;
        let curM = fromM || 1;
        const endY = toY;
        const endM = toM || 12;
        while (curY < endY || (curY === endY && curM <= endM)) {
          periodsToCompute.push({ year: curY, month: curM });
          curM++;
          if (curM > 12) {
            curM = 1;
            curY++;
          }
        }
      }
    } else {
      // Nếu không có filter kỳ, lấy từ dbResult hoặc tháng hiện tại
      const foundPeriods = new Set<string>();
      for (const item of dbResult.data) {
        foundPeriods.add(`${item.periodYear}-${item.periodMonth}`);
      }
      if (foundPeriods.size === 0) {
        const now = new Date();
        periodsToCompute.push({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        });
      } else {
        for (const p of foundPeriods) {
          const [y, m] = p.split('-').map(Number);
          periodsToCompute.push({ year: y, month: m });
        }
      }
    }

    const virtualItems: any[] = [];

    for (const p of periodsToCompute) {
      const pnl = await this.getPnlReport(p.year, p.month);

      const autoSale = {
        id: `auto-sale-${p.year}-${String(p.month).padStart(2, '0')}`,
        periodYear: p.year,
        periodMonth: p.month,
        period: `${String(p.month).padStart(2, '0')}/${p.year}`,
        categoryKey: 'HOA_HONG_SALE',
        categoryName: 'Hoa hồng cho Sale (10%)',
        amount: pnl.commission.auto.saleCommission,
        ojAmount: 0,
        note: `Tự động tính từ P&L (${pnl.commission.auto.kyGuiProfitRate.toFixed(1)}% tỷ lệ ký gửi, LN ròng trước HH: ${pnl.netProfitBeforeCommission.toLocaleString('vi-VN')} đ)`,
        recurrenceType: null,
        recurrenceUntilYear: null,
        recurrenceUntilMonth: null,
        recurrenceAnchorId: null,
        isAutoCalculated: true,
        isReadOnly: true,
        createdAt: new Date(
          `${p.year}-${String(p.month).padStart(2, '0')}-01T00:00:00.000Z`,
        ),
        updatedAt: new Date(),
      };

      const autoDv = {
        id: `auto-dv-${p.year}-${String(p.month).padStart(2, '0')}`,
        periodYear: p.year,
        periodMonth: p.month,
        period: `${String(p.month).padStart(2, '0')}/${p.year}`,
        categoryKey: 'HOA_HONG_DV',
        categoryName: 'Hoa hồng cho DV (10%)',
        amount: pnl.commission.auto.dvCommission,
        ojAmount: pnl.oj?.commissionAuto?.dvCommission || 0,
        note: `Tự động tính từ P&L (10% LN ròng sau trừ HH Sale: ${(pnl.netProfitBeforeCommission - pnl.commission.auto.saleCommission).toLocaleString('vi-VN')} đ)`,
        recurrenceType: null,
        recurrenceUntilYear: null,
        recurrenceUntilMonth: null,
        recurrenceAnchorId: null,
        isAutoCalculated: true,
        isReadOnly: true,
        createdAt: new Date(
          `${p.year}-${String(p.month).padStart(2, '0')}-01T00:00:00.000Z`,
        ),
        updatedAt: new Date(),
      };

      // Kiểm tra filter theo query
      const candidates = [autoSale, autoDv];
      for (const item of candidates) {
        let match = true;
        if (query.column_filters) {
          try {
            const filters = JSON.parse(query.column_filters) as Record<
              string,
              string[]
            >;
            if (filters.categoryKey && filters.categoryKey.length > 0) {
              if (!filters.categoryKey.includes(item.categoryKey))
                match = false;
            }
            if (filters.categoryName && filters.categoryName.length > 0) {
              if (!filters.categoryName.includes(item.categoryName))
                match = false;
            }
            if (filters.costGroup && filters.costGroup.length > 0) {
              if (!filters.costGroup.includes('COMMISSION')) match = false;
            }
          } catch (e) {}
        }
        if (match) {
          virtualItems.push(item);
        }
      }
    }

    // Gộp virtualItems vào kết quả và sort
    const combinedData = [...virtualItems, ...dbResult.data];
    const total = dbResult.total + virtualItems.length;
    const pageSize = Math.max(Number(query.pageSize) || 20, 1);

    return {
      data: combinedData,
      total,
      page: Math.max(Number(query.page) || 1, 1),
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Lấy chi tiết bản ghi ảo hoa hồng tự động
   */
  async getVirtualOpexById(id: string) {
    if (id.startsWith('auto-sale-') || id.startsWith('auto-dv-')) {
      const isSale = id.startsWith('auto-sale-');
      const parts = id.split('-');
      const year = parseInt(parts[2], 10);
      const month = parseInt(parts[3], 10);
      const report = await this.getPnlReport(year, month);

      if (isSale) {
        return {
          id,
          periodYear: year,
          periodMonth: month,
          period: `${String(month).padStart(2, '0')}/${year}`,
          categoryKey: 'HOA_HONG_SALE',
          categoryName: 'Hoa hồng cho Sale (10%)',
          amount: report.commission.auto.saleCommission,
          ojAmount: 0,
          note: `Tự động tính từ P&L (${report.commission.auto.kyGuiProfitRate.toFixed(1)}% tỷ lệ ký gửi, LN ròng trước HH: ${report.netProfitBeforeCommission.toLocaleString('vi-VN')} đ)`,
          recurrenceType: null,
          recurrenceUntilYear: null,
          recurrenceUntilMonth: null,
          recurrenceAnchorId: null,
          isAutoCalculated: true,
          isReadOnly: true,
          createdAt: new Date(
            `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`,
          ),
          updatedAt: new Date(),
        };
      } else {
        return {
          id,
          periodYear: year,
          periodMonth: month,
          period: `${String(month).padStart(2, '0')}/${year}`,
          categoryKey: 'HOA_HONG_DV',
          categoryName: 'Hoa hồng cho DV (10%)',
          amount: report.commission.auto.dvCommission,
          ojAmount: report.oj?.commissionAuto?.dvCommission || 0,
          note: `Tự động tính từ P&L (10% LN ròng sau trừ HH Sale: ${(report.netProfitBeforeCommission - report.commission.auto.saleCommission).toLocaleString('vi-VN')} đ)`,
          recurrenceType: null,
          recurrenceUntilYear: null,
          recurrenceUntilMonth: null,
          recurrenceAnchorId: null,
          isAutoCalculated: true,
          isReadOnly: true,
          createdAt: new Date(
            `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`,
          ),
          updatedAt: new Date(),
        };
      }
    }
    return this.opexService.getById(id);
  }

  /**
   * 7. Xuất Báo cáo Lợi nhuận (P&L) ra file Excel
   */
  async exportPnlExcel(year?: number, month?: number): Promise<Buffer> {
    const report = await this.getPnlReport(year, month);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(
      `P&L Tháng ${report.period.month}-${report.period.year}`,
    );

    sheet.columns = [
      { header: 'Danh Mục', key: 'category', width: 45 },
      {
        header: 'Toàn Bộ (VND)',
        key: 'amount',
        width: 24,
      },
      {
        header: 'Riêng OJ (VND)',
        key: 'ojAmount',
        width: 24,
      },
    ];

    // Tiêu đề lớn
    sheet.spliceRows(1, 0, [
      `BÁO CÁO LỢI NHUẬN (P&L) GARAGE - THÁNG ${String(report.period.month).padStart(2, '0')}/${report.period.year}`,
      '',
      '',
    ]);
    sheet.mergeCells('A1:C1');
    const titleRow = sheet.getRow(1);
    titleRow.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FF1E293B' },
    };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    // Header bảng
    const headerRow = sheet.getRow(2);
    headerRow.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' },
    };
    headerRow.height = 24;

    const rowsData: Array<{
      category: string;
      amount: number | string;
      ojAmount?: number | string;
      isHeader?: boolean;
      isHighlight?: boolean;
      isSuccess?: boolean;
      isChild?: boolean;
      isRate?: boolean;
    }> = [
      // 1. DOANH THU
      {
        category: '1. Doanh Thu',
        amount: report.revenue,
        ojAmount: report.oj?.revenue || 0,
        isHeader: true,
      },
      {
        category: '   1.1. Doanh Thu Dịch Vụ',
        amount: report.revenue,
        ojAmount: report.oj?.revenue || 0,
        isChild: true,
      },
      {
        category: '      1.1.1. Trong đó: Phát sinh liên quan OJ',
        amount: report.oj?.revenue || 0,
        ojAmount: report.oj?.revenue || 0,
        isChild: true,
      },

      // 2. CHI PHÍ (GIÁ VỐN)
      {
        category: '2. Chi phí (Giá vốn)',
        amount: report.cogs,
        ojAmount: report.oj?.cogs || 0,
        isHeader: true,
      },
      {
        category: '   2.1. Chi phí phụ tùng & Gia công ngoài (từ vụ việc)',
        amount: report.cogsDirect,
        ojAmount: report.oj?.cogsDirect || 0,
        isChild: true,
      },
      {
        category: '      2.1.1. Trong đó: Phát sinh liên quan OJ',
        amount: report.oj?.cogsDirect || 0,
        ojAmount: report.oj?.cogsDirect || 0,
        isChild: true,
      },
    ];

    // Chi phí trực tiếp nhập tay (nếu có)
    if (report.cogsAdjustment && report.cogsAdjustment.items.length > 0) {
      rowsData.push({
        category: '   2.2. Chi phí trực tiếp nhập tay (Điều chỉnh giá vốn)',
        amount: report.cogsAdjustment.total,
        ojAmount: report.cogsAdjustment.ojTotal || 0,
        isChild: true,
      });

      report.cogsAdjustment.items.forEach((item, idx) => {
        const itemIdx = `2.2.${idx + 1}`;
        rowsData.push({
          category: `      ${itemIdx}. ${item.categoryName}`,
          amount: item.amount,
          ojAmount: item.ojAmount || 0,
          isChild: true,
        });
        if (item.ojAmount && item.ojAmount > 0) {
          rowsData.push({
            category: `         ${itemIdx}.1. Trong đó: Phát sinh liên quan OJ`,
            amount: item.ojAmount,
            ojAmount: item.ojAmount,
            isChild: true,
          });
        }
      });
    }

    // 3. LỢI NHUẬN GỘP
    rowsData.push(
      {
        category: '3. Lợi nhuận gộp',
        amount: report.grossProfit,
        ojAmount: report.oj?.grossProfit || 0,
        isHighlight: true,
      },
      {
        category: '   3.1. Trong đó: Lợi nhuận gộp mảng OJ',
        amount: report.oj?.grossProfit || 0,
        ojAmount: report.oj?.grossProfit || 0,
        isChild: true,
      },

      // 4. CHI PHÍ BÁN HÀNG
      {
        category: '4. Chi phí bán hàng',
        amount: report.sellingExpenses.total,
        ojAmount: report.sellingExpenses.ojTotal || 0,
        isHeader: true,
      },
      {
        category: '   4.1. Hoa hồng cho Sale (10%)',
        amount: report.commission.auto.saleCommission,
        ojAmount: report.oj?.commissionAuto?.saleCommission || 0,
        isChild: true,
      },
      {
        category: '      4.1.1. Tỷ lệ lãi gộp ký gửi / Lãi gộp',
        amount: `${report.commission.auto.kyGuiProfitRate.toFixed(2)}%`,
        ojAmount: '0.00%',
        isChild: true,
        isRate: true,
      },
      {
        category: '      4.1.2. Hoa hồng Sale từ xe Ký gửi / Nội bộ',
        amount: report.commission.auto.saleCommission,
        ojAmount: report.oj?.commissionAuto?.saleCommission || 0,
        isChild: true,
      },
    );

    if (
      report.oj?.commissionAuto?.saleCommission &&
      report.oj.commissionAuto.saleCommission > 0
    ) {
      rowsData.push({
        category: '         4.1.2.1. Trong đó: Phát sinh liên quan OJ',
        amount: report.oj.commissionAuto.saleCommission,
        ojAmount: report.oj.commissionAuto.saleCommission,
        isChild: true,
      });
    }

    // 5. CHI PHÍ VẬN HÀNH (OPEX)
    rowsData.push({
      category: '5. Chi phí vận hành',
      amount: report.opex.total,
      ojAmount: report.oj?.opexTotal || 0,
      isHeader: true,
    });

    if (report.opex.items.length === 0) {
      rowsData.push({
        category: '   5.1. (Chưa nhập chi phí vận hành)',
        amount: 0,
        ojAmount: 0,
        isChild: true,
      });
    } else {
      report.opex.items.forEach((item, idx) => {
        const itemIdx = `5.${idx + 1}`;
        rowsData.push({
          category: `   ${itemIdx}. ${item.categoryName}`,
          amount: item.amount,
          ojAmount: item.ojAmount || 0,
          isChild: true,
        });
        if (item.ojAmount && item.ojAmount > 0) {
          rowsData.push({
            category: `      ${itemIdx}.1. Trong đó: Phát sinh liên quan OJ`,
            amount: item.ojAmount,
            ojAmount: item.ojAmount,
            isChild: true,
          });
        }
      });
    }

    // 6. LỢI NHUẬN RÒNG (Chuẩn Kế toán: 6 = 3 - 4 - 5)
    rowsData.push(
      {
        category: '6. Lợi nhuận ròng',
        amount: report.netProfit,
        ojAmount: report.oj?.netProfit || 0,
        isHighlight: true,
      },
      {
        category: '   6.1. Trong đó: Lợi nhuận ròng mảng OJ',
        amount: report.oj?.netProfit || 0,
        ojAmount: report.oj?.netProfit || 0,
        isChild: true,
      },

      // 7. THƯỞNG VÀ HOA HỒNG DỊCH VỤ
      {
        category: '7. Thưởng và Hoa hồng Dịch vụ',
        amount: report.serviceCommission.total,
        ojAmount: report.serviceCommission.ojTotal || 0,
        isHeader: true,
      },
      {
        category: '   7.1. Hoa hồng cho DV (10%)',
        amount: report.serviceCommission.dvCommission,
        ojAmount: report.oj?.commissionAuto?.dvCommission || 0,
        isChild: true,
      },
      {
        category: '      7.1.1. Trong đó: Phát sinh liên quan OJ',
        amount: report.oj?.commissionAuto?.dvCommission || 0,
        ojAmount: report.oj?.commissionAuto?.dvCommission || 0,
        isChild: true,
      },
    );

    // Các khoản hoa hồng thủ công khác (7.2, 7.3...)
    if (report.commission.manual && report.commission.manual.items.length > 0) {
      report.commission.manual.items.forEach((item, idx) => {
        const itemIdx = `7.${idx + 2}`;
        rowsData.push({
          category: `   ${itemIdx}. ${item.categoryName}`,
          amount: item.amount,
          ojAmount: item.ojAmount || 0,
          isChild: true,
        });
        if (item.ojAmount && item.ojAmount > 0) {
          rowsData.push({
            category: `      ${itemIdx}.1. Trong đó: Phát sinh liên quan OJ`,
            amount: item.ojAmount,
            ojAmount: item.ojAmount,
            isChild: true,
          });
        }
      });
    }

    // 8. LỢI NHUẬN GIỮ LẠI (SAU HOA HỒNG DV)
    rowsData.push(
      {
        category: '8. Lợi nhuận giữ lại của Garage',
        amount: report.netProfitAfterCommission,
        ojAmount: report.oj?.netProfitAfterCommission || 0,
        isSuccess: true,
      },
      {
        category: '   8.1. Trong đó: Lợi nhuận giữ lại mảng OJ',
        amount: report.oj?.netProfitAfterCommission || 0,
        ojAmount: report.oj?.netProfitAfterCommission || 0,
        isChild: true,
      },
    );

    for (const r of rowsData) {
      const addedRow = sheet.addRow({
        category: r.category,
        amount: r.amount,
        ojAmount: r.ojAmount !== undefined ? r.ojAmount : 0,
      });
      addedRow.height = 22;

      // Định dạng cell số
      const amountCell = addedRow.getCell(2);
      const ojAmountCell = addedRow.getCell(3);

      if (typeof r.amount === 'number') {
        amountCell.numFmt = '#,##0';
      } else {
        amountCell.alignment = { horizontal: 'right', vertical: 'middle' };
      }

      if (typeof r.ojAmount === 'number') {
        ojAmountCell.numFmt = '#,##0';
      } else {
        ojAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };
      }

      if (r.isHeader) {
        addedRow.font = { bold: true, color: { argb: 'FF0F172A' } };
        addedRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
      } else if (r.isHighlight) {
        addedRow.font = { bold: true, color: { argb: 'FF1E3A8A' } };
        addedRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' },
        };
      } else if (r.isSuccess) {
        addedRow.font = { bold: true, size: 12, color: { argb: 'FF14532D' } };
        addedRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDCFCE7' },
        };
      } else if (r.isChild) {
        addedRow.font = { color: { argb: 'FF475569' } };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
