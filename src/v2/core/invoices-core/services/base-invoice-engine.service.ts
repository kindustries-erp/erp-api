import { BadRequestException, Injectable } from '@nestjs/common';

export interface IInvoiceMetadataTarget {
  description?: string | null;
  notes?: string | null;
  items?: { description?: string | null }[];
  settlementOrder?: string | null;
  licensePlate?: string | null;
}

export interface IInvoiceTotalsResult {
  preVatAmount: number;
  vatAmount: number;
  totalAmount: number;
  discountAmount: number;
}

@Injectable()
export class BaseInvoiceEngineService {
  /**
   * Chuẩn hóa số hóa đơn: loại bỏ các số 0 thừa ở đầu cụm số cuối cùng.
   * Ví dụ: `0001234` -> `1234`, `AB-00045` -> `AB-45`.
   */
  normalizeInvoiceNo(raw: string | null | undefined): string | null {
    if (!raw) return null;
    return raw.trim().replace(/(^|[^0-9])0+([0-9]+)([^0-9]*)$/, '$1$2$3');
  }

  /**
   * Tự động bóc tách số quyết toán (settlement_order) và biển số xe (license_plate)
   * từ diễn giải, ghi chú và các dòng hàng hóa đơn.
   */
  extractInvoiceMetadata(target: IInvoiceMetadataTarget): {
    settlementOrder: string | null;
    licensePlate: string | null;
  } {
    const fullDesc = [
      target.description,
      target.notes,
      ...(target.items || []).map((i) => i?.description),
    ]
      .filter(Boolean)
      .join(' | ');

    let settlementOrder: string | null = null;
    let licensePlate: string | null = null;

    // Trích xuất Lệnh quyết toán (-WO- hoặc GR-)
    const woMatch = fullDesc.match(/(\S*-WO-\S*|GR-\S*)/i);
    if (woMatch) {
      let wo = woMatch[0];
      if (wo.toUpperCase().startsWith('QT')) {
        wo = wo.substring(2);
      }
      settlementOrder = wo;
      target.settlementOrder = wo;
    }

    // Trích xuất Biển số xe (ví dụ: 50E82434, 50H-38666, 89A-482.19, 50F-090.80, v.v.)
    const plateMatch = fullDesc.match(
      /\b\d{2}[A-ZĐ][A-Z0-9]?[-.\s]?(?:\d{4,5}|\d{2,3}[-.\s]\d{2,3})\b/i,
    );
    if (plateMatch) {
      licensePlate = plateMatch[0].trim().replace(/\.$/, '');
      target.licensePlate = licensePlate;
    }

    return { settlementOrder, licensePlate };
  }

  /**
   * Tính toán tổng tiền trước thuế, tiền thuế VAT, chiết khấu và tổng thanh toán từ danh sách dòng hàng.
   */
  calculateTotals(
    items: {
      preVatAmount?: number | string | null;
      vatAmount?: number | string | null;
      totalAmount?: number | string | null;
      discountAmount?: number | string | null;
    }[] = [],
  ): IInvoiceTotalsResult {
    let preVatAmount = 0;
    let vatAmount = 0;
    let totalAmount = 0;
    let discountAmount = 0;

    for (const item of items) {
      preVatAmount += Number(item.preVatAmount || 0);
      vatAmount += Number(item.vatAmount || 0);
      discountAmount += Number(item.discountAmount || 0);
      totalAmount += Number(item.totalAmount || 0);
    }

    return {
      preVatAmount: Math.round(preVatAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
    };
  }

  /**
   * Kiểm tra tính hợp lệ khi thao tác với hóa đơn theo trạng thái ghi sổ kế toán.
   */
  validatePostingTransition(
    postingStatus: string,
    action: 'change_branch' | 'delete' | 'update',
  ): void {
    if (postingStatus === 'POSTED') {
      if (action === 'change_branch') {
        throw new BadRequestException(
          'Không thể thay đổi chi nhánh của hóa đơn đã được ghi sổ kế toán (POSTED)',
        );
      }
      if (action === 'delete') {
        throw new BadRequestException(
          'Không thể xóa hóa đơn đã được ghi sổ kế toán (POSTED)',
        );
      }
    }
  }

  /**
   * Chuẩn hóa Đơn Vị Tính (UOM) sang chuẩn viết thường/viết hoa quy ước.
   */
  normalizeUom(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return trimmed;
  }
}
