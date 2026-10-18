import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiHubTables20260925134500 implements MigrationInterface {
  name = 'CreateAiHubTables20260925134500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create erp_ai_configs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_ai_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "module_code" character varying(64) NOT NULL,
        "module_name" character varying(255) NOT NULL,
        "tier_level" character varying(32) NOT NULL DEFAULT 'medium',
        "model_override" character varying(128),
        "temperature" double precision NOT NULL DEFAULT 0.2,
        "max_tokens" integer NOT NULL DEFAULT 4096,
        "is_active" boolean NOT NULL DEFAULT true,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_ai_configs" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_ai_configs_module_code" ON "erp_ai_configs" ("module_code");
      CREATE INDEX IF NOT EXISTS "IDX_erp_ai_configs_is_active" ON "erp_ai_configs" ("is_active");
    `);

    // 2. Create erp_ai_logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_ai_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "request_id" character varying(128),
        "actor_user_id" uuid,
        "actor_email" character varying(255),
        "module_code" character varying(64) NOT NULL,
        "tier_level" character varying(32) NOT NULL,
        "model_name" character varying(128) NOT NULL,
        "prompt_snippet" text,
        "prompt_tokens" integer NOT NULL DEFAULT 0,
        "completion_tokens" integer NOT NULL DEFAULT 0,
        "total_tokens" integer NOT NULL DEFAULT 0,
        "latency_ms" integer NOT NULL DEFAULT 0,
        "status" character varying(32) NOT NULL DEFAULT 'SUCCESS',
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_ai_logs" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "IDX_erp_ai_logs_created_at" ON "erp_ai_logs" ("created_at");
      CREATE INDEX IF NOT EXISTS "IDX_erp_ai_logs_module_created" ON "erp_ai_logs" ("module_code", "created_at");
      CREATE INDEX IF NOT EXISTS "IDX_erp_ai_logs_actor_created" ON "erp_ai_logs" ("actor_user_id", "created_at");
      CREATE INDEX IF NOT EXISTS "IDX_erp_ai_logs_status" ON "erp_ai_logs" ("status");
    `);

    // 3. Create erp_ai_prompt_templates
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_ai_prompt_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "template_code" character varying(64) NOT NULL,
        "module_code" character varying(64) NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "system_prompt" text NOT NULL,
        "user_prompt_template" text NOT NULL,
        "input_schema_json" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_ai_prompt_templates" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_ai_prompt_templates_code_ver" ON "erp_ai_prompt_templates" ("template_code", "version");
      CREATE INDEX IF NOT EXISTS "IDX_erp_ai_prompt_templates_module" ON "erp_ai_prompt_templates" ("module_code");
    `);

    // 4. Seed Default Configurations
    await queryRunner.query(`
      INSERT INTO "erp_ai_configs" ("module_code", "module_name", "tier_level", "temperature", "max_tokens", "description")
      VALUES
        ('INVOICE', 'Hóa đơn & Đối chiếu OCR', 'medium', 0.1, 4096, 'Trích xuất dữ liệu hóa đơn NCC và tự động khớp PO/GRN'),
        ('ACCOUNTING', 'Kế toán & Định khoản tự động', 'medium', 0.1, 4096, 'Gợi ý định khoản cặp tài khoản Nợ/Có cho giao dịch'),
        ('PURCHASING', 'Mua hàng & Báo giá NCC', 'medium', 0.2, 4096, 'So sánh báo giá và đề xuất đơn đặt hàng'),
        ('INVENTORY', 'Kho & Dự báo tồn', 'high', 0.2, 4096, 'Phân tích SKU và cảnh báo rủi ro tồn kho'),
        ('COPILOT', 'ERP AI Copilot', 'high', 0.3, 8192, 'Trợ lý thông minh hỏi đáp và tóm tắt báo cáo')
      ON CONFLICT ("module_code") DO NOTHING;
    `);

    // 5. Seed Default Prompt Templates
    await queryRunner.query(`
      INSERT INTO "erp_ai_prompt_templates" ("template_code", "module_code", "version", "system_prompt", "user_prompt_template")
      VALUES
        (
          'INVOICE_OCR_EXTRACT',
          'INVOICE',
          1,
          'Bạn là chuyên gia trích xuất dữ liệu hóa đơn tài chính của hệ thống ERP. Hãy phân tích văn bản/nội dung hóa đơn được cung cấp và trích xuất thành định dạng JSON chuẩn gồm: invoiceNumber, invoiceDate (YYYY-MM-DD), sellerTaxCode, sellerName, buyerTaxCode, buyerName, subtotal, taxAmount, totalAmount, items (mỗi item gồm: itemName, itemCode, unit, quantity, unitPrice, amount, vatRate). Chỉ trả về JSON hợp lệ, không giải thích thêm.',
          'Nội dung hóa đơn cần trích xuất:\n{{invoiceContent}}'
        ),
        (
          'ACCOUNTING_AUTO_JOURNAL',
          'ACCOUNTING',
          1,
          'Bạn là kế toán trưởng hệ thống ERP (tuân thủ Thông tư 200/133 của Bộ Tài chính Việt Nam). Dựa trên mô tả giao dịch chi tiết, hãy gợi ý định khoản kế toán gồm: debitAccount, creditAccount, confidence (0-1), explanation. Chỉ trả về JSON hợp lệ.',
          'Nội dung giao dịch:\n{{transactionDescription}}\nSố tiền: {{amount}}\nĐối tượng: {{partnerName}}'
        ),
        (
          'PURCHASING_QUOTE_COMPARE',
          'PURCHASING',
          1,
          'Bạn là chuyên viên quản lý chuỗi cung ứng hệ thống ERP. Hãy phân tích và so sánh các báo giá nhà cung cấp sau, đưa ra đánh giá ưu nhược điểm về giá, thời hạn thanh toán và thời gian giao hàng, cùng đề xuất nhà cung cấp tối ưu nhất. Trả về JSON chuẩn.',
          'Danh sách báo giá NCC:\n{{quotesData}}'
        ),
        (
          'INVENTORY_ANOMALY_CHECK',
          'INVENTORY',
          1,
          'Bạn là chuyên gia quản trị kho vận hệ thống ERP. Hãy phân tích lịch sử xuất nhập tồn của mã hàng và đánh giá nguy cơ thiếu hụt (stockout) hoặc tồn kho quá hạn (overstock). Trả về JSON chuẩn gồm: riskLevel (LOW/MEDIUM/HIGH), recommendation, suggestedReorderQuantity.',
          'Dữ liệu tồn kho và lịch sử xuất nhập:\n{{inventoryData}}'
        ),
        (
          'COPILOT_SYSTEM',
          'COPILOT',
          1,
          'Bạn là Trợ lý AI Thông minh (ERP Copilot) của hệ thống ERP. Bạn hỗ trợ người dùng tra cứu dữ liệu, giải thích quy trình nghiệp vụ, và tóm tắt số liệu hoạt động của doanh nghiệp một cách ngắn gọn, chính xác, lịch sự.',
          '{{userMessage}}'
        )
      ON CONFLICT ("template_code", "version") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_ai_prompt_templates";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_ai_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "erp_ai_configs";`);
  }
}
