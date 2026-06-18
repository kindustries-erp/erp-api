# API Naming Conventions (ERP API)

## Files
- Module: `<domain>.module.ts`
- Controller: `<domain>.controller.ts`
- Service: `<domain>.service.ts`
- Entity: singular `<domain>.entity.ts`
- DTO: `<action>-<domain>.dto.ts`
- Test: `<target>.spec.ts`

## Types / classes
- DTO class: `CreatePurchaseOrderDto`, `QueryErpInvoicesDto`
- Service class: `ErpInvoicesService`
- Controller class: `ErpInvoicesController`
- Entity class: `ErpInvoice`

## Routes
- Ưu tiên resource plural ổn định: `/api/v1/erp-invoices`
- Không đổi path chỉ để khớp tên file nội bộ

## Methods
- Query/list: `list`, `findAll`, `findOne`
- Mutations: `create`, `update`, `remove`, `importXml`
- Tránh tên mơ hồ như `handleData`, `processThing`

## Response naming
- List response: `{ items, total }` hoặc contract domain đã thống nhất
- Detail response: object rõ ràng theo domain
- Nếu cần mapper, đặt tên `to<Domain>Response` hoặc `<domain>ResponseMapper`

## Notes
- Dùng `must` cho tên đã được repo dùng rộng rãi; với pattern mới, ghi là `prefer` trong task nếu chưa phổ cập.
