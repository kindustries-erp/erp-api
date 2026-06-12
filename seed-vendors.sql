DELETE FROM public.erp_business_partners WHERE partner_type = 'VENDOR';

INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    'f52bdbc8-8918-5354-ab43-182ce9b6e97f', 'NCC-NL-001', 'Công ty Công nghệ LD', 'Công ty Công nghệ LD', 'VENDOR', NULL, NULL, NULL, 'Hưng Yên', 'Ms. Nhàn', 'ACTIVE', 'Nguồn từ sheet PO: LD-10, LD-02, LD-200, LD-200 (lần 2), LD-Lockset 1000', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    '4084ec91-368a-5d06-a7ba-23a3d5b4a257', 'NCC-CSK-002', 'Công Ty Cao Su Kenda (Viet Nam)', 'Công Ty Cao Su Kenda (Viet Nam)', 'VENDOR', NULL, '0904360504', 'thquoc@kenda.com.tw', 'KCN Hố Nai, ấp Thanh Hóa, phường Hố Nai, tỉnh Đồng Nai, Việt Nam', 'Mr. Thiên Quốc', 'ACTIVE', 'Nguồn từ sheet PO: Kenda - 20, Kenda - 500, Kenda - 600', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    '0972ad20-002e-5f47-a25d-8ad882f0e493', 'NCC-DM-003', 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ THƯƠNG MẠI ĐẠT MỸ', 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ THƯƠNG MẠI ĐẠT MỸ', 'VENDOR', NULL, NULL, NULL, 'Hưng Yên', 'Ms. Huyền', 'ACTIVE', 'Nguồn từ sheet PO: CMC-200', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    '8215c6a0-7a0c-5151-817c-c4f50b462828', 'NCC-DHP-004', 'CÔNG TY TNHH SX&TM DƯƠNG HỒNG PHÁT', 'CÔNG TY TNHH SX&TM DƯƠNG HỒNG PHÁT', 'VENDOR', NULL, NULL, NULL, 'Hưng Yên', 'Ms. Phương', 'ACTIVE', 'Nguồn từ sheet PO: DHP-200', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    '6ad15722-cf7b-5661-9608-e899c3786042', 'NCC-TC-005', 'CÔNG TY TNHH SX & TM THIÊN CHÚC', 'CÔNG TY TNHH SX & TM THIÊN CHÚC', 'VENDOR', NULL, NULL, 'thienchuchy@gmail.com', 'Thôn Thổ Cốc, xã Tân Lập, huyện Yên Mỹ, tỉnh Hưng Yên, Việt Nam', 'Ms. Chúc', 'ACTIVE', 'Nguồn từ sheet PO: Thiên Chúc-2000', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    '08dcd0e2-d691-5f11-85fc-bc9867a40567', 'NCC-DT-006', 'CÔNG TY TNHH ĐẠI THÀNH', 'CÔNG TY TNHH ĐẠI THÀNH', 'VENDOR', NULL, NULL, NULL, 'Thôn Ninh Vũ, Xã Khoái Châu, Tỉnh Hưng Yên, Việt Nam', 'Ms. Tuyên', 'ACTIVE', 'Nguồn từ sheet PO: Đại Thành-2000', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    '75533283-54d2-541e-bc70-f87638307bfd', 'NCC-LLQP-007', 'CÔNG TY LONG LÂN QUY PHỤNG', 'CÔNG TY LONG LÂN QUY PHỤNG', 'VENDOR', NULL, NULL, NULL, 'Hồ Xá, Quảng Trị', 'Ms. Hà', 'ACTIVE', 'Nguồn từ sheet PO: LLQP-5000', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    'cf22ee26-689f-52ac-af63-2a61863ec0c0', 'NCC-TP-008', 'CÔNG TY THẾ PLASTIC', 'CÔNG TY THẾ PLASTIC', 'VENDOR', NULL, NULL, NULL, 'Tp.HCM', 'Mr. Thế', 'ACTIVE', 'Nguồn từ sheet PO: Dây rút', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    'c235845a-0bc1-5057-8003-9fd1b454f084', 'NCC-BP-009', 'CÔNG TY BP', 'CÔNG TY BP', 'VENDOR', NULL, NULL, NULL, 'Tp.HCM', 'Mr.', 'ACTIVE', 'Nguồn từ sheet PO: Mỡ bò', false
  );
INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    'eeb69e73-cb71-5d3a-9fba-259f4ededc19', 'NCC-CT-010', 'CÔNG TY', 'CÔNG TY', 'VENDOR', NULL, NULL, NULL, 'Tp.HCM', 'Mr.', 'ACTIVE', 'Nguồn từ sheet PO: Túi zip', false
  );
