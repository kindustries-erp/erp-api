/**
 * vietnam-invoice-xml.parser.ts
 *
 * Multi-strategy parser cho hóa đơn điện tử Việt Nam.
 * Hỗ trợ nhiều nguồn: VNPT (TT78), Viettel SInvoice, Vinfast/Latin format, Generic fallback.
 * Không dùng thư viện ngoài — sử dụng Node.js built-in DOMParser.
 */

export interface ParsedVietnamInvoiceItem {
  description: string;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  preVatAmount: number;
  vatRate: number | null;
  vatAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface ParsedVietnamInvoice {
  invoiceNo: string;
  serialNo: string | null;
  invoiceDate: string; // YYYY-MM-DD
  sellerName: string | null;
  sellerTaxCode: string | null;
  sellerAddress: string | null;
  sellerBank: string | null;
  buyerName: string | null;
  buyerTaxCode: string | null;
  buyerAddress: string | null;
  description: string | null;
  preVatAmount: number;
  vatRate: number | null;
  vatAmount: number;
  discountAmount: number;
  totalAmount: number;
  lookupCode: string | null;
  providerLink: string | null;
  rawSource: string; // 'TT78' | 'SINVOICE_V2' | 'VINFAST' | 'GENERIC'
  items: ParsedVietnamInvoiceItem[];
}

export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XmlParseError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getText(doc: Document, ...tags: string[]): string | null {
  for (const tag of tags) {
    // Thử theo tên tag thuần (không namespace)
    const els = doc.getElementsByTagName(tag);
    if (els.length > 0 && els[0].textContent?.trim()) {
      return els[0].textContent.trim();
    }
  }
  return null;
}

function getTextIn(parent: Element | null, ...tags: string[]): string | null {
  if (!parent) return null;
  for (const tag of tags) {
    const els = parent.getElementsByTagName(tag);
    if (els.length > 0 && els[0].textContent?.trim()) {
      return els[0].textContent.trim();
    }
  }
  return null;
}

function toNum(val: string | null | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[,\s]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Chuẩn hóa ngày về YYYY-MM-DD
 * Hỗ trợ: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, YYYYMMDD, ISO timestamp
 */
function normalizeDate(raw: string | null): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const s = raw.trim();

  // ISO: YYYY-MM-DD... hoặc YYYY-MM-DDTHH:...
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY hoặc D/M/YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  return new Date().toISOString().slice(0, 10);
}

function extractLookupInfo(
  doc: Document,
  sellerTaxCode: string | null,
): { lookupCode: string | null; providerLink: string | null } {
  let lookupCode: string | null = null;
  let providerLink: string | null = null;

  // Scan <TTKhac> blocks
  const ttkhacs = doc.getElementsByTagName('TTKhac');
  for (let i = 0; i < ttkhacs.length; i++) {
    const parent = ttkhacs[i];
    const ttins = parent.getElementsByTagName('TTin');
    for (let j = 0; j < ttins.length; j++) {
      const ttin = ttins[j];
      const truong = getTextIn(ttin, 'TTruong', 'Ten');
      const lowerTruong = (truong || '').toLowerCase();
      if (
        lowerTruong === 'matracuu' ||
        lowerTruong === 'transactionid' ||
        lowerTruong === 'macuutra' ||
        lowerTruong === 'mã tra cứu' ||
        lowerTruong === 'refid'
      ) {
        const value = getTextIn(ttin, 'DLieu', 'KDLieu'); // sometimes DLieu, sometimes they place it differently
        // Wait, standard is <TTruong>MaTraCuu</TTruong><DLieu>123</DLieu>
        const exactValue =
          getTextIn(ttin, 'DLieu') || getTextIn(ttin, 'GiaTri');
        if (exactValue && exactValue !== 'string') lookupCode = exactValue;
      }
    }
  }

  // Guess provider link
  if (sellerTaxCode === '0108926276') {
    // Vinfast
    providerLink = 'https://hoadon.vinfastauto.com/';
  }

  // Generic heuristic for provider link if we know the tags
  if (!providerLink) {
    if (doc.getElementsByTagName('inv:HDon').length > 0) {
      providerLink = 'https://sinvoice.viettel.vn/tracuuhoadon';
    } else if (doc.documentElement.namespaceURI?.includes('vnpt')) {
      providerLink = 'https://hoadondientu.vnpt.vn/';
    } else if (
      doc.documentElement.namespaceURI?.includes('misa') ||
      getText(doc, 'InvoiceTemplateID')
    ) {
      providerLink = 'https://www.meinvoice.vn/tra-cuu/';
    }
  }

  return { lookupCode, providerLink };
}

// ---------------------------------------------------------------------------
// Strategy 1: TT78 — Thông tư 78/2021 (VNPT, hầu hết NCC Việt Nam)
// Tag: <HDon> / <TTChung> / <NDHDon>
// ---------------------------------------------------------------------------
function parseTT78(doc: Document): ParsedVietnamInvoice | null {
  const ttchung =
    doc.getElementsByTagName('TTChung')[0] ??
    doc.getElementsByTagName('ttchung')[0];
  const ndhdon =
    doc.getElementsByTagName('NDHDon')[0] ??
    doc.getElementsByTagName('ndhdon')[0];

  if (!ttchung && !ndhdon) return null;

  const invoiceNo =
    getTextIn(ttchung, 'SHDon', 'shdon') ?? getTextIn(doc as any, 'SHDon');
  if (!invoiceNo) return null;

  const serialNo = getTextIn(ttchung, 'KHHDon', 'khhdon') ?? null;
  const dateRaw =
    getTextIn(ttchung, 'NLap', 'nlap') ?? getTextIn(ttchung, 'NHDon', 'nhdon');

  // Bên bán
  const nban =
    ndhdon?.getElementsByTagName('NBan')[0] ??
    ndhdon?.getElementsByTagName('nban')[0] ??
    doc.getElementsByTagName('NBan')[0];
  const sellerName = getTextIn(nban ?? null, 'Ten', 'ten') ?? null;
  const sellerTaxCode = getTextIn(nban ?? null, 'MST', 'mst') ?? null;
  const sellerAddress = getTextIn(nban ?? null, 'DChi', 'dchi') ?? null;
  const sellerBank =
    getTextIn(nban ?? null, 'STKNHang', 'stknhang') ??
    getTextIn(nban ?? null, 'TKNHang', 'tknhang') ??
    null;

  // Bên mua
  const nmua =
    ndhdon?.getElementsByTagName('NMua')[0] ??
    ndhdon?.getElementsByTagName('nmua')[0] ??
    doc.getElementsByTagName('NMua')[0];
  const buyerName = getTextIn(nmua ?? null, 'Ten', 'ten') ?? null;
  const buyerTaxCode = getTextIn(nmua ?? null, 'MST', 'mst') ?? null;
  const buyerAddress = getTextIn(nmua ?? null, 'DChi', 'dchi') ?? null;

  // Tài chính
  const ttoan =
    ndhdon?.getElementsByTagName('TToan')[0] ??
    doc.getElementsByTagName('TToan')[0];
  const preVatRaw =
    getTextIn(ttoan ?? null, 'THTTHDTTLTruocThue', 'thtthddtttltruocthue') ??
    getTextIn(ttoan ?? null, 'TgTCThue', 'tgtcthue') ??
    getTextIn(ttoan ?? null, 'TongTienHangTruocThue') ??
    null;
  const vatRateRaw = getTextIn(ttoan ?? null, 'TSuat', 'tsuat') ?? null;
  const vatAmtRaw =
    getTextIn(ttoan ?? null, 'TThue', 'tthue') ??
    getTextIn(ttoan ?? null, 'TgTThue', 'tgtthue') ??
    null;
  const totalRaw =
    getTextIn(ttoan ?? null, 'THTTHDTTLTSauThue', 'thtthddtttltsauthue') ??
    getTextIn(ttoan ?? null, 'TgTTTBSo', 'tgtttbso') ??
    getTextIn(ttoan ?? null, 'TongTienThanhToan') ??
    null;
  const discountRaw =
    getTextIn(ttoan ?? null, 'TgTChietKhau', 'tgtchietkhau') ?? null;

  // Items array
  const items: ParsedVietnamInvoiceItem[] = [];
  const hhdvus =
    ndhdon?.getElementsByTagName('HHDVu') ?? doc.getElementsByTagName('HHDVu');
  for (let i = 0; i < hhdvus.length; i++) {
    const el = hhdvus[i];
    const desc = getTextIn(el, 'THHDVu', 'thhhdvu', 'Ten', 'ten') ?? '';
    const unit = getTextIn(el, 'DVTinh', 'dvtinh') ?? null;
    const quantity = getTextIn(el, 'SLuong', 'sluong')
      ? toNum(getTextIn(el, 'SLuong', 'sluong'))
      : null;
    const unitPrice = getTextIn(el, 'DGia', 'dgia')
      ? toNum(getTextIn(el, 'DGia', 'dgia'))
      : null;
    const preVat = toNum(getTextIn(el, 'ThTien', 'thtien'));
    const vatRateRawEl = getTextIn(el, 'TSuat', 'tsuat');
    let itemVatRate: number | null = null;
    if (vatRateRawEl) {
      const n = toNum(vatRateRawEl);
      itemVatRate = n > 1 ? n / 100 : n;
    }
    const vatAmt = toNum(getTextIn(el, 'TThue', 'tthue'));
    const discount = toNum(getTextIn(el, 'STCKhau', 'stckhau'));
    const total = preVat + vatAmt - discount;
    items.push({
      description: desc,
      unit,
      quantity,
      unitPrice,
      preVatAmount: preVat,
      vatRate: itemVatRate,
      vatAmount: vatAmt,
      discountAmount: discount,
      totalAmount: total,
    });
  }
  const description = items[0]?.description ?? null;

  // vatRate: chuẩn TT78 lưu dạng % (8, 10, ...) hoặc decimal (0.1)
  let vatRate: number | null = null;
  if (vatRateRaw) {
    const n = toNum(vatRateRaw);
    vatRate = n > 1 ? n / 100 : n; // normalize về dạng decimal
  }

  const { lookupCode, providerLink } = extractLookupInfo(doc, sellerTaxCode);

  return {
    invoiceNo,
    serialNo,
    invoiceDate: normalizeDate(dateRaw),
    sellerName,
    sellerTaxCode,
    sellerAddress,
    sellerBank,
    buyerName,
    buyerTaxCode,
    buyerAddress,
    description,
    preVatAmount: toNum(preVatRaw),
    vatRate,
    vatAmount: toNum(vatAmtRaw),
    discountAmount: toNum(discountRaw),
    totalAmount: toNum(totalRaw),
    lookupCode,
    providerLink,
    rawSource: 'TT78',
    items,
  };
}

// ---------------------------------------------------------------------------
// Strategy 2: SINVOICE_V2 — Viettel với namespace prefix (inv:HDon)
// ---------------------------------------------------------------------------
function parseSInvoiceV2(doc: Document): ParsedVietnamInvoice | null {
  // Namespace prefix stripped khi parse — getElementsByTagName hoạt động với local name
  // Detect bằng cách tìm namespace attribute hoặc prefix trong outerHTML
  const root = doc.documentElement;
  const hasNs =
    root.namespaceURI?.includes('einvoice') ||
    root.tagName.includes(':') ||
    !!doc.getElementsByTagName('inv:HDon')[0];

  if (!hasNs) {
    // Vẫn thử — một số SInvoice không có namespace rõ ràng
    const ttchung = doc.getElementsByTagName('TTChung')[0];
    if (!ttchung) return null;
  }

  // Logic tương tự TT78 — các tag giống nhau
  const result = parseTT78(doc);
  if (result) return { ...result, rawSource: 'SINVOICE_V2' };
  return null;
}

// ---------------------------------------------------------------------------
// Strategy 3: VINFAST / Latin format
// Tag: <Invoice> / <InvoiceNumber> / <SellerName>
// ---------------------------------------------------------------------------
function parseVinfast(doc: Document): ParsedVietnamInvoice | null {
  const invoiceEl =
    doc.getElementsByTagName('Invoice')[0] ??
    doc.getElementsByTagName('INVOICE')[0] ??
    doc.getElementsByTagName('invoice')[0];

  const root = invoiceEl ?? doc.documentElement;

  const invoiceNo =
    getTextIn(
      root,
      'InvoiceNumber',
      'invoiceNumber',
      'invoice_number',
      'InvoiceNo',
    ) ??
    getText(doc, 'InvoiceNumber', 'InvoiceNo') ??
    null;

  if (!invoiceNo) return null;

  const dateRaw =
    getTextIn(
      root,
      'InvoiceDate',
      'invoiceDate',
      'invoice_date',
      'IssueDate',
    ) ??
    getText(doc, 'InvoiceDate', 'IssueDate') ??
    null;

  const sellerName =
    getTextIn(
      root,
      'SellerName',
      'sellerName',
      'seller_name',
      'ProviderName',
    ) ?? null;
  const sellerTaxCode =
    getTextIn(
      root,
      'SellerTaxCode',
      'sellerTaxCode',
      'seller_tax_code',
      'SellerTIN',
    ) ?? null;
  const sellerAddress =
    getTextIn(root, 'SellerAddress', 'sellerAddress', 'seller_address') ?? null;
  const sellerBank =
    getTextIn(root, 'SellerBankAccount', 'sellerBank', 'SellerBankNo') ?? null;

  const buyerName =
    getTextIn(root, 'BuyerName', 'buyerName', 'buyer_name', 'CustomerName') ??
    null;
  const buyerTaxCode =
    getTextIn(
      root,
      'BuyerTaxCode',
      'buyerTaxCode',
      'buyer_tax_code',
      'BuyerTIN',
    ) ?? null;
  const buyerAddress =
    getTextIn(root, 'BuyerAddress', 'buyerAddress', 'buyer_address') ?? null;

  const preVatRaw =
    getTextIn(
      root,
      'AmountBeforeTax',
      'SubTotal',
      'PreTaxAmount',
      'TotalBeforeVAT',
    ) ?? null;
  const vatRateRaw = getTextIn(root, 'VATRate', 'TaxRate', 'vatRate') ?? null;
  const vatAmtRaw =
    getTextIn(root, 'VATAmount', 'TaxAmount', 'vatAmount') ?? null;
  const totalRaw =
    getTextIn(
      root,
      'TotalAmount',
      'GrandTotal',
      'AmountAfterTax',
      'TotalPayment',
    ) ?? null;
  const discountRaw = getTextIn(root, 'DiscountAmount', 'Discount') ?? null;
  const description =
    getTextIn(root, 'Description', 'ItemDescription', 'GoodName') ?? null;

  const items: ParsedVietnamInvoiceItem[] = [];
  const lines = root.getElementsByTagName('InvoiceLine');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const desc = getTextIn(line, 'ItemName', 'Description') ?? '';
    const unit = getTextIn(line, 'UnitName', 'Unit') ?? null;
    const quantity = getTextIn(line, 'Quantity')
      ? toNum(getTextIn(line, 'Quantity'))
      : null;
    const unitPrice = getTextIn(line, 'UnitPrice')
      ? toNum(getTextIn(line, 'UnitPrice'))
      : null;
    const preVat = toNum(getTextIn(line, 'AmountBeforeTax', 'TotalBeforeTax'));
    const vRateRaw = getTextIn(line, 'VATRate', 'TaxRate');
    let vRate: number | null = null;
    if (vRateRaw) {
      const n = toNum(vRateRaw);
      vRate = n > 1 ? n / 100 : n;
    }
    const vAmt = toNum(getTextIn(line, 'VATAmount', 'TaxAmount'));
    const disc = toNum(getTextIn(line, 'DiscountAmount'));
    items.push({
      description: desc,
      unit,
      quantity,
      unitPrice,
      preVatAmount: preVat,
      vatRate: vRate,
      vatAmount: vAmt,
      discountAmount: disc,
      totalAmount: preVat + vAmt - disc,
    });
  }

  let vatRate: number | null = null;
  if (vatRateRaw) {
    const n = toNum(vatRateRaw);
    vatRate = n > 1 ? n / 100 : n;
  }

  const { lookupCode, providerLink } = extractLookupInfo(doc, sellerTaxCode);

  return {
    invoiceNo,
    serialNo: getTextIn(root, 'SerialNo', 'serialNo', 'Series') ?? null,
    invoiceDate: normalizeDate(dateRaw),
    sellerName,
    sellerTaxCode,
    sellerAddress,
    sellerBank,
    buyerName,
    buyerTaxCode,
    buyerAddress,
    description,
    preVatAmount: toNum(preVatRaw),
    vatRate,
    vatAmount: toNum(vatAmtRaw),
    discountAmount: toNum(discountRaw),
    totalAmount: toNum(totalRaw),
    lookupCode,
    providerLink,
    rawSource: 'VINFAST',
    items,
  };
}

// ---------------------------------------------------------------------------
// Strategy 4: GENERIC fallback — heuristic scan
// ---------------------------------------------------------------------------
const SELLER_NAME_TAGS = [
  'seller_name',
  'SellerName',
  'NBanTen',
  'NguoiBan',
  'supplier',
  'Supplier',
];
const BUYER_NAME_TAGS = [
  'buyer_name',
  'BuyerName',
  'NMuaTen',
  'NguoiMua',
  'customer',
  'Customer',
];
const INVOICE_NO_TAGS = [
  'invoice_no',
  'InvoiceNo',
  'SoHoaDon',
  'SHDon',
  'documentNo',
  'document_no',
];
const TOTAL_TAGS = [
  'total_amount',
  'TotalAmount',
  'TongTien',
  'ThanhToan',
  'tong_tien',
];
const DATE_TAGS = [
  'invoice_date',
  'InvoiceDate',
  'NgayHoaDon',
  'NLap',
  'issue_date',
];

function parseGeneric(doc: Document): ParsedVietnamInvoice | null {
  const invoiceNo = getText(doc, ...INVOICE_NO_TAGS);
  if (!invoiceNo) return null;

  return {
    invoiceNo,
    serialNo: getText(doc, 'serial_no', 'SerialNo', 'KyHieu') ?? null,
    invoiceDate: normalizeDate(getText(doc, ...DATE_TAGS)),
    sellerName: getText(doc, ...SELLER_NAME_TAGS) ?? null,
    sellerTaxCode:
      getText(doc, 'seller_tax_code', 'SellerTaxCode', 'MaSoThueNBan') ?? null,
    sellerAddress: getText(doc, 'seller_address', 'SellerAddress') ?? null,
    sellerBank: getText(doc, 'seller_bank', 'SellerBank') ?? null,
    buyerName: getText(doc, ...BUYER_NAME_TAGS) ?? null,
    buyerTaxCode:
      getText(doc, 'buyer_tax_code', 'BuyerTaxCode', 'MaSoThueNMua') ?? null,
    buyerAddress: getText(doc, 'buyer_address', 'BuyerAddress') ?? null,
    description: getText(doc, 'description', 'Description', 'DienGiai') ?? null,
    preVatAmount: toNum(
      getText(doc, 'pre_vat_amount', 'PreVatAmount', 'TruocVat'),
    ),
    vatRate: null,
    vatAmount: toNum(getText(doc, 'vat_amount', 'VatAmount', 'TienThue')),
    discountAmount: toNum(getText(doc, 'discount_amount', 'DiscountAmount')),
    totalAmount: toNum(getText(doc, ...TOTAL_TAGS)),
    lookupCode: null,
    providerLink: null,
    rawSource: 'GENERIC',
    items: [],
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Parse XML hóa đơn điện tử — thử lần lượt các strategy.
 * Throw XmlParseError nếu không strategy nào thành công.
 */
export function parseVietnamInvoiceXml(
  xmlString: string,
): ParsedVietnamInvoice {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DOMParser } = require('@xmldom/xmldom') as {
    DOMParser: new () => {
      parseFromString(xml: string, mimeType: string): Document;
    };
  };

  let doc: Document;
  try {
    const parser = new DOMParser();

    doc = parser.parseFromString(xmlString, 'text/xml') as any as Document;

    // Kiểm tra lỗi parse cơ bản
    const parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) {
      throw new XmlParseError(
        `XML không hợp lệ: ${parseError.textContent?.slice(0, 200)}`,
      );
    }
  } catch (e) {
    if (e instanceof XmlParseError) throw e;
    throw new XmlParseError(`Không thể đọc file XML: ${(e as Error).message}`);
  }

  // Thử từng strategy
  const strategies: Array<
    [string, (d: Document) => ParsedVietnamInvoice | null]
  > = [
    ['TT78', parseTT78],
    ['SINVOICE_V2', parseSInvoiceV2],
    ['VINFAST', parseVinfast],
    ['GENERIC', parseGeneric],
  ];

  for (const [name, fn] of strategies) {
    try {
      const result = fn(doc);
      if (result) return result;
    } catch {
      // Strategy lỗi → thử tiếp
    }
  }

  throw new XmlParseError(
    `Không nhận dạng được định dạng XML hóa đơn. Đã thử: ${strategies.map(([n]) => n).join(', ')}`,
  );
}
