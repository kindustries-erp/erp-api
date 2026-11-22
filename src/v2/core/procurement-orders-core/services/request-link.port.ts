import { EntityManager } from 'typeorm';

export interface RequestLineItem {
  requestLineId: string;
  qty: number;
  /** Loại dòng của PO; PR kiểm tra khớp với dòng nguồn khi đặt hàng. */
  lineType?: 'GOODS' | 'SERVICE';
}

/**
 * Cổng để lõi PO giữ và trả số lượng trên PR nguồn, không import lõi PR.
 * Module mỏng cài đặt cổng này bằng service của đúng họ (thường hoặc Garage).
 * Mọi lời gọi đều chạy trong transaction của PO.
 */
export interface RequestLinkPort {
  reserve(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
  ): Promise<void>;
  release(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
  ): Promise<void>;
}
