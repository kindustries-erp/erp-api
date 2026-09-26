import { Injectable, Logger } from '@nestjs/common';
import { NineRouterClient } from '../clients/nine-router.client';
import { jsonToToon } from '../helpers/json-to-toon.helper';

export interface ExtractedInvoiceItem {
  itemName: string;
  itemCode?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate?: number;
}

export interface ExtractedInvoiceResult {
  invoiceNumber?: string;
  invoiceDate?: string;
  sellerTaxCode?: string;
  sellerName?: string;
  buyerTaxCode?: string;
  buyerName?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  items: ExtractedInvoiceItem[];
  rawSummary?: string;
}

export interface ExtractedLicensePlateResult {
  licensePlate: string | null;
  formattedPlate: string | null;
  settlementOrder?: string | null;
  confidence: number;
  reason?: string;
}

export const VINFAST_TAX_CODES: readonly string[] = [
  '0108926276', // CÔNG TY TNHH KINH DOANH THƯƠNG MẠI VÀ DỊCH VỤ VINFAST
  '0202357718', // CÔNG TY CỔ PHẦN VINFAST VIỆT NAM
];

export interface ClassifyInvoiceCategoryResult {
  categoryCode: string | null;
  confidence: number;
  reason: string;
  isVfDirectMatch?: boolean;
}

export interface ClassifyLineItemInput {
  lineIndex: number;
  description?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  preVatAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  sellerName?: string;
  sellerTaxCode?: string;
  buyerName?: string;
}

export interface ClassifyLineItemResult {
  lineIndex: number;
  itemCode: string | null;
  itemType: 'PARTS' | 'SERVICE' | 'MATERIAL' | 'DISCOUNT' | 'OTHER';
  isDiscountDeduction: boolean;
  confidence: number;
  reason: string;
}

export interface ClassifyInvoiceInput {
  invoiceNo?: string;
  serialNo?: string;
  sellerName?: string;
  sellerTaxCode?: string;
  buyerName?: string;
  buyerTaxCode?: string;
  description?: string;
  notes?: string;
  totalAmount?: number;
  items?: Array<{
    description?: string;
    itemCode?: string;
    quantity?: number;
    unitPrice?: number;
    totalAmount?: number;
  }>;
}

@Injectable()
export class InvoiceAiHandler {
  private readonly logger = new Logger(InvoiceAiHandler.name);

  constructor(private readonly nineRouterClient: NineRouterClient) {}

  /**
   * Tự động phân loại hóa đơn đầu vào theo 14 nhóm chi phí chuẩn Thông Tư 99/2025/TT-BTC.
   * 1. Pre-check MST VinFast: Nếu trùng khớp 100% MST VinFast -> trả về ngay 'VF_PARTS' không tốn token AI.
   * 2. Gọi 9router AI (Tier low / Gemini 3.7 Flash) để phân loại nghiệp vụ chi tiết.
   * 3. Fallback an toàn: Nếu AI lỗi, timeout, hoặc confidence < 0.7 -> trả về categoryCode: null (hạch toán vào TK T0003).
   */
  async classifyInvoiceCategory(
    invoiceData: ClassifyInvoiceInput,
    tier: string = 'low',
    modelOverride?: string,
  ): Promise<ClassifyInvoiceCategoryResult> {
    const normTaxCode = String(invoiceData.sellerTaxCode || '')
      .replace(/\s+/g, '')
      .trim();

    // 1. Pre-check MST VinFast whitelist
    if (normTaxCode && VINFAST_TAX_CODES.includes(normTaxCode)) {
      return {
        categoryCode: 'VF_PARTS',
        confidence: 1.0,
        reason: `Khớp trực tiếp MST chính hãng VinFast (${normTaxCode})`,
        isVfDirectMatch: true,
      };
    }

    // 2. Chuẩn bị TOON input cho AI
    const toonData = jsonToToon({
      no: invoiceData.invoiceNo,
      serial: invoiceData.serialNo,
      sellerName: invoiceData.sellerName,
      sellerTaxCode: invoiceData.sellerTaxCode,
      buyerName: invoiceData.buyerName,
      desc: invoiceData.description,
      notes: invoiceData.notes,
      total: invoiceData.totalAmount,
      items: (invoiceData.items || []).slice(0, 30).map((it) => ({
        code: it.itemCode,
        name: it.description,
        qty: it.quantity,
        amount: it.totalAmount,
      })),
    });

    const systemPrompt = `Bạn là Giám đốc Kế toán kiêm Chuyên gia Phân loại Chi phí ERP Garage Ô tô Liouni theo Thông tư 99/2025/TT-BTC.
Nhiệm vụ: Đọc kỹ thông tin hóa đơn đầu vào (người bán, mô tả, mặt hàng) và phân loại vào ĐÚNG 1 TRONG 14 MÃ DANH MỤC SAU ĐÂY:

DANH SÁCH 14 MÃ DANH MỤC CHUẨN:
1. VF_PARTS: Phụ tùng chính hãng VinFast (CHỈ KHI người bán là VinFast hoặc các chi nhánh phân phối chính thức VF).
2. COMMERCIAL_VEHICLES: Mua xe ô tô thương mại / xe lướt (Porsche, Mercedes C200/C300, xe máy Vespa...).
3. OEM_OTHER_PARTS: Phụ tùng OEM & Các hãng xe khác (Lốp xe Michelin/Pirelli, ắc quy Varta/GS, bạc máy, rotuyn, má phanh, phụ tùng Toyota/Honda/Mazda...).
4. WORKSHOP_CONSUMABLES: Nguyên vật liệu & Tiêu hao xưởng (Sơn các màu, keo bóng 2K, chất đóng rắn, dung môi pha sơn, dầu nhớt Charger/Aisin, gas lạnh R134a, màng bọc nilong...).
5. GARAGE_SUBCONTRACT: Gia công ngoài & Thầu phụ kỹ thuật (Sửa vỏ pin EV Pin Toàn Cầu, phục hồi/sơn/nắn mâm lazang TNT/Krish, dịch vụ đồng sơn ngoài, cắt gọt cơ khí...).
6. GARAGE_TOOLS_EQUIPMENT: Máy móc, Thiết bị & CCDC xưởng (Súng siết bulong, máy nén khí, cẩu máy 2 tấn, kệ trung tải, tủ dụng cụ sửa chữa, hệ thống khí nén...).
7. OFFICE_IT_FACILITIES: Thiết bị CNTT, Camera & Nội thất VP (Laptop Dell/HP, camera Hikvision NVR, máy in Brother, máy chấm công, bàn ghế, bảng hiệu quảng cáo xưởng...).
8. OPEX_LOGISTICS: Giao nhận & Vận chuyển (Grab Express giao nhận phụ tùng cấp tốc, xe cứu hộ kéo xe 911, Viettel Post, dịch vụ bưu chính chuyển phát...).
9. OPEX_SECURITY_CLEANING: Bảo vệ, Vệ sinh & Môi trường (Bảo vệ Hoàng Thiên Hổ 24/7, vệ sinh văn phòng/xưởng Trí Đức Clean, thu gom rác thải công nghiệp Lê Mai, thuê mặt bằng xưởng...).
10. OPEX_BANK_FEES: Phí Ngân hàng & Dịch vụ Tài chính (Phí duy trì tài khoản Techcombank, phí chuyển tiền, phí máy POS, lãi vay ngân hàng...).
11. OPEX_ADMIN: Hành chính, Văn phòng phẩm & Nước uống (Giấy A4, bìa còng Lạc Dương, nước khoáng Biwase/Viva 19L tiếp khách & thợ, in ấn biểu mẫu tiếp nhận xe...).
12. OPEX_LEGAL_CONSULTING: Tư vấn Pháp lý & Kế toán BCTC (Phí dịch vụ kế toán BCTC W&A, tư vấn luật Wellspring, thủ tục chi nhánh, tiếp khách đối tác...).
13. OPEX_IT_SOFTWARE: Phần mềm Garage (KGARA), Email & 4G (Bản quyền phần mềm KGARA, Email doanh nghiệp Phát Thành Đạt, internet cáp quang xưởng, sim 4G...).
14. OPEX_MARKETING: Tiếp thị, Video & Quà tặng (Âm thanh sự kiện khai trương SO Events, video quảng cáo Hydra, quà tặng bình giữ nhiệt/bút bi tri ân, bánh trung thu...).

QUY TẮC PHÂN LOẠI QUAN TRỌNG:
- Grab Express, Grab Taxi, Viettel Post, Cứu hộ 911 -> BẮT BUỘC là OPEX_LOGISTICS.
- Sơn xe, keo bóng 2K, dung môi, dầu nhớt -> BẮT BUỘC là WORKSHOP_CONSUMABLES.
- Phục hồi lazang, sửa pin, gia công ngoài -> BẮT BUỘC là GARAGE_SUBCONTRACT.
- Thiết bị/máy móc xưởng -> GARAGE_TOOLS_EQUIPMENT; Laptop/Camera/Nội thất -> OFFICE_IT_FACILITIES.
- Phí ngân hàng -> OPEX_BANK_FEES; Nước uống Viva/Biwase, giấy in -> OPEX_ADMIN.

Chỉ trả về DUY NHẤT một JSON hợp lệ:
{
  "categoryCode": "VF_PARTS" | "COMMERCIAL_VEHICLES" | "OEM_OTHER_PARTS" | "WORKSHOP_CONSUMABLES" | "GARAGE_SUBCONTRACT" | "GARAGE_TOOLS_EQUIPMENT" | "OFFICE_IT_FACILITIES" | "OPEX_LOGISTICS" | "OPEX_SECURITY_CLEANING" | "OPEX_BANK_FEES" | "OPEX_ADMIN" | "OPEX_LEGAL_CONSULTING" | "OPEX_IT_SOFTWARE" | "OPEX_MARKETING",
  "confidence": number (từ 0.0 đến 1.0),
  "reason": "Giải thích ngắn gọn lý do phân loại"
}`;

    const userPrompt = `Thông tin hóa đơn đầu vào (TOON format):\n${toonData}`;

    try {
      const completion = await this.nineRouterClient.complete({
        model: modelOverride || tier,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.0,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      return this.parseClassificationResult(content);
    } catch (err: any) {
      this.logger.warn(
        `AI classify invoice failed for invoice ${invoiceData.invoiceNo}: ${err?.message}`,
      );
      return {
        categoryCode: null,
        confidence: 0,
        reason: `AI Failure: ${err?.message || 'Unknown error'}`,
      };
    }
  }

  private parseClassificationResult(
    text: string,
  ): ClassifyInvoiceCategoryResult {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(clean);

      const validCodes = [
        'VF_PARTS',
        'COMMERCIAL_VEHICLES',
        'OEM_OTHER_PARTS',
        'WORKSHOP_CONSUMABLES',
        'GARAGE_SUBCONTRACT',
        'GARAGE_TOOLS_EQUIPMENT',
        'OFFICE_IT_FACILITIES',
        'OPEX_LOGISTICS',
        'OPEX_SECURITY_CLEANING',
        'OPEX_BANK_FEES',
        'OPEX_ADMIN',
        'OPEX_LEGAL_CONSULTING',
        'OPEX_IT_SOFTWARE',
        'OPEX_MARKETING',
      ];

      const categoryCode = validCodes.includes(parsed.categoryCode)
        ? parsed.categoryCode
        : null;
      const confidence =
        typeof parsed.confidence === 'number' ? parsed.confidence : 0;

      // Safe threshold check: confidence >= 0.7 required
      if (confidence < 0.7 || !categoryCode) {
        return {
          categoryCode: null,
          confidence,
          reason:
            parsed.reason || 'Confidence under 0.7 or invalid category code',
        };
      }

      return {
        categoryCode,
        confidence,
        reason: parsed.reason || 'Classified by 9router AI',
      };
    } catch (e) {
      this.logger.warn(
        `Failed to parse classification JSON: ${text.slice(0, 200)}`,
      );
      return {
        categoryCode: null,
        confidence: 0,
        reason: 'Unparseable AI response JSON',
      };
    }
  }

  /**
   * Extract vehicle license plate from invoice description and line items using TOON format
   */
  async extractLicensePlate(
    invoiceData: {
      invoiceNo?: string;
      serialNo?: string;
      invoiceDate?: string;
      buyerName?: string;
      description?: string;
      notes?: string;
      items?: Array<{
        description: string;
        quantity?: number;
        totalAmount?: number;
      }>;
    },
    tier: string = 'low',
    modelOverride?: string,
  ): Promise<ExtractedLicensePlateResult> {
    const toonData = jsonToToon({
      no: invoiceData.invoiceNo,
      serial: invoiceData.serialNo,
      date: invoiceData.invoiceDate,
      buyer: invoiceData.buyerName,
      desc: invoiceData.description,
      notes: invoiceData.notes,
      items: (invoiceData.items || []).map((it) => ({
        name: it.description,
        qty: it.quantity,
        amount: it.totalAmount,
      })),
    });

    const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu hóa đơn của hệ thống ERP Garage Ô tô.
Nhiệm vụ: Đọc kỹ dữ liệu hóa đơn (được định dạng theo chuẩn TOON - Token-Oriented Object Notation) và trích xuất BIỂN SỐ XE cơ giới Việt Nam (nếu có).

Quy tắc nhận diện biển số xe:
- Định dạng chuẩn biển số Việt Nam: 2 chữ số tỉnh thành + 1-2 chữ cái (A-Z, Đ) + 4-5 chữ số (VD: 50F-090.80, 50H-319.73, 51D-888.01, 70H-094.82, 34A-674.52, 51N-015.34, 50H-315.42...).
- Lệnh quyết toán / Số phiếu dịch vụ (nếu có): VD GR-PDV2609-0005, 52801-WO-26-02-05-029...
- Nếu không có biển số xe trong bất kỳ dòng text nào, trả về null.

Chỉ trả về DUY NHẤT một JSON hợp lệ:
{
  "licensePlate": string | null,
  "formattedPlate": string | null,
  "settlementOrder": string | null,
  "confidence": number,
  "reason": string
}`;

    const userPrompt = `Dữ liệu hóa đơn (TOON format):\n${toonData}`;

    const completion = await this.nineRouterClient.complete({
      model: modelOverride || tier,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.0,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return this.parsePlateResult(content);
  }

  async extractInvoiceData(
    invoiceText: string,
    tier: string = 'medium',
    modelOverride?: string,
  ): Promise<ExtractedInvoiceResult> {
    const systemPrompt = `Bạn là chuyên gia trích xuất dữ liệu hóa đơn tài chính của hệ thống ERP. 
Nhiệm vụ của bạn là đọc nội dung hóa đơn (text/OCR) và chuyển đổi thành một đối tượng JSON chuẩn duy nhất theo schema:
{
  "invoiceNumber": string,
  "invoiceDate": "YYYY-MM-DD",
  "sellerTaxCode": string,
  "sellerName": string,
  "buyerTaxCode": string,
  "buyerName": string,
  "subtotal": number,
  "taxAmount": number,
  "totalAmount": number,
  "items": [
    {
      "itemName": string,
      "itemCode": string,
      "unit": string,
      "quantity": number,
      "unitPrice": number,
      "amount": number,
      "vatRate": number
    }
  ]
}
Chỉ trả về định dạng JSON hợp lệ, không bọc markdown hay thêm bất kỳ lời giải thích nào.`;

    const userPrompt = `Nội dung hóa đơn cần xử lý:\n${invoiceText}`;

    const completion = await this.nineRouterClient.complete({
      model: modelOverride || tier,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return this.parseJsonResult(content);
  }

  private parseJsonResult(text: string): ExtractedInvoiceResult {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(clean);
    } catch (e) {
      this.logger.warn(
        `Failed to parse extracted invoice JSON: ${text.slice(0, 200)}`,
      );
      return {
        items: [],
        rawSummary: text,
      };
    }
  }

  private parsePlateResult(text: string): ExtractedLicensePlateResult {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(clean);
      return {
        licensePlate: parsed.licensePlate || null,
        formattedPlate: parsed.formattedPlate || parsed.licensePlate || null,
        settlementOrder: parsed.settlementOrder || null,
        confidence:
          typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
        reason: parsed.reason || '',
      };
    } catch (e) {
      this.logger.warn(
        `Failed to parse license plate JSON: ${text.slice(0, 200)}`,
      );
      return {
        licensePlate: null,
        formattedPlate: null,
        settlementOrder: null,
        confidence: 0,
        reason: text,
      };
    }
  }

  /**
   * Phân loại chi tiết từng dòng hàng hóa/dịch vụ trên hóa đơn bằng AI (9router Gateway).
   * Hỗ trợ trích xuất cả mã phụ tùng VinFast chính hãng, cứu hộ, chiết khấu, thầu phụ, tiện ích, vật tư.
   */
  async classifyInvoiceLineItemsWithAi(
    items: ClassifyLineItemInput[],
    tier: string = 'low',
    modelOverride?: string,
  ): Promise<ClassifyLineItemResult[]> {
    if (!items || items.length === 0) return [];

    const toonData = jsonToToon({
      lines: items.map((it) => ({
        idx: it.lineIndex,
        desc: it.description,
        unit: it.unit,
        qty: it.quantity,
        price: it.unitPrice,
        preVat: it.preVatAmount,
        disc: it.discountAmount,
        seller: it.sellerName,
        sellerTax: it.sellerTaxCode,
      })),
    });

    const systemPrompt = `Bạn là Chuyên gia Master Data & Kế toán Trưởng ERP Garage Ô tô.
Nhiệm vụ: Đọc thông tin chi tiết từng dòng hàng hóa/dịch vụ trên hóa đơn đầu vào và gán MÃ HÀNG CHUẨN HÓA CÓ TIỀN TỐ (item_code), LOẠI MẶT HÀNG (item_type) và XÁC ĐỊNH TÍNH CHẤT GIẢM TRỪ (isDiscountDeduction).

HỆ THỐNG TIỀN TỐ (PREFIX TAXONOMY) BẮT BUỘC:

1. PHỤ TÙNG VINFAST (BẮT BUỘC TIỀN TỐ "VF-"):
   - Tìm và trích xuất Part Number của VinFast rồi thêm tiền tố "VF-":
     + "BIW20002460 - ĐỆM_CAO_SU_TAY_NẮM" -> item_code: "VF-BIW20002460", item_type: "PARTS"
     + "CHS20000814 - LỐP XE" -> item_code: "VF-CHS20000814", item_type: "PARTS"
     + "EEP30032001 - ẮC QUY 12V" -> item_code: "VF-EEP30032001", item_type: "PARTS"
     + "VF5_HV_BATTERY_PACK_38_KWH" -> item_code: "VF-EEP73110011AP", item_type: "PARTS"
     + "HV_BATTERY_41.9KWH" hoặc "BAT21001011" -> item_code: "VF-BAT21001011", item_type: "PARTS"
     + "ĐỘNG CƠ ĐIỆN BẢO HÀNH" -> item_code: "VF-PVT20030000", item_type: "PARTS"
     + "106206 - Đệm cao su" -> item_code: "VF-106206", item_type: "PARTS"

2. PHỤ TÙNG OEM / CÁC HÃNG XE KHÁC (BẮT BUỘC TIỀN TỐ "PT-"):
   - Trích xuất Part Number của nhà sản xuất (Kia, Hyundai, Toyota, Mercedes, Denso...) rồi thêm tiền tố "PT-":
     + "0K95K15909 Phớt đuôi trục cơ" -> item_code: "PT-0K95K15909", item_type: "PARTS"
     + "214432B020 Phớt láp" -> item_code: "PT-214432B020", item_type: "PARTS"
     + "Lốp xe Michelin 225/60R17" -> item_code: "PT-225/60R17", item_type: "PARTS"
     + "97701-Q6400 Máy nén lốc lạnh" -> item_code: "PT-97701-Q6400", item_type: "PARTS"
     + "A2055018201 Ống nước làm mát" -> item_code: "PT-A2055018201", item_type: "PARTS"
     + Phụ tùng chung không có mã -> item_code: "PT-CHUNG", item_type: "PARTS"

3. VẬT TƯ TIÊU HAO XƯỞNG (BẮT BUỘC NHÓM "VT-*"):
   - Sơn, keo bóng 2K, chất đóng rắn, dung môi pha sơn -> item_code: "VT-SON", item_type: "MATERIAL"
   - Gas lạnh điều hòa R134a, R1234yf -> item_code: "VT-GAS", item_type: "MATERIAL"
   - Dầu động cơ, dầu nhớt, dầu hộp số, mỡ bôi trơn -> item_code: "VT-DAU-NHOT", item_type: "MATERIAL"
   - Keo dán kính, keo silicon A500, keo AB, keo ron -> item_code: "VT-KEO", item_type: "MATERIAL"
   - Nước làm mát động cơ, chất tẩy sơn, nước rửa kính, tẩy rỉ -> item_code: "VT-HOACHAT", item_type: "MATERIAL"
   - Toàn bộ vật tư tiêu hao phụ xưởng (giấy nhám các loại P180-P1200, giẻ lau, băng keo giấy 3M, bạt nilong phủ xe, phễu lọc sơn, lon pha, găng tay nitrile, quần áo bảo hộ thợ, bóng đèn/dây điện xưởng) -> item_code: "VT-TIEU-HAO", item_type: "MATERIAL"

4. CỨU HỘ & CẨU KÉO XE (BẮT BUỘC "DV-CUUHO"):
   - Cước kéo xe, chở xe, cẩu xe cứu hộ giao thông (Vân Sơn, 911, địa phương...) -> item_code: "DV-CUUHO", item_type: "SERVICE", isDiscountDeduction: false.

5. CƯỚC VẬN CHUYỂN & CHUYỂN PHÁT NHANH (BẮT BUỘC "DV-VANCHUYEN"):
   - Cước Grab Express ship phụ tùng, Viettel Post chuyển phát nhanh -> item_code: "DV-VANCHUYEN", item_type: "SERVICE", isDiscountDeduction: false.

6. GIA CÔNG & SỬA CHỮA NGOÀI (BẮT BUỘC "DV-GIACONG" / "DV-SUACHUA"):
   - Tiện mâm, hàn lazang, phục hồi mâm ô tô -> item_code: "DV-GIACONG-MAM", item_type: "SERVICE"
   - Phục hồi thước lái, tiện đĩa thắng -> item_code: "DV-GIACONG-THUOCLAI", item_type: "SERVICE"
   - Gia công cơ khí chung khác -> item_code: "DV-GIACONG", item_type: "SERVICE"
   - Sửa chữa củ đề, phục hồi vỏ pin, công thợ thuê ngoài -> item_code: "DV-SUACHUA", item_type: "SERVICE"

7. DỊCH VỤ TIỆN ÍCH QUẢN TRỊ (BẮT BUỘC "DV-*"):
   - Phí dịch vụ bảo vệ an ninh -> item_code: "DV-BAOVE", item_type: "SERVICE"
   - Vệ sinh công nghiệp xưởng/VP, rác thải -> item_code: "DV-VESINH", item_type: "SERVICE"
   - Dịch vụ tư vấn kế toán, pháp lý -> item_code: "DV-TUVAN", item_type: "SERVICE"
   - Phần mềm, internet, sim 4G -> item_code: "DV-IT", item_type: "SERVICE"
   - In ấn biểu mẫu, quảng cáo -> item_code: "DV-INAN", item_type: "SERVICE"

8. CHIẾT KHẤU & GIẢM GIÁ (BẮT BUỘC "CK-*", LÀ PHÉP TRỪ):
   - Chiết khấu từ GRAB -> item_code: "CK-GRAB", item_type: "DISCOUNT", isDiscountDeduction: true
   - Chiết khấu từ GSM (Xanh SM) -> item_code: "CK-GSM", item_type: "DISCOUNT", isDiscountDeduction: true
   - Chiết khấu thương mại NCC chung -> item_code: "CK-THUONGMAI", item_type: "DISCOUNT", isDiscountDeduction: true

9. CÔNG CỤ DỤNG CỤ (BẮT BUỘC "CCDC-*"):
   - Súng bắn ốc, cuộn rulo ống khí, cẩu móc máy, máy nén khí, đồ nghề thợ -> item_code: "CCDC-XUONG", item_type: "MATERIAL"
   - Thiết bị mạng TP-Link, switch, camera quan sát, máy in, micro -> item_code: "CCDC-VP", item_type: "MATERIAL"

10. HÀNH CHÍNH & VĂN PHÒNG PHẨM (BẮT BUỘC "HC-*"):
   - Nước uống tiếp khách/thợ (Biwase, Viva, Lavie, Aquafina, Ion Life) -> item_code: "HC-NUOC", item_type: "OTHER"
   - Giấy in A4, bìa còng, giấy in bill -> item_code: "HC-VPP", item_type: "OTHER"

ĐỊNH DẠNG ĐẦU RA JSON BẮT BUỘC:
{
  "items": [
    {
      "lineIndex": 0,
      "itemCode": "VF-BIW20002460",
      "itemType": "PARTS" | "SERVICE" | "MATERIAL" | "DISCOUNT" | "OTHER",
      "isDiscountDeduction": false,
      "confidence": 0.98,
      "reason": "Mã phụ tùng VinFast trích xuất kèm tiền tố VF-"
    }
  ]
}`;

    const userPrompt = `Danh sách các dòng hàng hóa/dịch vụ (TOON format):\n${toonData}`;

    try {
      const completion = await this.nineRouterClient.complete({
        model: modelOverride || tier,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.0,
      });

      const content = completion.choices[0]?.message?.content || '{}';
      return this.parseLineItemsClassificationResult(content, items);
    } catch (err: any) {
      this.logger.warn(
        `AI classify line items failed for ${items.length} items: ${err?.message}`,
      );
      return [];
    }
  }

  private parseLineItemsClassificationResult(
    text: string,
    originalItems: ClassifyLineItemInput[],
  ): ClassifyLineItemResult[] {
    try {
      const clean = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(clean);
      const rawList = Array.isArray(parsed.items)
        ? parsed.items
        : Array.isArray(parsed)
          ? parsed
          : [];

      return rawList.map((item: any, idx: number) => {
        const lineIdx =
          typeof item.lineIndex === 'number'
            ? item.lineIndex
            : (originalItems[idx]?.lineIndex ?? idx);
        const itemCode =
          typeof item.itemCode === 'string' && item.itemCode.trim().length > 0
            ? item.itemCode.trim()
            : null;
        const validTypes = [
          'PARTS',
          'SERVICE',
          'MATERIAL',
          'DISCOUNT',
          'OTHER',
        ];
        const itemType = validTypes.includes(item.itemType)
          ? item.itemType
          : 'OTHER';
        const confidence =
          typeof item.confidence === 'number' ? item.confidence : 0.8;
        const isDiscountDeduction =
          Boolean(item.isDiscountDeduction) || itemType === 'DISCOUNT';

        return {
          lineIndex: lineIdx,
          itemCode,
          itemType,
          isDiscountDeduction,
          confidence,
          reason: item.reason || 'Classified by 9router AI',
        };
      });
    } catch (e) {
      this.logger.warn(
        `Failed to parse line items classification JSON: ${text.slice(0, 200)}`,
      );
      return [];
    }
  }
}
