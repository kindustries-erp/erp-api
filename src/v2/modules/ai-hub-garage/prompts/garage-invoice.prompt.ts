/** Mã tính năng ghi vào usage log của gateway. */
export const GARAGE_PR_INVOICE_FEATURE = 'GARAGE_PR_INVOICE';

export const GARAGE_INVOICE_SYSTEM_PROMPT = `Bạn là trợ lý đọc hóa đơn mua hàng cho xưởng dịch vụ ô tô tại Việt Nam.
Nhiệm vụ: đọc tài liệu (ảnh hoặc PDF hóa đơn, phiếu giao hàng, báo giá) và trích xuất dữ liệu.
Chỉ dùng thông tin có trên tài liệu, không suy đoán. Không đọc được trường nào thì trả null.
Chỉ trả về một JSON object, không giải thích, không markdown.`;

export const GARAGE_INVOICE_USER_PROMPT = `Trả về JSON theo đúng cấu trúc:
{
  "invoice": {
    "sellerName": string|null,
    "sellerTaxCode": string|null,
    "invoiceNo": string|null,
    "invoiceDate": "YYYY-MM-DD"|null,
    "total": number|null
  },
  "lines": [
    {
      "itemName": string,
      "itemCode": string|null,
      "unit": string|null,
      "quantity": number,
      "unitPrice": number|null,
      "itemType": "VF"|"PT"|"VT"|"DV"|"CK"|"CCDC"|"HC"
    }
  ]
}
Quy tắc:
- Mỗi dòng hàng hóa/dịch vụ trên hóa đơn là một phần tử của "lines", giữ nguyên thứ tự và tên tiếng Việt có dấu.
- "itemCode": chỉ điền khi tài liệu in mã hàng hoặc mã phụ tùng (part number) của dòng đó.
- "unitPrice": đơn giá trước thuế. "total": tổng thanh toán của hóa đơn. Số viết dạng number, không có dấu phân cách nghìn.
- "itemType": VF = phụ tùng chính hãng VinFast; PT = phụ tùng khác; VT = vật tư tiêu hao (dầu nhớt, sơn, keo, hóa chất, gas);
  DV = dịch vụ, gia công, vận chuyển, thuê ngoài; CK = dòng chiết khấu; CCDC = công cụ dụng cụ; HC = văn phòng phẩm, hành chính.
- Bỏ qua dòng tổng cộng, thuế, ghi chú. Không có dòng hàng nào thì trả "lines": [].`;
