import { extractInvoiceMetadata } from './invoice-metadata.helper';

/**
 * Quy tắc sở hữu field khi đồng bộ chi tiết từ Cổng Thuế GDT.
 * Field GDT-owned được ghi đè; field ERP tự quản không bao giờ bị động tới.
 */
export const PORTAL_OWNED_HEADER_FIELDS = [
  'sellerName',
  'sellerAddress',
  'buyerName',
  'buyerAddress',
  'buyerPersonalName',
  'buyerCccd',
  'buyerTaxCode',
  'description',
  'preVatAmount',
  'vatAmount',
  'discountAmount',
  'totalAmount',
  'taxInvoiceStatus',
  'taxProcessStatus',
] as const;

export const PORTAL_OWNED_ITEM_FIELDS = [
  'description',
  'unit',
  'quantity',
  'unitPrice',
  'preVatAmount',
  'vatRate',
  'vatAmount',
  'discountAmount',
  'totalAmount',
] as const;

export type PortalOwnedHeaderField =
  (typeof PORTAL_OWNED_HEADER_FIELDS)[number];
export type PortalOwnedItemField = (typeof PORTAL_OWNED_ITEM_FIELDS)[number];

export type PortalOwnedPatch<TField extends string> = Partial<
  Record<TField, unknown>
>;

export interface ItemMatchKey {
  description?: string | null;
}

export interface ItemMatchResult<TItem extends ItemMatchKey> {
  updates: { id: string; patch: PortalOwnedPatch<PortalOwnedItemField> }[];
  inserts: TItem[];
  deletes: string[];
}

/** So sánh giá trị: numeric so theo số để "1000.00" và 1000 coi là bằng nhau. */
function isSameValue(current: unknown, next: unknown): boolean {
  if (current == null || next == null) {
    return current == null && next == null;
  }
  if (typeof next === 'number') {
    const a = Number(current);
    if (Number.isFinite(a)) return a === next;
  }
  return toText(current) === toText(next);
}

function toText(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

/** Chỉ lấy field GDT-owned có giá trị và khác bản ghi hiện tại. GDT thiếu field thì không xóa dữ liệu cũ. */
function buildOwnedPatch<TField extends string>(
  current: object,
  next: object,
  ownedFields: readonly TField[],
): PortalOwnedPatch<TField> {
  const currentValues = current as Record<string, unknown>;
  const nextValues = next as Record<string, unknown>;
  const patch: PortalOwnedPatch<TField> = {};
  for (const field of ownedFields) {
    const value = nextValues[field];
    if (value === undefined || value === null) continue;
    if (isSameValue(currentValues[field], value)) continue;
    patch[field] = value;
  }
  return patch;
}

export function buildPortalHeaderPatch(
  current: object,
  portalHeader: object,
): PortalOwnedPatch<PortalOwnedHeaderField> {
  return buildOwnedPatch(current, portalHeader, PORTAL_OWNED_HEADER_FIELDS);
}

export function buildPortalItemPatch(
  current: object,
  portalItem: object,
): PortalOwnedPatch<PortalOwnedItemField> {
  return buildOwnedPatch(current, portalItem, PORTAL_OWNED_ITEM_FIELDS);
}

/** Khóa ghép dòng hàng: mô tả đã chuẩn hóa khoảng trắng và chữ hoa/thường. */
export function normalizeItemKey(
  description: string | null | undefined,
): string {
  return (description ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Ghép dòng hàng GDT với dòng hàng đang có theo mô tả.
 * Cùng mô tả thì ghép theo thứ tự xuất hiện (dòng trùng mô tả giữ đúng vị trí tương đối).
 * Dòng khớp giữ nguyên id; dòng GDT không khớp thành insert; dòng cũ không khớp thành delete.
 */
export function matchPortalItems<
  TExisting extends ItemMatchKey & { id: string },
  TItem extends ItemMatchKey,
>(existingItems: TExisting[], portalItems: TItem[]): ItemMatchResult<TItem> {
  const pendingByKey = new Map<string, TExisting[]>();
  for (const item of existingItems) {
    const key = normalizeItemKey(item.description);
    const queue = pendingByKey.get(key) ?? [];
    queue.push(item);
    pendingByKey.set(key, queue);
  }

  const updates: ItemMatchResult<TItem>['updates'] = [];
  const inserts: TItem[] = [];
  const matchedIds = new Set<string>();

  for (const portalItem of portalItems) {
    const queue = pendingByKey.get(normalizeItemKey(portalItem.description));
    const existing = queue?.shift();
    if (!existing) {
      inserts.push(portalItem);
      continue;
    }
    matchedIds.add(existing.id);
    const patch = buildPortalItemPatch(existing, portalItem);
    if (Object.keys(patch).length > 0) {
      updates.push({ id: existing.id, patch });
    }
  }

  const deletes = existingItems
    .filter((item) => !matchedIds.has(item.id))
    .map((item) => item.id);

  return { updates, inserts, deletes };
}

/**
 * Suy ra settlementOrder/licensePlate từ diễn giải, ghi chú, dòng hàng.
 * Chỉ điền khi bản ghi đang rỗng để không ghi đè giá trị người dùng đã sửa.
 */
export function buildMetadataFillPatch(
  invoice: {
    description?: string | null;
    notes?: string | null;
    settlementOrder?: string | null;
    licensePlate?: string | null;
  },
  items: { description?: string | null }[],
): { settlementOrder?: string; licensePlate?: string } {
  const probe: Record<string, unknown> = {
    description: invoice.description,
    notes: invoice.notes,
    items,
  };
  extractInvoiceMetadata(probe);

  const patch: { settlementOrder?: string; licensePlate?: string } = {};
  if (!invoice.settlementOrder && typeof probe.settlementOrder === 'string') {
    patch.settlementOrder = probe.settlementOrder;
  }
  if (!invoice.licensePlate && typeof probe.licensePlate === 'string') {
    patch.licensePlate = probe.licensePlate;
  }
  return patch;
}
