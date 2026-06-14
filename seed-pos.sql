INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 'PO-202606001', 'f52bdbc8-8918-5354-ab43-182ce9b6e97f', '2026-06-12T18:29:28.601Z', '2026-02-25T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'D002 10 BỘ MUA LẺ NGÀY 25-02-2026 - XE RÁP MẪU K LOTUS', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '168d2d2c-eaff-5314-b7f4-d9da7588a4ae', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 1, 'e3098d27-0284-501d-a0ec-e46445887fa8', 'Ốp đầu trước', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'aa28d7b9-cbfb-563b-bfdb-560bb66a4201', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 2, '569fb5aa-262e-5479-948b-aff027822865', 'Ốp đầu trước trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9bf01574-f0ce-59f5-8370-6cf782ed0b21', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 3, 'b0da05a1-b689-5ece-a70d-b0e6fcdc8b95', 'Ốp đầu trước xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7d2df46d-a1e2-5826-a009-47d59644dd3c', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 4, '5c38e394-ba6a-5971-a68e-f94e58d2a3cc', 'Ốp đầu trước đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3aa47df0-8fa0-560c-90fc-d21842b709ef', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 5, '65bfe454-fff1-50cd-b34b-08a4bf16a414', 'Ốp đầu trước xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1ae7d355-f3e8-5c46-926f-f4dc31b2af86', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 6, 'ed2a0e56-1a58-5737-b359-b0b30dab9542', 'Ốp đầu trước đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c8316680-59fc-58a0-ad7b-30574efbf915', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 7, '7deb50f4-3a53-5e8d-b3d5-8580089de146', 'Ốp chắn gió trước', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9d5940b7-c76e-5b74-bbb5-deb13f9a237f', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 8, 'd07e4abd-1aa7-5854-8060-bb78b623e139', 'Ốp chắn gió trước trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a2c1d5b1-7547-5540-81ba-44a87884872b', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 9, '6dd263fa-9eab-5604-ac96-2fd75c4da83b', 'Ốp chắn gió trước xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '05941bc4-bc77-525b-916d-84200327a41d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 10, '47fa7773-4d02-52ba-b18d-dd1c50e77c18', 'Ốp chắn gió trước đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f015e1da-8949-55ac-bfd6-db795494920f', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 11, '38581456-294d-5e23-aee6-d2ac0a7f11d1', 'Ốp chắn gió trước xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f6a17b75-0425-5d18-8f53-70ca5cd2c5c3', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 12, '8c69d188-97e3-5948-b1d8-dbbca75544a3', 'Ốp chắn gió trước đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4673fa51-ecdf-563d-bdbd-5c2c845c00fb', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 13, 'a970c451-f713-54f1-b6bd-0821d37adca6', 'Tấm nối chắn gió trước bên trái', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b3ceb530-5ef9-596e-909d-3c66a12860f0', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 14, 'a0ad3acf-36f3-51e6-8b72-ea2538218497', 'Tấm nối chắn gió trước bên phải', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '956e27f8-6229-528e-906a-8bae6d6639eb', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 15, 'dd078068-be40-53ad-a7ff-c0db3687387a', 'Tấm nối chắn gió trước bên trái trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3d3efc63-f145-5f0e-9d01-ec5884fb9a63', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 16, 'be28b492-8b1a-5356-a836-42c7b0d11711', 'Tấm nối chắn gió trước bên phải trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3af95057-6be8-5a71-8c28-3ffa48707247', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 17, 'a18025e1-d6d3-584b-a439-350f2e88d263', 'Tấm nối chắn gió trước bên trái xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f6635470-e49a-513a-9dca-a20de3b1f34b', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 18, '153006a8-06ab-510b-abbe-0d8c313d2e51', 'Tấm nối chắn gió trước bên phải xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5c00517c-8873-5151-b7c7-e7a4a3e2b5f8', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 19, '5a5f01cb-f41c-5250-b147-7156a548612a', 'Tấm nối chắn gió trước bên trái đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '07a4d27d-7f91-5bfb-b836-dd84b074b03a', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 20, '8c2d6bcb-fd70-5b29-b636-c946e7144fbf', 'Tấm nối chắn gió trước bên phải đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '04d21e34-9ed9-553e-bc2b-27d6e0b9a100', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 21, 'c4271174-060b-5b19-bcc1-03002a563561', 'Tấm nối chắn gió trước bên trái xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9183672f-5628-5aac-b06d-849f98554f74', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 22, '273a7eea-70c0-5502-84a3-3184733e4364', 'Tấm nối chắn gió trước bên phải xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ac1e401a-20aa-5bbd-95f9-4e915c885c67', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 23, '4123831d-cbe7-5426-88d7-df19e6d0a045', 'Tấm nối chắn gió trước bên trái đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6ebd3dfc-ca91-5648-92bc-ad62b9ad84b9', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 24, '261da775-261e-59ad-b101-cda3f77764a4', 'Tấm nối chắn gió trước bên phải đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'eec0fb96-56d5-5b9d-ba93-23c60449fb01', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 25, 'a3607267-389b-515c-999b-6c9f10ec6f64', 'Thanh logo mặt nạ xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '472943a9-86fa-5adc-9cc1-60075975585d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 26, 'd378b061-e1f7-566d-b3cf-2006e26719a9', 'Chắn bùn trước', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'be0ac33e-3bef-5f25-bca5-be01b584b893', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 27, 'fa3c49f7-d141-58fc-b4af-147fca130c2c', 'Chắn bùn trước trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '83c772e0-54c8-5b7a-8d60-78bfe7b25652', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 28, '73842302-3667-5686-82b7-eb3b29197db7', 'Chắn bùn trước xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd39e5e03-109c-59a6-9fb1-1ffff95c3522', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 29, 'b818af0e-724f-5ae7-8488-81a4c8eabe15', 'Chắn bùn trước đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '41926306-82b5-5f25-b880-f6bcb81b3572', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 30, '0d6bc7e6-05b6-584b-bab3-63fa95cfed55', 'Chắn bùn trước xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a233cd7c-8056-56ad-8044-0f7d893fa5fb', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 31, 'e13570cb-2881-571a-b991-f4f5c5ac0571', 'Chắn bùn trước đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3631578b-890c-59dc-81c7-ac61eb94cf62', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 32, '62671ea8-4582-5327-b189-38068f61cd80', 'Vành đèn pha Xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '23926a07-7f70-572b-a069-3e20cad45aef', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 33, 'a3627167-d29a-52fe-a443-53f357acabaa', 'Ốp để chân trái', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9b4113b5-b8c1-5750-937c-4997c98c0c29', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 34, 'd4d6e8dc-52a6-5187-8fca-f0f59acf4c0f', 'Ốp để chân trái trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fa6df825-1c29-5a4c-97d1-7eb076f0da4b', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 35, '078d8fa7-2b42-555f-9e57-d92200ec0ede', 'Ốp để chân trái xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '59d4112d-ddd8-5d36-874c-ac79d88d7984', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 36, 'd0d96135-9ea7-55f6-ad3d-4e156e1a7c50', 'Ốp để chân trái đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '99b90dee-d5dd-5597-ac09-b629b68b4942', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 37, '8d98b7ef-3fc2-5bf2-834a-0036ec530366', 'Ốp để chân trái xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8f2e5ede-4798-5587-b96e-760bac600420', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 38, '6a67911b-53db-5158-a57f-17610a76ce62', 'Ốp để chân trái đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bcbe3c90-7689-5bcd-8ed1-172e19b72f65', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 39, 'c080bb34-51aa-5b77-9f39-1639b93e9eb9', 'Ốp để chân phải', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd514fcc4-adf9-506c-813d-bf3282815a6b', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 40, '2603262f-e684-50df-af9f-15f1ac0038bc', 'Ốp để chân phải trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0b49e8f7-db0a-51ee-92a1-59d8d1654665', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 41, 'f22de075-65bc-5943-b6f6-ef34b2cbedc5', 'Ốp để chân phải xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8847732a-5958-52bd-a40d-bf53783b2164', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 42, '1dbc6e33-efe4-5924-a4ed-8a7a615445ee', 'Ốp để chân phải đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1bc56cf4-a8fd-5233-8eb0-8590485be28b', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 43, '5ff135d7-2d03-599b-bee1-3b0fddc04f19', 'Ốp để chân phải xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '16e1fea0-1d50-5420-af05-d750c569a301', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 44, 'caaad947-ad15-547c-b8ca-ee2efe862ca6', 'Ốp để chân phải đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'baa53e47-cd9a-59a8-980f-5403238252ae', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 45, '230bd9da-c94c-5f3d-9ac3-ee7b22354465', 'Ốp thân trái', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '20fa0f3d-a0b0-517d-a447-b183982327f0', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 46, '496483b9-1ad9-5490-b207-117f5d528363', 'Ốp thân trái trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e0a36551-a8d2-5fa8-a386-0aa3d0953b21', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 47, 'cfcd55b7-60fc-5247-a918-7462b323c2b7', 'Ốp thân trái xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '60889a18-f9d5-5d82-95be-0cd0a968a800', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 48, '61a8e4bb-d2f9-544a-ae68-21b3c9988019', 'Ốp thân trái đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd233b422-e742-53c2-8cf5-75436d8cc905', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 49, '36efe13a-4ba2-5166-ba04-4f02726b7664', 'Ốp thân trái xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '245a9bb6-a1ce-5fb2-853c-21447827cc97', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 50, '6b26dbf6-e871-5b8b-8882-3fa779727604', 'Ốp thân trái đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e4def511-50f6-5c19-8e85-6ed79340b310', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 51, '6500c855-dc7d-5852-b905-811353010a4c', 'Ốp thân phải', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3a9c2cb5-0a09-5828-acb8-986c2d738fb3', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 52, '555c5af3-d0ac-5b78-9468-3d39d505bbd9', 'Ốp thân phải trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2fe09eea-c1fd-5496-9e28-e60717926cd6', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 53, 'cf7e497f-00f0-52a4-bc11-c212788163c5', 'Ốp thân phải xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'eb922ba1-f3f5-5281-a071-76013b4fce4e', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 54, '9a74c815-e459-5883-a1d8-d83663ed0cf5', 'Ốp thân phải đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c5daa9e9-4e68-57e3-aa23-1c4e6d4e61a5', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 55, 'bd716143-169b-5e40-9dbb-c40da89af40a', 'Ốp thân phải xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ac47a359-9a6d-5a27-9b4f-58bfd401780b', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 56, '023b0464-9d47-55c9-a838-8c3ecb28c3e7', 'Ốp thân phải đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '17c21237-adfd-59a5-8585-5e7366a41514', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 57, '87561f0e-92ab-530e-8de4-c230f8d3fe8c', 'Ốp trung tâm', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a804056c-8cd7-5640-a1c7-ea9889818300', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 58, '1f4ad259-50a4-5d61-aefc-813729d7b783', 'Ốp trung tâm trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1455031b-c75b-5872-b5c2-d1594f1ee2a8', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 59, '6c4d9658-8f30-5c0e-b272-946c2cea74d9', 'Ốp trung tâm xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e5adc536-2f15-5065-99e6-f93548af3cdb', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 60, 'a314799c-b544-5e71-a5ce-974537d105c5', 'Ốp trung tâm đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '087ef4f7-34d6-5de3-8983-231445bc5ced', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 61, '372d7704-1456-5d34-85ef-b833cdd66079', 'Ốp trung tâm xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8c20733e-9802-54cf-8d36-325751b0e242', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 62, 'a0718c62-2bea-519d-8b59-7f6364a4a5b4', 'Ốp trung tâm đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '530910a8-58eb-5892-8cf8-912f5632d123', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 63, '58e1908d-d14a-55fc-87dc-994f0ce7618e', 'Tấm nối ốp thân xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ae83e94e-39f5-5a78-925a-cdb8b3399080', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 64, 'fc0cf2d1-594f-5b80-9415-f2dc43a843c2', 'Tấm nối ốp thân xe trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '72177a4a-c584-52d0-8d96-6788f41b5762', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 65, 'd2f7f86a-5dd9-5b89-856d-c8bf9d73df9b', 'Tấm nối ốp thân xe xanh', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '916ede17-e9e6-5d4d-a06e-724cefb1ba03', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 66, 'a05d3846-701b-590b-9f43-1d6b347cce76', 'Tấm nối ốp thân xe đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7c78c0e2-d09f-58b6-82e8-f02e4cc850f0', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 67, 'b35d6491-3abf-50f8-896d-99c4108c56c3', 'Tấm nối ốp thân xe xám', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1ae04b59-63d9-527c-9926-d7ae224d9d76', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 68, '88b125f0-20d9-540e-a051-8fc5ca076763', 'Tấm nối ốp thân xe đen', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2dc816b5-aea7-5fac-9b14-3d1c7bf9d27d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 69, 'ca377c43-a184-5750-af0a-0e89a4e76bb0', 'Ốp đồng hồ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2f9ae298-f864-51b6-90ff-4b5aa0baaf52', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 70, 'b87b46ca-7d5c-5153-8702-cb7f63192711', 'Chắn bùn trước bên trong', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1daa69ac-e64f-56f1-88de-9993dd013823', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 71, 'a52b2e04-78b2-5e50-9c19-c91b9dd11767', 'Nối hộp dụng cụ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1dd66679-df4f-5108-a774-09370f3c048b', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 72, '10fb7b3d-953e-5c66-b798-732f4ba04598', 'Hộp dụng cụ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f4ce6c69-6dc6-5cf5-a224-0a043dc3e3e0', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 73, '445429e6-b561-5e7f-b09b-d0bba29a5a59', 'Nắp che số khung', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '34604066-0c74-5172-ab3d-cc40454fa1ed', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 74, '0860f254-d05d-5962-80fa-50cefa502252', 'Hộc để đồ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bf8a0044-a3e0-574f-8611-04796df0e128', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 75, 'd5e480c3-b641-54d7-aac3-4b892a1dea9e', 'Cốp xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd7d94473-c303-58f1-bb30-49bf61d75f3a', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 76, '6f3e1d3e-5c6c-5040-97bc-3af0e6956416', 'Sàn để chân', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2807a5fb-515b-56e9-a906-afa4018919aa', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 77, '09d77103-ce6f-5c14-9bd1-f612880362f5', 'Cao su bịt sàn để chân', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'de84b05a-4405-5b89-b3b6-4a6195c1907a', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 78, '91fc8df7-619e-5033-9d45-e6000c25f3c7', 'Ốp gầm xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f8760fad-4701-5110-8f7e-b65edb4d8497', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 79, '92e15d0c-0b27-5eba-9aa2-34858c13f009', 'Ốp trước cốp', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fab73978-1647-5935-94b0-80814ed53dff', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 80, 'b3772105-d2b5-5a5a-827e-c172020a2cd6', 'Để chân trái', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0df6e80d-489f-55c4-938e-2634f7cf8e90', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 81, 'd132e4d2-3ab7-578e-8cb1-a851849c771e', 'Để chân phải', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7291257b-7669-57ce-8a11-1db42033ea27', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 82, 'e3144fc2-261b-5b83-b52b-d6c91433df51', 'Chắn bùn sau bên trong', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c6ec8fc2-8ef7-53d7-a8ee-d21643327f22', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 83, '0adef39c-3871-537e-a481-0ebc4f1784e0', 'Chắn bùn sau bên ngoài', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a601426a-1e55-5882-8a51-c202bb1c2ccc', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 84, '81aa2503-58b3-50fc-900b-d39f90334656', 'Đuôi gắn biển số', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '21c063a4-38a6-5ca5-8f1a-c10ea107f47e', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 85, '51abdec1-42d6-5de8-82f0-cd16ae55108b', 'Đèn pha', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3aace92e-baba-5cb1-9e95-6621abef91b3', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 86, 'cfa056b9-8c94-5e7e-bfc5-47dd97729dc3', 'Xi nhan Trái', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bf3a844b-391e-5cc5-870d-26694dd2c945', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 87, '56e53bae-9bcb-5a47-9c61-85d5c9dcb337', 'Xi nhan Phải', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '370093bf-3b27-5a61-b7e4-0fad1dba7f73', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 88, 'b0ec7835-f119-5988-8943-c9ed9c51a2de', 'Đèn hậu', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '362b926b-24bb-5056-a386-e7db06315c8d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 89, '8dcc316a-61c4-5369-a77f-28984c2f1f66', 'Đèn biển số', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2fe1eecc-d297-533d-bfa1-6b886d20f2ca', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 90, '71ab9290-76b7-59d7-86f5-64b6c5aafb53', 'Ghi đông', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '154b0810-ca53-58c0-891c-072c4a0c5bd6', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 91, '3d64c676-f3c4-50ea-a30f-930c7aa2dc6f', 'Gắp', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '67dd9593-b991-5cc3-8592-bb3e792880aa', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 92, '9d75caa9-5dba-5973-b141-70a32a8c7571', 'Chân chống nghiêng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a147b419-63ba-564e-b837-4d41575e7871', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 93, '000cf6c5-1f66-5c9c-ac65-76d1a24491b5', 'Chân chống giữa', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '36056588-d247-55a3-96a4-cedaae38f01a', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 94, '5b7b5a0d-ec87-590b-9feb-7019bcf5bc26', 'Khung xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5dab84d5-ddf6-5299-aaa0-2ed25fb74b4d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 95, '9b7b429d-93ce-5a81-92df-8623970b1e65', 'Yên xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7fe67424-be04-581e-b685-021943e6a968', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 96, '8b63dd58-61cb-53c3-a3c8-8449aef69e30', 'Cảnh báo đỏ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e97e91fb-695e-57fe-a602-da26380f171a', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 97, 'f8374b14-08e8-58e9-beb4-b6ec7d9f3076', 'Cảnh báo tròn vàng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5f485a92-e9c2-55cc-91c5-b7268302318d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 98, 'da4bc5ca-037f-5185-9d04-e8cf879c67a6', 'Móc treo đồ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '70a119d4-1175-585f-84ba-cdbe743f0ccb', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 99, '2b3a3e47-a84f-5d0a-a9df-ec11b1ca5bde', 'Tay dắt nhôm (cảng sau)', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '98bef935-acfc-5a13-a47e-160d602e4efc', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 100, '230105c6-5274-5a3d-9e71-bc439aeecf07', 'Đồng hồ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7030bee7-f2d7-5fcc-8412-6fddc3908963', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 101, '2a086bd2-49d4-59bb-b188-05a4aa0bddd5', 'Bộ công tắc trái', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6b7ec63c-f1f5-5994-9a0d-3d22feddd827', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 102, 'ab4b8189-0be5-56fe-b97d-4c33fbc0209e', 'Bộ công tắc phải', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd49ac66e-664e-5641-9e2c-665e5fbeff76', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 103, 'feaed352-c515-5dda-bda7-f09733b3c431', 'trục giữa', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd7322eed-2175-5af8-8cbe-2d253fd169d4', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 104, '12a699f8-0a50-53a7-84e4-e55ddf39ba51', 'đùi bàn đạp', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd96bcd39-1594-5b22-8c5d-9a96eed49cdd', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 105, '57e805fa-8730-5931-ade4-bca3d12e5dd6', 'bánh răng trước', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1205861f-db91-5459-964b-d5ec3ea05421', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 106, '93d52ca7-dc63-5ac3-a9bc-da08edddffcb', 'bàn đạp', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '78df1296-a2fc-5cfc-b4fa-b8d904f76d73', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 107, 'b5d6d51c-bf60-5f24-9636-05b19405a175', 'xích xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2c127a49-44f3-598f-9701-a09bc3185b8d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 108, '5dca96ea-d9a7-5f3f-a41f-89d3ef514b6b', 'bộ côn nồi giữa', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'aba657a1-0f46-5c28-80e4-2897e1091201', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 109, '6108637a-f478-5318-8632-5155e4020876', 'bánh răng sau', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '24351931-77a2-5714-aa3f-08d754f44b78', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 110, 'fe90d679-fbe0-59c3-854a-e87af73e7848', 'Bộ ổ khóa', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c3458524-ff6f-5b30-94d8-ab6d178b274c', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 111, 'da7d9952-adf1-5721-83ab-c4325a4dfbc1', 'Chảng 3', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1f86910d-af22-5138-9dfe-1f081822b8f1', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 112, '872fd8e8-623d-5257-b268-329454f6d676', 'Phuộc trước', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4e1588b1-9a4d-503b-b007-bbbf77b30fb1', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 113, '36081cc2-aadd-5560-a643-79ce69b7cea4', 'Phuộc sau', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6ffe776a-d954-5d6c-b7a6-24d9f96eb52c', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 114, 'b623493f-3849-56c6-bb71-1e21eceb7659', 'Tay thắng trái', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dc8d3e52-fe00-5833-b930-33af3e180b92', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 115, 'cbb144f2-7e20-5f32-9d6b-66dfcda41bef', 'Tay ga trái', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'afa2a9ea-aec4-578a-b221-386ad92e68ea', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 116, '101dfa2a-238b-56f8-87b5-3d89a6398384', 'Tay ga phải', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '86fe358b-1d8d-574a-8b6f-2936d19ecf40', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 117, '6170ab67-25bf-5031-a334-803870506ff4', 'Tay thắng phải', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8b2140bf-36a8-51b5-a326-2027d828e777', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 118, '7098220d-6ea5-584e-ab94-6cc1dc676981', 'Đĩa phanh trước', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '46ca5a49-2fe4-5ef7-9a9d-ca435960761f', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 119, '0b06fb8b-d827-5dc4-a4bc-3c22062c5ea2', 'Mâm trước', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '28764903-6b06-56f3-a60d-9c7c6a02378f', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 120, '40b34923-04bc-5558-aeca-87a6b53fc5f7', 'Cụm phanh sau', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8a7470cf-9c31-5fcc-8925-6d7369f79bd8', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 121, '190f7ab9-a1e4-5d06-b046-503f4566b6df', 'Động cơ sau', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '318614a2-f7ce-5456-993d-39bde5d6b597', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 122, '26696719-9037-5663-a674-4b65ea4b8750', 'Bộ điều khiển IC (5 con ốc - 10 nắp chụp nhựa)', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '13fe4987-0fe5-56bf-8d16-8cf366be9f9e', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 123, 'c0168953-f28f-51d3-835b-7686ac972bbd', 'Chip', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '93cf9a6b-abfc-5365-af39-0fb8fa740d4c', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 124, '2f81a71d-c103-5b63-825b-02798bfbdce3', 'CP (APTOMAT)', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9957236f-53dc-5493-9527-9201d648a4bf', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 125, '500fae61-05c4-59e1-b773-a94a2389312f', 'Khóa yên', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '81be95e6-2960-5f5d-bb61-8ea0adffbf23', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 126, 'a6a4b6db-bf6f-5ffa-9c1f-8467fa903b63', 'Bộ bi chén cồ', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0282a07a-79b0-51db-aa12-772aa481f323', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 127, '3645e2ba-1c42-586c-b9ea-bc7468ba9235', 'Còi xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '61d9cf22-effa-51fb-9a3e-07c95ab0dc25', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 128, '11ab3af5-233e-5720-9c3e-961cd59b466f', 'Cục đổi nguồn', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '38661032-453d-59c1-a0bf-f728df142fea', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 129, 'd1849b84-e3ed-5ad2-98be-a1ac03d31632', 'Dây sạc USB', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2a8927b6-9c1e-51f0-8bb5-aea9d24edef7', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 130, 'c144f1f2-6590-5e9b-aeef-b98937a22b89', 'Dây thắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a2b5fe4d-5dd7-5c72-921f-32738a8b8a67', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 131, '3cbe92b6-9fe8-5e06-a01d-2e0fd0e3ce18', 'Dây khóa yên', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9b83a5ab-48ec-5bb7-ab0f-4047e0429e33', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 132, '8787898d-3a86-5303-a2c1-8938033c52d7', 'Dây điện chính', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2334b817-f29f-5aea-846f-0fa74a8332ba', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 133, '31231427-124c-557b-993f-576e3f9dda3f', 'Dây sạc xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'beac3b86-988c-5682-8c21-5a4c9d7ea5bf', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 134, 'c7be6dab-4122-5682-8400-43e8715ef458', 'Dây điện đơn CP', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f8b6edb5-320d-595d-a7ce-b278a46f682e', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 135, '23959935-df23-54c5-8c80-bd8c89b21178', 'Bộ dây điện có cầu chì câu bình', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4e456e64-948e-530f-b3b2-030e53f930ac', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 136, 'e0a41f09-bbc4-549c-822e-bd24801387f8', 'Công tắc còi xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd8909b5f-6c7f-563f-b13f-8ea389cdde79', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 137, '8a058867-7361-5758-bb34-bec057b82f80', 'Dây chuyển đổi Trắng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7c0a13be-7e6d-5455-bfd6-7e6c24390459', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 138, '07b0660c-0591-53be-9712-81e07ed39103', 'Lò xo chân chống nghiêng', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '772efd60-197c-5fa8-9001-093610758c48', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 139, '046c7305-08f9-555b-9d0e-cbd679367115', 'Lò xo chân chống giữa', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '98ec6b88-6d04-57d5-b26c-45b68b853b24', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 140, '18262e13-8ed9-5ed1-a827-b61790ff6279', 'Van hơi 50', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f83e1204-b08e-5e51-8d5b-4f154f483348', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 141, '731dc522-b874-54eb-837b-b9c6c1930689', 'Van hơi 70', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b947bdc9-0b65-5a61-bfc7-06cc57454770', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 142, '513c9518-5f81-528e-b280-2ee1c024058a', 'Nút bịt trục giữa', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b482cb63-d04f-5602-9a66-4e6c755671d3', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 143, 'c66f91f1-0544-571e-a28d-46851267d033', 'Cục sạc xe', '10.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '63bc50f4-995c-52c8-a8ba-a315c9930b47', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 144, 'a262632e-4e42-5f59-97d4-cd64a295747c', 'Trục M12 x 190', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f51f6ed4-382d-5355-8bb9-95a12c90e675', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 145, 'b7bad263-96d1-57b5-a555-5298d5055eef', 'Trục M12 x 224', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e1d4ca4a-bf57-598a-b109-e891d6bae615', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 146, 'ee60abe0-04cf-5171-8e2e-9ef4b5f80032', 'Bu lông M8 x 20', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '312ef92f-c4c4-5dc9-8685-d70304749c04', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 147, '538dc09b-45bf-5684-8b25-4f15f95757ac', 'Bu lông M8 x 30', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5903ee65-70e7-51ac-8bd1-1f9e769d2df7', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 148, '998e3070-2dc6-560c-9c85-8c2b2d788ebd', 'Bu lông M10 x 25 chống nghiêng', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f51b71d3-e71c-5f25-8d5c-5a47eb040d78', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 149, 'db8354f8-5308-56c7-90cc-e9dee08ee532', 'Bu lông M6 x 12', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'de9d395d-e042-524f-9e44-10d912e09a04', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 150, 'ca8c54f2-5504-5ab9-8dee-e9c2111c0eeb', 'Bu lông M10 x 40', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '80bb2173-ca4a-5cdc-8610-e6a690b56453', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 151, '9702bd6a-1821-56bb-81a0-337af726d4f2', 'Bu lông M8 x 37', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '914a382c-579f-5d4e-906a-a980309ab88e', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 152, 'c65cc0d2-e54f-5c14-950c-f338653ba17d', 'Bu lông M6 x 16', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4b936353-4558-5607-b9f7-1393d838f25a', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 153, 'd9e8bd6c-3d50-5208-a853-5298d509d6a8', 'Bu lông M10 x 25', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a687e704-d9dc-5a91-a8a2-1b4faa43b0b0', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 154, 'e7ee4627-05ed-5167-800b-a21994397cb0', 'Bu lông M3 x 25', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '75c8ebbf-b416-5eef-89be-b575edb648b6', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 155, '1d80c741-0200-5d51-a97a-24dd3511e2d8', 'Ecu M3', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '596a7f01-077d-5009-8050-66dca9bdc29c', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 156, 'b76a85e4-8263-5e88-9c80-a45a3537db8c', 'Bu lông M10 x 45', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1d179f77-79d5-5d26-9bed-2dace0ec4174', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 157, '674625ae-37ae-56c7-a0aa-d60e9872fad1', 'Bu lông M10 x 35', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '188f2d9a-5d14-59a3-8bef-dfcfe726405d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 158, '3f86d8b6-6b50-5428-be07-98c051c5a43d', 'Bu lông ốc vít M6 x 12 ren mịn', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '422552e0-35a8-50e1-9652-9a18ec844b27', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 159, 'a1c7413a-7e1b-5307-b166-21dcbbd0e75a', 'Ốc Vít M4 x 12', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dd51c569-a0f9-56bd-9e2c-b1f239e3402e', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 160, '12f767b4-075a-5279-aa47-5b8315bcbbb3', 'Ốc vít M4.8 x 14', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '285177fc-9832-5cd3-9756-1ab346347660', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 161, '0832a0dc-b12b-575d-8110-19d7190bb065', 'Ốc vít M4 x 14', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e00cb9b4-e9ed-5fc6-8730-5493de65fe40', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 162, 'ab17123f-c774-5b7b-93c0-8b82f37280a6', 'Ecu M6', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '08308a0c-946b-55b9-a3b8-ea7a9f3ee51d', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 163, '4b226213-bca0-511d-947a-f071fe16c7ed', 'Ecu M10 có khóa ren', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '080cef17-a648-5d53-b03f-0de4e33f6475', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 164, '821146bc-3c62-5fcc-b597-72f16b67dd05', 'Ecu m10', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '07879c02-7f58-5e93-af2b-87e6159f3e15', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 165, 'c9218497-a739-5b95-ac20-235f3b023515', 'Ecu m12 có khóa ren', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dea64599-43f3-5b22-9ebc-d71c42270b03', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 166, '1d6ee912-7665-511e-98eb-6b113c279bd2', 'Khâu dài trục m13 x 20', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7424689a-e143-5a74-a773-587827063574', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 167, '4eceeb12-da97-59e4-a66c-d05cb39089da', 'Khâu ngắn trục m13 x 17', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5cfa7e64-63d9-5d2a-84a9-b72989c6f876', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 168, '0a5206a1-b840-5712-957e-1785edbfd8ac', 'Khâu cổ', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b211e581-72cf-573f-909f-e404aee97b3b', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 169, '3f8d9c58-8c48-5d33-b170-573f354bada2', 'Khâu chống giữa', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'cf900e29-5dc8-5995-818e-f88ac4e59b13', 'b279c4c4-b5f6-5fa8-af8a-9edffd6c4bab', 170, '2b4e849b-81ce-50e3-b23d-09b9e8e655ff', 'Nẹp bắt vít 4 ly', '14.400', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 'PO-202606002', 'f52bdbc8-8918-5354-ab43-182ce9b6e97f', '2026-06-12T18:29:28.601Z', '2026-03-12T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'D002 1 BỘ MUA LẺ NGÀY 12/03/2026 - XE ĐĂNG KIỂM', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '28ad7860-d7c6-5032-bc01-bb48d2768b0b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 1, 'e3098d27-0284-501d-a0ec-e46445887fa8', 'Ốp đầu trước', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'cd6b859b-6e08-5c97-ad33-aa31e87849b7', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 2, '569fb5aa-262e-5479-948b-aff027822865', 'Ốp đầu trước trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ea426330-7f8f-59aa-9a71-aed81a50c824', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 3, 'b0da05a1-b689-5ece-a70d-b0e6fcdc8b95', 'Ốp đầu trước xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3434f931-26ac-5cc1-9c26-3cf44f2d4b6d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 4, '5c38e394-ba6a-5971-a68e-f94e58d2a3cc', 'Ốp đầu trước đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '60d910e8-a9df-549b-bc19-2e76d8d6fe4e', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 5, '65bfe454-fff1-50cd-b34b-08a4bf16a414', 'Ốp đầu trước xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6c3cf2d1-2858-5e5a-8c36-b22ee992a4ce', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 6, 'ed2a0e56-1a58-5737-b359-b0b30dab9542', 'Ốp đầu trước đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7855e807-d7df-5c77-ba70-cb1fc300d4ed', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 7, '7deb50f4-3a53-5e8d-b3d5-8580089de146', 'Ốp chắn gió trước', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '197b018d-d45b-5084-8f09-8e2f3a87756c', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 8, 'd07e4abd-1aa7-5854-8060-bb78b623e139', 'Ốp chắn gió trước trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2e573717-0a83-5617-b11d-834e71823656', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 9, '6dd263fa-9eab-5604-ac96-2fd75c4da83b', 'Ốp chắn gió trước xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f0100217-0750-58a9-a0d5-6caf4f8130e7', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 10, '47fa7773-4d02-52ba-b18d-dd1c50e77c18', 'Ốp chắn gió trước đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd95dab9f-a837-5105-a0a5-02a5c30b45a9', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 11, '38581456-294d-5e23-aee6-d2ac0a7f11d1', 'Ốp chắn gió trước xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'cea8ece5-5a71-5c32-b651-3cf7c4e3d912', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 12, '8c69d188-97e3-5948-b1d8-dbbca75544a3', 'Ốp chắn gió trước đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b646533f-08c8-50ec-845f-95179a833ed9', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 13, 'a970c451-f713-54f1-b6bd-0821d37adca6', 'Tấm nối chắn gió trước bên trái', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4abd2b87-75bb-5734-95d2-f91fa27e4cd3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 14, 'a0ad3acf-36f3-51e6-8b72-ea2538218497', 'Tấm nối chắn gió trước bên phải', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1609e954-c0d1-5ace-b77b-892e0a35b8c6', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 15, 'dd078068-be40-53ad-a7ff-c0db3687387a', 'Tấm nối chắn gió trước bên trái trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ca671c67-6ddf-5d5c-b1c8-72c3b94b5780', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 16, 'be28b492-8b1a-5356-a836-42c7b0d11711', 'Tấm nối chắn gió trước bên phải trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '084eb5f8-4ee7-5fd4-b22a-1752176aa813', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 17, 'a18025e1-d6d3-584b-a439-350f2e88d263', 'Tấm nối chắn gió trước bên trái xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f150244f-cae8-5d73-a31d-0b75c2cf1668', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 18, '153006a8-06ab-510b-abbe-0d8c313d2e51', 'Tấm nối chắn gió trước bên phải xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'edacac18-e952-50b3-bd1e-21bcdf6a92c7', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 19, '5a5f01cb-f41c-5250-b147-7156a548612a', 'Tấm nối chắn gió trước bên trái đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '553906f5-48e5-5d4f-8007-46c7ce09c01b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 20, '8c2d6bcb-fd70-5b29-b636-c946e7144fbf', 'Tấm nối chắn gió trước bên phải đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '53bca450-ec98-5bc3-ba53-b167bc908b85', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 21, 'c4271174-060b-5b19-bcc1-03002a563561', 'Tấm nối chắn gió trước bên trái xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '79488ec0-bf39-543b-931e-a8c983aa23e3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 22, '273a7eea-70c0-5502-84a3-3184733e4364', 'Tấm nối chắn gió trước bên phải xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1eb4fac4-1251-5c9d-ba08-051cecbd0fc0', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 23, '4123831d-cbe7-5426-88d7-df19e6d0a045', 'Tấm nối chắn gió trước bên trái đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5bde6459-08ac-568a-9646-80490dee5771', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 24, '261da775-261e-59ad-b101-cda3f77764a4', 'Tấm nối chắn gió trước bên phải đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e0f537f4-53af-574f-b676-94164f229241', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 25, 'a3607267-389b-515c-999b-6c9f10ec6f64', 'Thanh logo mặt nạ xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e6343acb-8041-561d-82ee-34ec30dc2ff8', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 26, 'd378b061-e1f7-566d-b3cf-2006e26719a9', 'Chắn bùn trước', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5ec95ac5-0d53-5ca4-9c15-f7292158c385', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 27, 'fa3c49f7-d141-58fc-b4af-147fca130c2c', 'Chắn bùn trước trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'cfd29bd8-249d-561a-a4a1-3275ca922d82', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 28, '73842302-3667-5686-82b7-eb3b29197db7', 'Chắn bùn trước xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8400532c-a511-5c8b-956b-6842bbe1bb2c', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 29, 'b818af0e-724f-5ae7-8488-81a4c8eabe15', 'Chắn bùn trước đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '72b006d8-fa83-59a7-bd46-42bbc4efc697', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 30, '0d6bc7e6-05b6-584b-bab3-63fa95cfed55', 'Chắn bùn trước xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ca3d6dc0-3b4d-567c-b355-4df1ae021f8e', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 31, 'e13570cb-2881-571a-b991-f4f5c5ac0571', 'Chắn bùn trước đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3f888e82-4592-55a7-8d3c-b1089e854cb1', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 32, '62671ea8-4582-5327-b189-38068f61cd80', 'Vành đèn pha Xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c99c0d60-85ba-5774-8941-40f09be9eccc', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 33, 'a3627167-d29a-52fe-a443-53f357acabaa', 'Ốp để chân trái', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '334a3188-5c6a-52fe-a85b-f77b36ee4b57', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 34, 'd4d6e8dc-52a6-5187-8fca-f0f59acf4c0f', 'Ốp để chân trái trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '71505322-ff58-5aca-b515-497a0a808fe3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 35, '078d8fa7-2b42-555f-9e57-d92200ec0ede', 'Ốp để chân trái xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e30411ef-0439-5d5d-bebc-3968260c8234', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 36, 'd0d96135-9ea7-55f6-ad3d-4e156e1a7c50', 'Ốp để chân trái đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4ffa5e2f-467e-5270-81f3-1af5e9316c07', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 37, '8d98b7ef-3fc2-5bf2-834a-0036ec530366', 'Ốp để chân trái xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd29593fe-1d58-5e39-8c03-8ef53415f53d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 38, '6a67911b-53db-5158-a57f-17610a76ce62', 'Ốp để chân trái đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6ddf0cae-3001-5cc2-8e81-378a672b520b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 39, 'c080bb34-51aa-5b77-9f39-1639b93e9eb9', 'Ốp để chân phải', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '509b8037-35aa-5961-b286-04c714c7c790', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 40, '2603262f-e684-50df-af9f-15f1ac0038bc', 'Ốp để chân phải trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '21e8ba6e-1e64-5b48-bf4c-81350ac5d968', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 41, 'f22de075-65bc-5943-b6f6-ef34b2cbedc5', 'Ốp để chân phải xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3819b5c1-a19d-5164-9ea8-880fe786d86d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 42, '1dbc6e33-efe4-5924-a4ed-8a7a615445ee', 'Ốp để chân phải đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1715c757-efad-50ed-83aa-1b09bc2eb6d2', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 43, '5ff135d7-2d03-599b-bee1-3b0fddc04f19', 'Ốp để chân phải xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '04b9a53c-7deb-502b-9140-676efb4242a7', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 44, 'caaad947-ad15-547c-b8ca-ee2efe862ca6', 'Ốp để chân phải đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ea24f878-9bc3-57e0-9c93-965e8585819a', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 45, '230bd9da-c94c-5f3d-9ac3-ee7b22354465', 'Ốp thân trái', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '56d58ac1-b7e0-5302-9bf2-22b01222a986', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 46, '496483b9-1ad9-5490-b207-117f5d528363', 'Ốp thân trái trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '62e4397c-1496-5ddc-a2e2-9fa135f8b5ab', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 47, 'cfcd55b7-60fc-5247-a918-7462b323c2b7', 'Ốp thân trái xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '666a5b16-3b5e-51f2-9711-7e4197b9af77', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 48, '61a8e4bb-d2f9-544a-ae68-21b3c9988019', 'Ốp thân trái đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '06ae09e8-7357-519e-8f64-7b6d08e10e34', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 49, '36efe13a-4ba2-5166-ba04-4f02726b7664', 'Ốp thân trái xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6ba27868-4e18-5bd9-93d5-a1ab29cbca12', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 50, '6b26dbf6-e871-5b8b-8882-3fa779727604', 'Ốp thân trái đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6304a769-10cc-5974-8b37-fc73a5090828', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 51, '6500c855-dc7d-5852-b905-811353010a4c', 'Ốp thân phải', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '077eaf7b-604b-509d-a93e-3350d6ab7270', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 52, '555c5af3-d0ac-5b78-9468-3d39d505bbd9', 'Ốp thân phải trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '044c4e73-2d28-5073-b065-48a691cd6ed4', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 53, 'cf7e497f-00f0-52a4-bc11-c212788163c5', 'Ốp thân phải xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4d7e8acb-9616-5cee-b956-e4415e0a0724', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 54, '9a74c815-e459-5883-a1d8-d83663ed0cf5', 'Ốp thân phải đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6e0681b9-43dd-54a2-84a8-5570dcb2e635', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 55, 'bd716143-169b-5e40-9dbb-c40da89af40a', 'Ốp thân phải xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4bbeb364-10b3-555b-8397-ef7da306eaf3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 56, '023b0464-9d47-55c9-a838-8c3ecb28c3e7', 'Ốp thân phải đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '35700f5b-fe20-5a0f-8283-9f24def278d6', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 57, '87561f0e-92ab-530e-8de4-c230f8d3fe8c', 'Ốp trung tâm', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ec803fde-cd1f-5f9f-a98d-838308e08132', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 58, '1f4ad259-50a4-5d61-aefc-813729d7b783', 'Ốp trung tâm trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '08b09a1d-44b2-5e2d-b0e2-adacd95aa53f', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 59, '6c4d9658-8f30-5c0e-b272-946c2cea74d9', 'Ốp trung tâm xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c8a86b5e-b601-58df-b21c-e1db860e907d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 60, 'a314799c-b544-5e71-a5ce-974537d105c5', 'Ốp trung tâm đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a21167c7-9e39-5982-9681-e9b2aba6eb2f', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 61, '372d7704-1456-5d34-85ef-b833cdd66079', 'Ốp trung tâm xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c1bfd4de-6437-5bb7-860b-c23d8803188f', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 62, 'a0718c62-2bea-519d-8b59-7f6364a4a5b4', 'Ốp trung tâm đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3eae782e-2723-5f59-93b0-52dca722f4a7', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 63, '58e1908d-d14a-55fc-87dc-994f0ce7618e', 'Tấm nối ốp thân xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '06f8612c-cf53-527f-9e49-64dbf7f91c25', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 64, 'fc0cf2d1-594f-5b80-9415-f2dc43a843c2', 'Tấm nối ốp thân xe trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bb5f783b-2e0c-5ad4-bcae-6ab0f6941c50', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 65, 'd2f7f86a-5dd9-5b89-856d-c8bf9d73df9b', 'Tấm nối ốp thân xe xanh', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4a09ff31-0363-5391-b031-4c5ac4af96d1', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 66, 'a05d3846-701b-590b-9f43-1d6b347cce76', 'Tấm nối ốp thân xe đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e91ad09b-9ec4-52ec-b0ca-3292dce8b675', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 67, 'b35d6491-3abf-50f8-896d-99c4108c56c3', 'Tấm nối ốp thân xe xám', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b5f618b2-b410-5296-99ad-5b04f0090d02', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 68, '88b125f0-20d9-540e-a051-8fc5ca076763', 'Tấm nối ốp thân xe đen', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '542e0817-5d59-5886-a924-557413123285', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 69, 'ca377c43-a184-5750-af0a-0e89a4e76bb0', 'Ốp đồng hồ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2c9b2972-2a6b-50db-96e0-53c2fe43a699', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 70, 'b87b46ca-7d5c-5153-8702-cb7f63192711', 'Chắn bùn trước bên trong', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9a3f6918-497c-5a19-bf7e-7dadf887049d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 71, 'a52b2e04-78b2-5e50-9c19-c91b9dd11767', 'Nối hộp dụng cụ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '632bfa63-5a7e-5fb8-88e0-bf0601cac772', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 72, '10fb7b3d-953e-5c66-b798-732f4ba04598', 'Hộp dụng cụ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9da60113-ac18-52af-b3d7-fd756448bc77', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 73, '445429e6-b561-5e7f-b09b-d0bba29a5a59', 'Nắp che số khung', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '391132be-dda4-516e-8392-8b295c06d7da', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 74, '0860f254-d05d-5962-80fa-50cefa502252', 'Hộc để đồ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2b46b30b-e628-50b5-a014-8d864511c33b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 75, 'd5e480c3-b641-54d7-aac3-4b892a1dea9e', 'Cốp xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9cc27449-fbe2-5a66-8e53-dc98fefe0af2', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 76, '6f3e1d3e-5c6c-5040-97bc-3af0e6956416', 'Sàn để chân', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'aa148358-4b94-5397-baed-b054d1bde7b4', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 77, '09d77103-ce6f-5c14-9bd1-f612880362f5', 'Cao su bịt sàn để chân', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '318d3a09-e6ac-595f-9456-9016aa6a1722', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 78, '91fc8df7-619e-5033-9d45-e6000c25f3c7', 'Ốp gầm xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ff832c2e-c74b-5875-852a-15744059dbc2', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 79, '92e15d0c-0b27-5eba-9aa2-34858c13f009', 'Ốp trước cốp', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ecfd1c67-6a95-59cf-b8db-ae111c2ceeba', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 80, 'b3772105-d2b5-5a5a-827e-c172020a2cd6', 'Để chân trái', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ef47f785-97da-51da-a23e-3b6314ea3564', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 81, 'd132e4d2-3ab7-578e-8cb1-a851849c771e', 'Để chân phải', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5ec0f72f-b1db-53d5-93e0-8bebc4bb04e6', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 82, 'e3144fc2-261b-5b83-b52b-d6c91433df51', 'Chắn bùn sau bên trong', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '220a7580-2925-5da3-9271-04930b16d1cf', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 83, '0adef39c-3871-537e-a481-0ebc4f1784e0', 'Chắn bùn sau bên ngoài', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '344e55d8-2e6e-5dcf-a236-4333ca712811', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 84, '81aa2503-58b3-50fc-900b-d39f90334656', 'Đuôi gắn biển số', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7730345e-4594-5f14-a69a-9969be4b80e7', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 85, '51abdec1-42d6-5de8-82f0-cd16ae55108b', 'Đèn pha', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4b8d13e9-75cc-5f79-befc-b7da1a0090ac', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 86, 'cfa056b9-8c94-5e7e-bfc5-47dd97729dc3', 'Xi nhan Trái', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '25334d8a-4eb1-5e8c-be08-959764a3baf3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 87, '56e53bae-9bcb-5a47-9c61-85d5c9dcb337', 'Xi nhan Phải', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fa391fc7-8696-5596-8aa6-c8f17bee674c', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 88, 'b0ec7835-f119-5988-8943-c9ed9c51a2de', 'Đèn hậu', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '58dafe8a-23cb-5433-ab98-249a4628a319', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 89, '8dcc316a-61c4-5369-a77f-28984c2f1f66', 'Đèn biển số', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8e152e6a-a1d2-55c5-9aeb-9ce5078bfac2', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 90, '71ab9290-76b7-59d7-86f5-64b6c5aafb53', 'Ghi đông', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '48e55bb7-25e6-5b9e-bde9-d98e9565e201', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 91, '3d64c676-f3c4-50ea-a30f-930c7aa2dc6f', 'Gắp', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f0892890-2f9c-529e-a0b5-0f693e7c20ce', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 92, '9d75caa9-5dba-5973-b141-70a32a8c7571', 'Chân chống nghiêng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2021f633-4df0-5160-a5af-57f9a7f1e337', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 93, '000cf6c5-1f66-5c9c-ac65-76d1a24491b5', 'Chân chống giữa', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '80557800-32ec-5a24-b1ed-e8a40f9bb616', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 94, '5b7b5a0d-ec87-590b-9feb-7019bcf5bc26', 'Khung xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '40557f80-f295-51f4-a98f-1175e3c39db3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 95, '9b7b429d-93ce-5a81-92df-8623970b1e65', 'Yên xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4eec7f70-3989-59d2-bd40-0535d8b4291b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 96, '8b63dd58-61cb-53c3-a3c8-8449aef69e30', 'Cảnh báo đỏ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd63a935f-bc7b-5f00-a252-a0007d2ece07', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 97, 'f8374b14-08e8-58e9-beb4-b6ec7d9f3076', 'Cảnh báo tròn vàng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '039c6e86-4701-59be-a8b0-1783415045b3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 98, 'da4bc5ca-037f-5185-9d04-e8cf879c67a6', 'Móc treo đồ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5ac18fb7-4431-5cbd-b306-3c0a14aa5174', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 99, '2b3a3e47-a84f-5d0a-a9df-ec11b1ca5bde', 'Tay dắt nhôm (cảng sau)', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '234737a9-7aab-5ecc-aef3-9a8340acfb9d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 100, '230105c6-5274-5a3d-9e71-bc439aeecf07', 'Đồng hồ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '64fdffdb-bd62-5bbe-932a-35368655e1b7', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 101, '2a086bd2-49d4-59bb-b188-05a4aa0bddd5', 'Bộ công tắc trái', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0f528d41-3f5a-5c5c-a2a9-0803c999f0f0', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 102, 'ab4b8189-0be5-56fe-b97d-4c33fbc0209e', 'Bộ công tắc phải', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f515fd3a-0ae9-5a7b-8cba-953303faa717', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 103, 'feaed352-c515-5dda-bda7-f09733b3c431', 'trục giữa', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '11c8d848-ba8f-578a-a886-af6565577a51', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 104, '12a699f8-0a50-53a7-84e4-e55ddf39ba51', 'đùi bàn đạp', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a9d1fd8a-6828-5cc5-8841-97539dc93809', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 105, '57e805fa-8730-5931-ade4-bca3d12e5dd6', 'bánh răng trước', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5b9db82a-25ba-54a9-b5d1-89b63cd3748a', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 106, '93d52ca7-dc63-5ac3-a9bc-da08edddffcb', 'bàn đạp', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '880c6345-4b07-5a0e-8072-e92c6cdd8234', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 107, 'b5d6d51c-bf60-5f24-9636-05b19405a175', 'xích xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bea377a3-3f70-59cd-a237-f70211815da3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 108, '5dca96ea-d9a7-5f3f-a41f-89d3ef514b6b', 'bộ côn nồi giữa', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '29babed6-11c6-58cd-a388-0e69a105aa24', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 109, '6108637a-f478-5318-8632-5155e4020876', 'bánh răng sau', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'cd82edec-f3b3-5a66-b8f0-7b34da194b8f', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 110, 'fe90d679-fbe0-59c3-854a-e87af73e7848', 'Bộ ổ khóa', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '01cca12d-b3e5-5d96-909e-ae171a9a7301', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 111, 'da7d9952-adf1-5721-83ab-c4325a4dfbc1', 'Chảng 3', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fab6e016-8c72-5856-9c3c-9b2658203ccd', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 112, '872fd8e8-623d-5257-b268-329454f6d676', 'Phuộc trước', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '457cde3c-8fed-536a-8c2c-728a287ad7b6', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 113, '36081cc2-aadd-5560-a643-79ce69b7cea4', 'Phuộc sau', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '56e439f2-3b9e-55af-8a24-245e06f98368', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 114, 'b623493f-3849-56c6-bb71-1e21eceb7659', 'Tay thắng trái', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '06e7b749-26a4-525a-bb14-02f0f9810eec', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 115, 'cbb144f2-7e20-5f32-9d6b-66dfcda41bef', 'Tay ga trái', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9233a528-0c83-5e8d-9257-56bf81f445f2', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 116, '101dfa2a-238b-56f8-87b5-3d89a6398384', 'Tay ga phải', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c30db30a-2d3f-5545-a476-9c58ad6c8147', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 117, '6170ab67-25bf-5031-a334-803870506ff4', 'Tay thắng phải', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd6d2f0e6-f534-5ad4-8db2-1e29758b8fa0', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 118, '7098220d-6ea5-584e-ab94-6cc1dc676981', 'Đĩa phanh trước', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7990eb43-26e6-5959-b795-4d05aafa02c3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 119, '0b06fb8b-d827-5dc4-a4bc-3c22062c5ea2', 'Mâm trước', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '00ee2daf-5213-5278-991b-23048f819fbe', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 120, '40b34923-04bc-5558-aeca-87a6b53fc5f7', 'Cụm phanh sau', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5d2c15a5-51ac-5d82-9cd3-da669afc3c81', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 121, '190f7ab9-a1e4-5d06-b046-503f4566b6df', 'Động cơ sau', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2b9f4b03-3800-5a85-805f-2338644a7515', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 122, '26696719-9037-5663-a674-4b65ea4b8750', 'Bộ điều khiển IC (5 con ốc - 10 nắp chụp nhựa)', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0783bad2-8382-519b-8593-e84ead9c193b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 123, 'c0168953-f28f-51d3-835b-7686ac972bbd', 'Chip', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c9dbeb8d-a59b-568a-bdb2-1540ebd86a58', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 124, '2f81a71d-c103-5b63-825b-02798bfbdce3', 'CP (APTOMAT)', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4addbcb5-3e9d-5f62-baf7-39d91126a3f3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 125, '500fae61-05c4-59e1-b773-a94a2389312f', 'Khóa yên', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd718c8bb-9cb8-5b41-ac9a-942fdc78c8f0', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 126, 'a6a4b6db-bf6f-5ffa-9c1f-8467fa903b63', 'Bộ bi chén cồ', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '765ace51-5357-5397-9730-7c424e627649', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 127, '3645e2ba-1c42-586c-b9ea-bc7468ba9235', 'Còi xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0f4d560e-4d00-5c9c-b3dd-61243ece1d36', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 128, '11ab3af5-233e-5720-9c3e-961cd59b466f', 'Cục đổi nguồn', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6ffb450f-e8d7-53b9-9218-ae0bfd223687', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 129, 'd1849b84-e3ed-5ad2-98be-a1ac03d31632', 'Dây sạc USB', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'acc2fb5e-e223-592e-9afc-57cdca58f17b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 130, 'c144f1f2-6590-5e9b-aeef-b98937a22b89', 'Dây thắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '03e8b96e-c304-51fd-8b50-231738356923', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 131, '3cbe92b6-9fe8-5e06-a01d-2e0fd0e3ce18', 'Dây khóa yên', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2b662a29-cc21-5817-a5e5-a2d9813e145c', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 132, '8787898d-3a86-5303-a2c1-8938033c52d7', 'Dây điện chính', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '51eb193f-a7a7-5349-b37a-aee68ebfbb1d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 133, '31231427-124c-557b-993f-576e3f9dda3f', 'Dây sạc xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '13d96a70-5db8-53ec-a80e-81bb30e6257b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 134, 'c7be6dab-4122-5682-8400-43e8715ef458', 'Dây điện đơn CP', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6797d9b4-48f3-5edf-be0a-b7e3f1068397', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 135, '23959935-df23-54c5-8c80-bd8c89b21178', 'Bộ dây điện có cầu chì câu bình', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7df82486-8b42-525a-bd6b-a13beacf392c', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 136, 'e0a41f09-bbc4-549c-822e-bd24801387f8', 'Công tắc còi xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '92450643-45f4-5b00-aac3-d39829ebe295', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 137, '8a058867-7361-5758-bb34-bec057b82f80', 'Dây chuyển đổi Trắng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8b0fbdc3-26e4-5848-9f0d-96c580e2ed24', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 138, '07b0660c-0591-53be-9712-81e07ed39103', 'Lò xo chân chống nghiêng', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '397d4a15-1297-598a-b692-81d138f1dd95', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 139, '046c7305-08f9-555b-9d0e-cbd679367115', 'Lò xo chân chống giữa', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'aba73d35-cb80-5abc-b83a-f7c2c327cd9f', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 140, '18262e13-8ed9-5ed1-a827-b61790ff6279', 'Van hơi 50', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ed44b5e3-f94b-5b9f-88ca-fb9787f9e1d3', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 141, '731dc522-b874-54eb-837b-b9c6c1930689', 'Van hơi 70', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5b7ccebb-9779-5c40-8f23-b16c9f2147cb', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 142, '513c9518-5f81-528e-b280-2ee1c024058a', 'Nút bịt trục giữa', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '84c1edce-824b-5f4a-bb8c-fdd4ce561a5c', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 143, 'c66f91f1-0544-571e-a28d-46851267d033', 'Cục sạc xe', '2.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ae8f3326-85cb-5092-a646-da17977bb68d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 144, 'a262632e-4e42-5f59-97d4-cd64a295747c', 'Trục M12 x 190', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c4d9b976-7452-5f06-a994-491d1b4d8411', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 145, 'b7bad263-96d1-57b5-a555-5298d5055eef', 'Trục M12 x 224', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd542c1cf-caeb-5d4b-92bb-3bdf1ee347d1', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 146, 'ee60abe0-04cf-5171-8e2e-9ef4b5f80032', 'Bu lông M8 x 20', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1f9370f1-83f7-50ed-8a5c-1368ba8ffe82', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 147, '538dc09b-45bf-5684-8b25-4f15f95757ac', 'Bu lông M8 x 30', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '49ae389d-04d8-55be-ac63-a199362fe33a', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 148, '998e3070-2dc6-560c-9c85-8c2b2d788ebd', 'Bu lông M10 x 25 chống nghiêng', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '538d8acf-8b00-5900-a883-b198d5594893', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 149, 'db8354f8-5308-56c7-90cc-e9dee08ee532', 'Bu lông M6 x 12', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1fee0d7e-c00b-5e72-8528-2e3fbbecd45e', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 150, 'ca8c54f2-5504-5ab9-8dee-e9c2111c0eeb', 'Bu lông M10 x 40', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6d59cea4-6f04-5771-b9c3-7b83ae2a4ee6', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 151, '9702bd6a-1821-56bb-81a0-337af726d4f2', 'Bu lông M8 x 37', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd06c998b-ed74-5cea-8ca9-fa87dbde611e', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 152, 'c65cc0d2-e54f-5c14-950c-f338653ba17d', 'Bu lông M6 x 16', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '33f64202-9bab-5821-891f-91735c9524eb', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 153, 'd9e8bd6c-3d50-5208-a853-5298d509d6a8', 'Bu lông M10 x 25', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6c56be6d-57d4-5cab-a0bd-9df49dbd2fef', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 154, 'e7ee4627-05ed-5167-800b-a21994397cb0', 'Bu lông M3 x 25', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3848fe91-64c4-56a2-b7d5-cb039ed12dec', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 155, '1d80c741-0200-5d51-a97a-24dd3511e2d8', 'Ecu M3', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '462ee588-4996-54e1-92fd-856413f4a687', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 156, 'b76a85e4-8263-5e88-9c80-a45a3537db8c', 'Bu lông M10 x 45', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f0b30c43-1a0a-52bf-888a-1a415d5d9bb8', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 157, '674625ae-37ae-56c7-a0aa-d60e9872fad1', 'Bu lông M10 x 35', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '909adb1e-719f-5700-b3de-381ec8cb6c05', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 158, '3f86d8b6-6b50-5428-be07-98c051c5a43d', 'Bu lông ốc vít M6 x 12 ren mịn', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ef7ae31f-d057-5f33-b8bf-fb4237d5e30a', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 159, 'a1c7413a-7e1b-5307-b166-21dcbbd0e75a', 'Ốc Vít M4 x 12', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6e0bf974-ac61-56f9-82fd-4a7303ea736d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 160, '12f767b4-075a-5279-aa47-5b8315bcbbb3', 'Ốc vít M4.8 x 14', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c5355ff3-e09a-5567-adab-1076a21845be', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 161, '0832a0dc-b12b-575d-8110-19d7190bb065', 'Ốc vít M4 x 14', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '677e76cc-3ccd-590c-9b17-3a60b3ffd6fc', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 162, 'ab17123f-c774-5b7b-93c0-8b82f37280a6', 'Ecu M6', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6a150e03-8beb-5a6d-863a-812bc01ff952', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 163, '4b226213-bca0-511d-947a-f071fe16c7ed', 'Ecu M10 có khóa ren', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'df9b6f45-a0de-539d-9733-9722f67bd1d8', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 164, '821146bc-3c62-5fcc-b597-72f16b67dd05', 'Ecu m10', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b8631a27-158d-5a0f-bac7-025b6e7bec5d', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 165, 'c9218497-a739-5b95-ac20-235f3b023515', 'Ecu m12 có khóa ren', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '832be6bf-c667-5f05-a5ae-467c79c34dc8', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 166, '1d6ee912-7665-511e-98eb-6b113c279bd2', 'Khâu dài trục m13 x 20', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '94bd58f0-418b-5c3d-9d4b-d6c3822c945c', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 167, '4eceeb12-da97-59e4-a66c-d05cb39089da', 'Khâu ngắn trục m13 x 17', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '20a17ca1-eca5-5164-b0fc-ac1f7828cf9b', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 168, '0a5206a1-b840-5712-957e-1785edbfd8ac', 'Khâu cổ', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b8214beb-c220-5ed5-9177-cc52647c4470', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 169, '3f8d9c58-8c48-5d33-b170-573f354bada2', 'Khâu chống giữa', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0bc7084f-4ac8-56af-a1ee-e704ae6cf316', '26dc3e22-7232-5c2f-b9cb-38655833ffa3', 170, '2b4e849b-81ce-50e3-b23d-09b9e8e655ff', 'Nẹp bắt vít 4 ly', '2.880', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 'PO-202606003', 'f52bdbc8-8918-5354-ab43-182ce9b6e97f', '2026-06-12T18:29:28.601Z', '2026-02-04T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'D002 200 BỘ LẦN 1 NGÀY 04-02-2026', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a61f34d3-fa80-5eaa-bce4-178b26351bfa', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 1, 'e3098d27-0284-501d-a0ec-e46445887fa8', 'Ốp đầu trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f55df33f-916f-5511-abf9-aa19e2df0882', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 2, '569fb5aa-262e-5479-948b-aff027822865', 'Ốp đầu trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6bf34134-6e01-5770-ba35-2d0cc262add5', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 3, 'b0da05a1-b689-5ece-a70d-b0e6fcdc8b95', 'Ốp đầu trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f1f1e17a-5d10-5537-bb36-d7fdf94bb88a', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 4, '5c38e394-ba6a-5971-a68e-f94e58d2a3cc', 'Ốp đầu trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5cb12ee7-9188-5978-b2c6-1a8f83056ee3', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 5, '65bfe454-fff1-50cd-b34b-08a4bf16a414', 'Ốp đầu trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '53460357-b816-5085-b4b5-ad13fe254144', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 6, 'ed2a0e56-1a58-5737-b359-b0b30dab9542', 'Ốp đầu trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0d330bc4-084d-5e1e-8df8-c74a9f9f5961', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 7, '7deb50f4-3a53-5e8d-b3d5-8580089de146', 'Ốp chắn gió trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a6aa1aba-730a-5742-946c-00fac7d81b25', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 8, 'd07e4abd-1aa7-5854-8060-bb78b623e139', 'Ốp chắn gió trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7e0be343-b1c4-5dae-a4cc-74ad82f28f52', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 9, '6dd263fa-9eab-5604-ac96-2fd75c4da83b', 'Ốp chắn gió trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b6f7af1e-32eb-5ddf-9733-176964553f10', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 10, '47fa7773-4d02-52ba-b18d-dd1c50e77c18', 'Ốp chắn gió trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '058cffd8-4696-5f43-b406-6342127bd780', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 11, '38581456-294d-5e23-aee6-d2ac0a7f11d1', 'Ốp chắn gió trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6f8f9ebd-6ca2-576a-a8a0-3292d5ea17ee', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 12, '8c69d188-97e3-5948-b1d8-dbbca75544a3', 'Ốp chắn gió trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4b46f8ce-2b8a-5811-a4ba-04e0096622c8', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 13, 'a970c451-f713-54f1-b6bd-0821d37adca6', 'Tấm nối chắn gió trước bên trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6da0be3d-3dc5-5eb1-8594-72dfa851ed74', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 14, 'a0ad3acf-36f3-51e6-8b72-ea2538218497', 'Tấm nối chắn gió trước bên phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ffc86127-6f4b-545e-91aa-0079a163b24c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 15, 'dd078068-be40-53ad-a7ff-c0db3687387a', 'Tấm nối chắn gió trước bên trái trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fc1004c0-7a2e-50f3-9962-868536f1dca8', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 16, 'be28b492-8b1a-5356-a836-42c7b0d11711', 'Tấm nối chắn gió trước bên phải trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0267d23c-ded3-5e35-a7dc-cba826d569f2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 17, 'a18025e1-d6d3-584b-a439-350f2e88d263', 'Tấm nối chắn gió trước bên trái xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f54b1092-d169-5fce-8c25-d7ebf15c1364', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 18, '153006a8-06ab-510b-abbe-0d8c313d2e51', 'Tấm nối chắn gió trước bên phải xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '530c872c-f2c4-5b8b-b234-ccfe66d9bb2c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 19, '5a5f01cb-f41c-5250-b147-7156a548612a', 'Tấm nối chắn gió trước bên trái đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1020ca6f-d802-5710-a6ce-b5a5c2646913', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 20, '8c2d6bcb-fd70-5b29-b636-c946e7144fbf', 'Tấm nối chắn gió trước bên phải đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a5994f90-a6f5-5655-a351-393c9ebbc2ba', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 21, 'c4271174-060b-5b19-bcc1-03002a563561', 'Tấm nối chắn gió trước bên trái xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5a2a55ce-843f-5a91-a805-680d75278115', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 22, '273a7eea-70c0-5502-84a3-3184733e4364', 'Tấm nối chắn gió trước bên phải xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c8cd3dfe-385d-5afb-9192-c351e9d26f8f', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 23, '4123831d-cbe7-5426-88d7-df19e6d0a045', 'Tấm nối chắn gió trước bên trái đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b0e72acf-3b04-51f4-86ca-87d54319a012', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 24, '261da775-261e-59ad-b101-cda3f77764a4', 'Tấm nối chắn gió trước bên phải đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e89f741c-3316-53ba-a47a-a7918674e769', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 25, 'a3607267-389b-515c-999b-6c9f10ec6f64', 'Thanh logo mặt nạ xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2dc6c6c0-1dbc-5751-bff5-c41624516f59', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 26, 'd378b061-e1f7-566d-b3cf-2006e26719a9', 'Chắn bùn trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4f1551bb-893d-50d7-ac93-52f02d0142b0', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 27, 'fa3c49f7-d141-58fc-b4af-147fca130c2c', 'Chắn bùn trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ca88946b-7b42-52f0-9736-a1808b0b8d1d', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 28, '73842302-3667-5686-82b7-eb3b29197db7', 'Chắn bùn trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7faf92d7-64d2-5595-a842-c5c53b81c8b6', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 29, 'b818af0e-724f-5ae7-8488-81a4c8eabe15', 'Chắn bùn trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '70623527-4b20-5bf8-bdd9-699446d4a3a6', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 30, '0d6bc7e6-05b6-584b-bab3-63fa95cfed55', 'Chắn bùn trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bcaa1538-889e-56ee-85e2-f4233f9adf4b', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 31, 'e13570cb-2881-571a-b991-f4f5c5ac0571', 'Chắn bùn trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7f84869d-ccbc-52da-a793-8a29842e267a', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 32, '62671ea8-4582-5327-b189-38068f61cd80', 'Vành đèn pha Xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ebe259b8-22c9-5d6b-b83d-048fbc702d05', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 33, 'a3627167-d29a-52fe-a443-53f357acabaa', 'Ốp để chân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bce1590a-6be5-5acc-acfb-391078d612e2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 34, 'd4d6e8dc-52a6-5187-8fca-f0f59acf4c0f', 'Ốp để chân trái trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '41ff8839-f193-52a8-9839-63283a5314d0', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 35, '078d8fa7-2b42-555f-9e57-d92200ec0ede', 'Ốp để chân trái xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '96bffe95-51d3-5760-8cec-4b14ace6c2a3', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 36, 'd0d96135-9ea7-55f6-ad3d-4e156e1a7c50', 'Ốp để chân trái đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5baa896f-611a-52bd-aedc-eb8e601ec986', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 37, '8d98b7ef-3fc2-5bf2-834a-0036ec530366', 'Ốp để chân trái xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dee20f20-02d7-56e2-bcec-93274545c476', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 38, '6a67911b-53db-5158-a57f-17610a76ce62', 'Ốp để chân trái đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '09b6dc67-084c-5469-8061-a13a589ce5a3', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 39, 'c080bb34-51aa-5b77-9f39-1639b93e9eb9', 'Ốp để chân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '89eeb2d7-1019-5001-808b-9cf8e7c40f27', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 40, '2603262f-e684-50df-af9f-15f1ac0038bc', 'Ốp để chân phải trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b5f86b7c-9f9c-5798-ad5c-7c77ebdbbf22', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 41, 'f22de075-65bc-5943-b6f6-ef34b2cbedc5', 'Ốp để chân phải xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2a6f98a2-c380-5eca-9c89-e2bee66d5e49', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 42, '1dbc6e33-efe4-5924-a4ed-8a7a615445ee', 'Ốp để chân phải đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c69612da-0b0e-5097-9f4b-9e3536e0dcb2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 43, '5ff135d7-2d03-599b-bee1-3b0fddc04f19', 'Ốp để chân phải xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ad9be534-fb3a-5ce4-86bc-684724e10fac', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 44, 'caaad947-ad15-547c-b8ca-ee2efe862ca6', 'Ốp để chân phải đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ebfcf55d-03e2-513b-bd5a-e6e3136d093c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 45, '230bd9da-c94c-5f3d-9ac3-ee7b22354465', 'Ốp thân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0ecc239a-9640-5c25-85ed-dbc746cc47c2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 46, '496483b9-1ad9-5490-b207-117f5d528363', 'Ốp thân trái trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a666b6d8-d86f-5834-ab15-812bbd36c4da', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 47, 'cfcd55b7-60fc-5247-a918-7462b323c2b7', 'Ốp thân trái xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '733cd269-ba75-5b49-a366-d89cc108b11c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 48, '61a8e4bb-d2f9-544a-ae68-21b3c9988019', 'Ốp thân trái đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ef5b5da2-e99c-5b7d-9e53-976f344102c6', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 49, '36efe13a-4ba2-5166-ba04-4f02726b7664', 'Ốp thân trái xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3736a620-51ff-506c-8af3-22047f019365', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 50, '6b26dbf6-e871-5b8b-8882-3fa779727604', 'Ốp thân trái đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'aede3787-eaf1-59f6-9c1a-46d5cf811a2a', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 51, '6500c855-dc7d-5852-b905-811353010a4c', 'Ốp thân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8b890eaa-52b6-5ac7-94f2-d141fa0b065c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 52, '555c5af3-d0ac-5b78-9468-3d39d505bbd9', 'Ốp thân phải trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f45c047e-cb2c-557b-b656-da3dbf696c9c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 53, 'cf7e497f-00f0-52a4-bc11-c212788163c5', 'Ốp thân phải xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ab9d20d9-ef35-5dcf-8d0f-e32099a520c7', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 54, '9a74c815-e459-5883-a1d8-d83663ed0cf5', 'Ốp thân phải đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b61297d4-85ba-5dfb-ab0a-e1f88132c35e', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 55, 'bd716143-169b-5e40-9dbb-c40da89af40a', 'Ốp thân phải xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a8a02a64-8224-5c02-83b0-5fda734f319e', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 56, '023b0464-9d47-55c9-a838-8c3ecb28c3e7', 'Ốp thân phải đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e95a1e56-bbf8-5e81-8cc1-0bb25a06ea91', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 57, '87561f0e-92ab-530e-8de4-c230f8d3fe8c', 'Ốp trung tâm', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '560419bc-962b-5377-99c4-e0026b184750', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 58, '1f4ad259-50a4-5d61-aefc-813729d7b783', 'Ốp trung tâm trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '29ac1498-7db6-5383-8b93-4f283cac1177', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 59, '6c4d9658-8f30-5c0e-b272-946c2cea74d9', 'Ốp trung tâm xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '223ae758-abff-5789-b26a-eb474e81e8d7', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 60, 'a314799c-b544-5e71-a5ce-974537d105c5', 'Ốp trung tâm đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '60f091a9-677f-518e-a00d-6e7772b2ee53', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 61, '372d7704-1456-5d34-85ef-b833cdd66079', 'Ốp trung tâm xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6d079ae1-7668-5d72-a394-6f62e9da19bd', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 62, 'a0718c62-2bea-519d-8b59-7f6364a4a5b4', 'Ốp trung tâm đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c1bfdf9f-b468-5cd6-b2a5-f3d7ea22b1f3', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 63, '58e1908d-d14a-55fc-87dc-994f0ce7618e', 'Tấm nối ốp thân xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '04477c0f-8e02-5440-80b5-1a137a4c83b6', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 64, 'fc0cf2d1-594f-5b80-9415-f2dc43a843c2', 'Tấm nối ốp thân xe trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f92b3ba9-137a-528c-9994-f4853be4ae89', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 65, 'd2f7f86a-5dd9-5b89-856d-c8bf9d73df9b', 'Tấm nối ốp thân xe xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e07a023a-dff1-5868-8906-8531699c708d', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 66, 'a05d3846-701b-590b-9f43-1d6b347cce76', 'Tấm nối ốp thân xe đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'eda9f0a9-9d50-59be-8455-dde438f175d5', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 67, 'b35d6491-3abf-50f8-896d-99c4108c56c3', 'Tấm nối ốp thân xe xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '60569bed-777e-581a-9dc3-95167b9ef0d5', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 68, '88b125f0-20d9-540e-a051-8fc5ca076763', 'Tấm nối ốp thân xe đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3ebcfac6-7c77-50e4-a23c-9b004370491e', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 69, 'ca377c43-a184-5750-af0a-0e89a4e76bb0', 'Ốp đồng hồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b3b8c687-ff0a-559f-9e9e-bbf1b39b5942', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 70, 'b87b46ca-7d5c-5153-8702-cb7f63192711', 'Chắn bùn trước bên trong', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8eec4bdc-bdf6-52a2-86f2-686de743a6d0', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 71, 'a52b2e04-78b2-5e50-9c19-c91b9dd11767', 'Nối hộp dụng cụ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '68988ddf-76ba-50ef-b75c-9a663c605467', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 72, '10fb7b3d-953e-5c66-b798-732f4ba04598', 'Hộp dụng cụ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'efa12dbc-29de-5d98-bb6f-3460a467deef', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 73, '445429e6-b561-5e7f-b09b-d0bba29a5a59', 'Nắp che số khung', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bcb13996-e6ec-5b1d-8b7d-6b4a1a69bebd', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 74, '0860f254-d05d-5962-80fa-50cefa502252', 'Hộc để đồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4c765364-7dd3-55a5-bbed-29009ddc2a58', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 75, 'd5e480c3-b641-54d7-aac3-4b892a1dea9e', 'Cốp xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b09a545c-aa16-5e9f-9c56-9885fc553128', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 76, '6f3e1d3e-5c6c-5040-97bc-3af0e6956416', 'Sàn để chân', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9be3d04f-ab53-5713-845f-c27a6cde122c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 77, '09d77103-ce6f-5c14-9bd1-f612880362f5', 'Cao su bịt sàn để chân', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ef4a60a8-5289-5fa0-8a03-992c00e1a944', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 78, '91fc8df7-619e-5033-9d45-e6000c25f3c7', 'Ốp gầm xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e26c976f-ad9c-576a-a8ae-4dae6ed74011', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 79, '92e15d0c-0b27-5eba-9aa2-34858c13f009', 'Ốp trước cốp', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd8c88410-93c9-5d8e-93ff-d3e79abe26ea', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 80, 'b3772105-d2b5-5a5a-827e-c172020a2cd6', 'Để chân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e2af2479-1d3a-5981-bd0b-4ecb6b458485', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 81, 'd132e4d2-3ab7-578e-8cb1-a851849c771e', 'Để chân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '52c914b3-30e7-5ff5-9bf2-c276f071b38c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 82, 'e3144fc2-261b-5b83-b52b-d6c91433df51', 'Chắn bùn sau bên trong', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8b85fc27-3232-5546-8864-cea6b71e1019', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 83, '0adef39c-3871-537e-a481-0ebc4f1784e0', 'Chắn bùn sau bên ngoài', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2a854153-7c29-5a06-97f1-73c5fc84546a', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 84, '81aa2503-58b3-50fc-900b-d39f90334656', 'Đuôi gắn biển số', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0b1c77a8-535a-5d65-a828-5975f1e75744', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 85, '51abdec1-42d6-5de8-82f0-cd16ae55108b', 'Đèn pha', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a76388a9-4d98-52a1-b1a2-dbb30eb1b55c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 86, 'cfa056b9-8c94-5e7e-bfc5-47dd97729dc3', 'Xi nhan Trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '88fa03af-8471-51d7-bafe-ded464311d2a', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 87, '56e53bae-9bcb-5a47-9c61-85d5c9dcb337', 'Xi nhan Phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd0a01643-3486-54bd-b4ba-dda4cf65f893', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 88, 'b0ec7835-f119-5988-8943-c9ed9c51a2de', 'Đèn hậu', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9c97c52a-b12f-5d71-b515-210664c4efa9', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 89, '8dcc316a-61c4-5369-a77f-28984c2f1f66', 'Đèn biển số', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5f19037f-24a6-5bd0-8dbf-6ef75349064a', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 90, '71ab9290-76b7-59d7-86f5-64b6c5aafb53', 'Ghi đông', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7cf9ffd2-f7b4-5367-97d2-d50dd46cdf31', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 91, '3d64c676-f3c4-50ea-a30f-930c7aa2dc6f', 'Gắp', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a07dcb6c-82ae-555c-8198-5d28c66159b2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 92, '9d75caa9-5dba-5973-b141-70a32a8c7571', 'Chân chống nghiêng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '253d8fe8-e876-5acc-951b-74c68e6725d2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 93, '000cf6c5-1f66-5c9c-ac65-76d1a24491b5', 'Chân chống giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e6ddf850-9948-55f7-8c11-ccc7f40ed1bd', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 94, '5b7b5a0d-ec87-590b-9feb-7019bcf5bc26', 'Khung xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '470bf9a4-fa2d-53c7-bd19-ccf948ab3130', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 95, '9b7b429d-93ce-5a81-92df-8623970b1e65', 'Yên xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '55904861-6812-53af-951c-b6fb404f7e9c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 96, '8b63dd58-61cb-53c3-a3c8-8449aef69e30', 'Cảnh báo đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0f7a1dce-2894-5755-b072-ca7bd2751119', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 97, 'f8374b14-08e8-58e9-beb4-b6ec7d9f3076', 'Cảnh báo tròn vàng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3271a005-0780-5287-b096-d8e39297e4b2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 98, 'da4bc5ca-037f-5185-9d04-e8cf879c67a6', 'Móc treo đồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1d90829c-7f71-587b-9d9d-f6dbff1f32f8', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 99, '2b3a3e47-a84f-5d0a-a9df-ec11b1ca5bde', 'Tay dắt nhôm (cảng sau)', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '15525057-1e7d-5bea-b0be-f96525b06e14', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 100, '230105c6-5274-5a3d-9e71-bc439aeecf07', 'Đồng hồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3b49db8c-7896-5026-9f12-4e49a1f08f93', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 101, '2a086bd2-49d4-59bb-b188-05a4aa0bddd5', 'Bộ công tắc trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5cc822fb-f46c-5199-a9c6-bb7b14b7324c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 102, 'ab4b8189-0be5-56fe-b97d-4c33fbc0209e', 'Bộ công tắc phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e5c38c81-1bad-5f30-ad87-5a55f5bf25e0', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 103, 'feaed352-c515-5dda-bda7-f09733b3c431', 'trục giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b3dd848e-118f-5e91-8f5a-3df6b6c932cd', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 104, '12a699f8-0a50-53a7-84e4-e55ddf39ba51', 'đùi bàn đạp', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '82dc7b9b-3fa0-5e8c-930d-150bec86ebc1', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 105, '57e805fa-8730-5931-ade4-bca3d12e5dd6', 'bánh răng trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3e5605cb-db0d-5129-a3db-98bacaf5ff13', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 106, '93d52ca7-dc63-5ac3-a9bc-da08edddffcb', 'bàn đạp', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '61f881a8-24a9-575b-a7a4-1a04df32ea60', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 107, 'b5d6d51c-bf60-5f24-9636-05b19405a175', 'xích xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9a30aa5c-4e44-5184-8097-7b0feef33c54', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 108, '5dca96ea-d9a7-5f3f-a41f-89d3ef514b6b', 'bộ côn nồi giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0bd067c7-5c75-50a1-aa0e-f027c648fa33', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 109, '6108637a-f478-5318-8632-5155e4020876', 'bánh răng sau', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '24d1bd87-effe-50f9-9702-017d45717d42', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 110, 'fe90d679-fbe0-59c3-854a-e87af73e7848', 'Bộ ổ khóa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c30173ec-74c9-5f90-81a0-a02c09f73a19', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 111, 'da7d9952-adf1-5721-83ab-c4325a4dfbc1', 'Chảng 3', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8cd60b24-c385-5d0b-8dc7-9d7046bd450b', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 112, '872fd8e8-623d-5257-b268-329454f6d676', 'Phuộc trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '02fd99c0-1f21-5477-8df2-d3bce7d2fc36', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 113, '36081cc2-aadd-5560-a643-79ce69b7cea4', 'Phuộc sau', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd1f68212-fb33-577e-8208-29679bbfe784', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 114, 'b623493f-3849-56c6-bb71-1e21eceb7659', 'Tay thắng trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5890cd03-8de1-53b5-b93e-ef0559c0a813', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 115, 'cbb144f2-7e20-5f32-9d6b-66dfcda41bef', 'Tay ga trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4868fa76-4c08-51e1-bd9f-7eb581672e42', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 116, '101dfa2a-238b-56f8-87b5-3d89a6398384', 'Tay ga phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '49c38832-7fba-58c4-8c52-b4018cc01049', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 117, '6170ab67-25bf-5031-a334-803870506ff4', 'Tay thắng phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4839c394-c149-5601-afcf-b076390ae3d0', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 118, '7098220d-6ea5-584e-ab94-6cc1dc676981', 'Đĩa phanh trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ef156635-f6b2-5689-a8d8-0461660d4a40', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 119, '0b06fb8b-d827-5dc4-a4bc-3c22062c5ea2', 'Mâm trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2416610a-cd49-590b-a0f2-bb850f4babd9', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 120, '40b34923-04bc-5558-aeca-87a6b53fc5f7', 'Cụm phanh sau', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fcf567b2-7945-565b-98fb-705cbb1c1019', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 121, '190f7ab9-a1e4-5d06-b046-503f4566b6df', 'Động cơ sau', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fcab239b-989c-5d38-bc84-f1120ff32b4e', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 122, '26696719-9037-5663-a674-4b65ea4b8750', 'Bộ điều khiển IC (5 con ốc - 10 nắp chụp nhựa)', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd5cb2f36-6ca3-5a3d-bab7-dcbee953f8cd', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 123, 'c0168953-f28f-51d3-835b-7686ac972bbd', 'Chip', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4066fca9-b39e-5362-b2d7-59669072ee4b', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 124, '2f81a71d-c103-5b63-825b-02798bfbdce3', 'CP (APTOMAT)', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c4c6724d-9a90-594a-bf7a-ef2c7762918d', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 125, '500fae61-05c4-59e1-b773-a94a2389312f', 'Khóa yên', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5a27d4f7-1090-55cb-b65a-1ef596318439', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 126, 'a6a4b6db-bf6f-5ffa-9c1f-8467fa903b63', 'Bộ bi chén cồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '26fe4915-373d-5681-8918-e671b737fac1', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 127, '3645e2ba-1c42-586c-b9ea-bc7468ba9235', 'Còi xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ca05ac69-cd4b-55d1-8938-8b223462e344', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 128, '11ab3af5-233e-5720-9c3e-961cd59b466f', 'Cục đổi nguồn', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4bea66ac-993c-5de6-bfd0-d9cbcaa3074d', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 129, 'd1849b84-e3ed-5ad2-98be-a1ac03d31632', 'Dây sạc USB', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '29fac5f0-8b45-5186-a8f9-a865d0a730b6', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 130, 'c144f1f2-6590-5e9b-aeef-b98937a22b89', 'Dây thắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '76175671-2beb-5991-b5a5-2bdb18d5ff1b', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 131, '3cbe92b6-9fe8-5e06-a01d-2e0fd0e3ce18', 'Dây khóa yên', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7f2fa7a3-7ade-52f9-8d92-d35374890e2c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 132, '8787898d-3a86-5303-a2c1-8938033c52d7', 'Dây điện chính', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7c978416-a9e4-5513-a433-82f86da39773', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 133, '31231427-124c-557b-993f-576e3f9dda3f', 'Dây sạc xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '487e11ab-0cb3-506a-8cab-44aacd56ff5d', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 134, 'c7be6dab-4122-5682-8400-43e8715ef458', 'Dây điện đơn CP', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f03f8996-fcaa-50bf-90b1-4ee33ea2565d', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 135, '23959935-df23-54c5-8c80-bd8c89b21178', 'Bộ dây điện có cầu chì câu bình', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'be0c1bbf-9c52-51f9-9e48-7bda6672eac6', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 136, 'e0a41f09-bbc4-549c-822e-bd24801387f8', 'Công tắc còi xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9860c865-a0e1-5fcc-adba-a6a40311b782', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 137, '8a058867-7361-5758-bb34-bec057b82f80', 'Dây chuyển đổi Trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '854601d3-a2b0-54d7-8f9b-018065ef6dc0', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 138, '07b0660c-0591-53be-9712-81e07ed39103', 'Lò xo chân chống nghiêng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8001d5b4-f7f6-5a52-b6db-0c4e8ef60871', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 139, '046c7305-08f9-555b-9d0e-cbd679367115', 'Lò xo chân chống giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ce2fd49e-e21c-5ef9-986a-3474016c10ef', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 140, '18262e13-8ed9-5ed1-a827-b61790ff6279', 'Van hơi 50', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3e90a5f7-eb29-53cb-a43c-01625219cfef', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 141, '731dc522-b874-54eb-837b-b9c6c1930689', 'Van hơi 70', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3024a9a6-4026-5417-b022-9034642d1061', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 142, '513c9518-5f81-528e-b280-2ee1c024058a', 'Nút bịt trục giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '61d05353-94b2-54fc-9474-48eb6edb0c5e', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 143, 'c66f91f1-0544-571e-a28d-46851267d033', 'Cục sạc xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '020ed45a-ff7b-56f8-ba5f-362512342df2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 144, 'a262632e-4e42-5f59-97d4-cd64a295747c', 'Trục M12 x 190', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1bc182b7-9ac4-58d5-90c2-2b1ca8910c11', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 145, 'b7bad263-96d1-57b5-a555-5298d5055eef', 'Trục M12 x 224', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '67cad8e8-4145-54be-8668-934ade44ffe7', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 146, 'ee60abe0-04cf-5171-8e2e-9ef4b5f80032', 'Bu lông M8 x 20', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '42e1bf02-0717-58c4-89fc-86bf6297e1b4', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 147, '538dc09b-45bf-5684-8b25-4f15f95757ac', 'Bu lông M8 x 30', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'db9b3ccf-8ce9-50a2-ae35-7df37b97896b', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 148, '998e3070-2dc6-560c-9c85-8c2b2d788ebd', 'Bu lông M10 x 25 chống nghiêng', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b38ec793-c906-5f31-a105-371b4a457e08', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 149, 'db8354f8-5308-56c7-90cc-e9dee08ee532', 'Bu lông M6 x 12', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd0063f02-b40a-5147-8959-df22614d5421', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 150, 'ca8c54f2-5504-5ab9-8dee-e9c2111c0eeb', 'Bu lông M10 x 40', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'de17c72a-fd40-5913-9f2c-4cc4ee070d66', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 151, '9702bd6a-1821-56bb-81a0-337af726d4f2', 'Bu lông M8 x 37', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a4797c67-7314-584e-8ed2-c0aed05c472e', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 152, 'c65cc0d2-e54f-5c14-950c-f338653ba17d', 'Bu lông M6 x 16', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9cc12976-bf21-5864-a74d-122b7dfbf36c', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 153, 'd9e8bd6c-3d50-5208-a853-5298d509d6a8', 'Bu lông M10 x 25', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '37bfa37e-215a-5bd2-beb0-67263eba115d', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 154, 'e7ee4627-05ed-5167-800b-a21994397cb0', 'Bu lông M3 x 25', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '28e2af8a-987a-5bd7-a4f2-1e9cb50af22b', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 155, '1d80c741-0200-5d51-a97a-24dd3511e2d8', 'Ecu M3', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dcd9d679-37ad-5248-80a2-3fcde92560b7', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 156, 'b76a85e4-8263-5e88-9c80-a45a3537db8c', 'Bu lông M10 x 45', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5cde3dc9-843b-5576-b142-a59a9bff993a', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 157, '674625ae-37ae-56c7-a0aa-d60e9872fad1', 'Bu lông M10 x 35', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '08b7bf5d-89c2-5091-94c2-6d577b4a1eb2', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 158, '3f86d8b6-6b50-5428-be07-98c051c5a43d', 'Bu lông ốc vít M6 x 12 ren mịn', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '04657738-8209-53ce-8d47-9cd9dd0d8a65', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 159, 'a1c7413a-7e1b-5307-b166-21dcbbd0e75a', 'Ốc Vít M4 x 12', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '546164f9-0426-54a4-8aa1-419254ac2ab1', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 160, '12f767b4-075a-5279-aa47-5b8315bcbbb3', 'Ốc vít M4.8 x 14', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '46c8ef9b-6ae6-5a47-9ef0-b476cae07761', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 161, '0832a0dc-b12b-575d-8110-19d7190bb065', 'Ốc vít M4 x 14', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ffaa0ec2-3015-5a62-af88-8c70deafba76', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 162, 'ab17123f-c774-5b7b-93c0-8b82f37280a6', 'Ecu M6', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4bce5021-e2e8-5147-a8ab-ab5725f24a2f', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 163, '4b226213-bca0-511d-947a-f071fe16c7ed', 'Ecu M10 có khóa ren', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '37c35158-f9fe-5443-8646-9037f86310dd', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 164, '821146bc-3c62-5fcc-b597-72f16b67dd05', 'Ecu m10', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8c0408a6-92e9-5083-a06f-f3dc8ecb5d1e', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 165, 'c9218497-a739-5b95-ac20-235f3b023515', 'Ecu m12 có khóa ren', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5e103d35-ccb1-59e1-a163-d6bb6540e0fd', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 166, '1d6ee912-7665-511e-98eb-6b113c279bd2', 'Khâu dài trục m13 x 20', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'afb88276-c914-513e-84f8-132aa1abfce0', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 167, '4eceeb12-da97-59e4-a66c-d05cb39089da', 'Khâu ngắn trục m13 x 17', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a89cc08b-65d7-5635-af74-5de2f140cc43', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 168, '0a5206a1-b840-5712-957e-1785edbfd8ac', 'Khâu cổ', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8cdf72cb-9a7f-5fae-b01a-c9aa34a4f832', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 169, '3f8d9c58-8c48-5d33-b170-573f354bada2', 'Khâu chống giữa', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a99e338c-d6ce-59a9-8000-a739339d6921', 'c4e41fcf-45f6-5a69-a254-296ea3b1ae2e', 170, '2b4e849b-81ce-50e3-b23d-09b9e8e655ff', 'Nẹp bắt vít 4 ly', '288.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    '4f5db827-70db-566e-a0c1-d4d8196384d7', 'PO-202606004', 'f52bdbc8-8918-5354-ab43-182ce9b6e97f', '2026-06-12T18:29:28.601Z', '2026-04-22T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'D002 200 BỘ LẦN 2 NGÀY 22-04-2026', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '67edf06f-345c-571a-9a15-5bb94e5315a4', '4f5db827-70db-566e-a0c1-d4d8196384d7', 1, 'e3098d27-0284-501d-a0ec-e46445887fa8', 'Ốp đầu trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd4793b85-7987-52e3-83fc-c79b02f7b774', '4f5db827-70db-566e-a0c1-d4d8196384d7', 2, '569fb5aa-262e-5479-948b-aff027822865', 'Ốp đầu trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '023f1a1a-f901-57f9-a515-3dcd4dcf0726', '4f5db827-70db-566e-a0c1-d4d8196384d7', 3, 'b0da05a1-b689-5ece-a70d-b0e6fcdc8b95', 'Ốp đầu trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7e98f656-2597-5a1c-8e46-d0c9aaefa78e', '4f5db827-70db-566e-a0c1-d4d8196384d7', 4, '5c38e394-ba6a-5971-a68e-f94e58d2a3cc', 'Ốp đầu trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '07ab81d1-75de-59f9-8071-d34bb0e4a84f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 5, '65bfe454-fff1-50cd-b34b-08a4bf16a414', 'Ốp đầu trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '566cddba-60dc-5793-8f6e-8e4216d09a60', '4f5db827-70db-566e-a0c1-d4d8196384d7', 6, 'ed2a0e56-1a58-5737-b359-b0b30dab9542', 'Ốp đầu trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9cac4684-f908-5a15-82ad-fe515afb9da2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 7, '7deb50f4-3a53-5e8d-b3d5-8580089de146', 'Ốp chắn gió trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c4da8f62-12f8-51c2-8c7e-909aa36a8014', '4f5db827-70db-566e-a0c1-d4d8196384d7', 8, 'd07e4abd-1aa7-5854-8060-bb78b623e139', 'Ốp chắn gió trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '57ab2c87-f9cb-5601-8fe0-6315fdd12ed0', '4f5db827-70db-566e-a0c1-d4d8196384d7', 9, '6dd263fa-9eab-5604-ac96-2fd75c4da83b', 'Ốp chắn gió trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1f86c928-2796-543c-a94b-b0df16f8aad7', '4f5db827-70db-566e-a0c1-d4d8196384d7', 10, '47fa7773-4d02-52ba-b18d-dd1c50e77c18', 'Ốp chắn gió trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f20d567c-fd83-5089-8dcf-5b63f3f9bbb0', '4f5db827-70db-566e-a0c1-d4d8196384d7', 11, '38581456-294d-5e23-aee6-d2ac0a7f11d1', 'Ốp chắn gió trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a2b5fb7a-09b0-582a-a439-c47540034dd1', '4f5db827-70db-566e-a0c1-d4d8196384d7', 12, '8c69d188-97e3-5948-b1d8-dbbca75544a3', 'Ốp chắn gió trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '91d2b0a6-ec6c-5621-81e3-313702b2db99', '4f5db827-70db-566e-a0c1-d4d8196384d7', 13, 'a970c451-f713-54f1-b6bd-0821d37adca6', 'Tấm nối chắn gió trước bên trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dcdb46fd-5310-56fa-b9f4-1e001f603f20', '4f5db827-70db-566e-a0c1-d4d8196384d7', 14, 'a0ad3acf-36f3-51e6-8b72-ea2538218497', 'Tấm nối chắn gió trước bên phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '568a8fd6-0245-5ed4-b9ae-63ff61afddde', '4f5db827-70db-566e-a0c1-d4d8196384d7', 15, 'dd078068-be40-53ad-a7ff-c0db3687387a', 'Tấm nối chắn gió trước bên trái trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8b729878-4c46-5e04-a5a4-1755aeaa46ae', '4f5db827-70db-566e-a0c1-d4d8196384d7', 16, 'be28b492-8b1a-5356-a836-42c7b0d11711', 'Tấm nối chắn gió trước bên phải trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1b060d9a-572b-516b-845d-35b1279fb4c5', '4f5db827-70db-566e-a0c1-d4d8196384d7', 17, 'a18025e1-d6d3-584b-a439-350f2e88d263', 'Tấm nối chắn gió trước bên trái xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6a41008f-8cf2-537b-9525-1ff5606ec921', '4f5db827-70db-566e-a0c1-d4d8196384d7', 18, '153006a8-06ab-510b-abbe-0d8c313d2e51', 'Tấm nối chắn gió trước bên phải xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9db10c52-5412-5ac7-a7db-d2e369ffae32', '4f5db827-70db-566e-a0c1-d4d8196384d7', 19, '5a5f01cb-f41c-5250-b147-7156a548612a', 'Tấm nối chắn gió trước bên trái đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b5efe7a6-ec89-5475-8059-52e91279942b', '4f5db827-70db-566e-a0c1-d4d8196384d7', 20, '8c2d6bcb-fd70-5b29-b636-c946e7144fbf', 'Tấm nối chắn gió trước bên phải đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ce9efa1e-06fa-5a2e-947f-4f7886d833b4', '4f5db827-70db-566e-a0c1-d4d8196384d7', 21, 'c4271174-060b-5b19-bcc1-03002a563561', 'Tấm nối chắn gió trước bên trái xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c66cdb5a-6dba-503f-bb16-c66ceeb0be1b', '4f5db827-70db-566e-a0c1-d4d8196384d7', 22, '273a7eea-70c0-5502-84a3-3184733e4364', 'Tấm nối chắn gió trước bên phải xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '57b80060-44cd-5f48-8a00-bc1d4df215fc', '4f5db827-70db-566e-a0c1-d4d8196384d7', 23, '4123831d-cbe7-5426-88d7-df19e6d0a045', 'Tấm nối chắn gió trước bên trái đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '659b8fbc-a332-591b-97d0-8e153e42d722', '4f5db827-70db-566e-a0c1-d4d8196384d7', 24, '261da775-261e-59ad-b101-cda3f77764a4', 'Tấm nối chắn gió trước bên phải đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '51749cb7-913a-5103-998a-e824b7e6db7c', '4f5db827-70db-566e-a0c1-d4d8196384d7', 25, 'a3607267-389b-515c-999b-6c9f10ec6f64', 'Thanh logo mặt nạ xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '02b1d4f4-c12c-551e-be61-7f8ee5ed3827', '4f5db827-70db-566e-a0c1-d4d8196384d7', 26, 'd378b061-e1f7-566d-b3cf-2006e26719a9', 'Chắn bùn trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1cc0f5da-55bb-552c-8793-3e83551c65fd', '4f5db827-70db-566e-a0c1-d4d8196384d7', 27, 'fa3c49f7-d141-58fc-b4af-147fca130c2c', 'Chắn bùn trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2b0dab70-c7c4-529d-b413-03ef5458d136', '4f5db827-70db-566e-a0c1-d4d8196384d7', 28, '73842302-3667-5686-82b7-eb3b29197db7', 'Chắn bùn trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7c309a3c-d3a4-5e5f-ade5-ac61005519c6', '4f5db827-70db-566e-a0c1-d4d8196384d7', 29, 'b818af0e-724f-5ae7-8488-81a4c8eabe15', 'Chắn bùn trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bce7506b-7a36-5016-ab5e-8700562a4a68', '4f5db827-70db-566e-a0c1-d4d8196384d7', 30, '0d6bc7e6-05b6-584b-bab3-63fa95cfed55', 'Chắn bùn trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '556d065e-c5fa-5488-bd80-c7925d489b4a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 31, 'e13570cb-2881-571a-b991-f4f5c5ac0571', 'Chắn bùn trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '01a68c87-4401-5d0e-9e1f-35438c45b22d', '4f5db827-70db-566e-a0c1-d4d8196384d7', 32, '62671ea8-4582-5327-b189-38068f61cd80', 'Vành đèn pha Xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0bda03c5-1322-570e-9cfc-b3a5632192c0', '4f5db827-70db-566e-a0c1-d4d8196384d7', 33, 'a3627167-d29a-52fe-a443-53f357acabaa', 'Ốp để chân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '30e49858-013c-5c22-a317-6de2b902e0da', '4f5db827-70db-566e-a0c1-d4d8196384d7', 34, 'd4d6e8dc-52a6-5187-8fca-f0f59acf4c0f', 'Ốp để chân trái trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b0cce170-b3ee-54b9-a751-8fc9498005ac', '4f5db827-70db-566e-a0c1-d4d8196384d7', 35, '078d8fa7-2b42-555f-9e57-d92200ec0ede', 'Ốp để chân trái xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bd08d179-98ed-54d7-b8fd-f568734d3f39', '4f5db827-70db-566e-a0c1-d4d8196384d7', 36, 'd0d96135-9ea7-55f6-ad3d-4e156e1a7c50', 'Ốp để chân trái đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '79b9ab09-ea7d-5035-b813-a0b0b5d4e1da', '4f5db827-70db-566e-a0c1-d4d8196384d7', 37, '8d98b7ef-3fc2-5bf2-834a-0036ec530366', 'Ốp để chân trái xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9f05002e-a4b1-5ce1-909d-7045e48b1568', '4f5db827-70db-566e-a0c1-d4d8196384d7', 38, '6a67911b-53db-5158-a57f-17610a76ce62', 'Ốp để chân trái đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c7e8c47e-12ef-5c35-ad7f-9ca5bfedccda', '4f5db827-70db-566e-a0c1-d4d8196384d7', 39, 'c080bb34-51aa-5b77-9f39-1639b93e9eb9', 'Ốp để chân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1e7136af-f79a-5fef-82c7-cbe0b2d60cfe', '4f5db827-70db-566e-a0c1-d4d8196384d7', 40, '2603262f-e684-50df-af9f-15f1ac0038bc', 'Ốp để chân phải trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a2c74bc5-6740-5f8f-8538-adcfdfaf0104', '4f5db827-70db-566e-a0c1-d4d8196384d7', 41, 'f22de075-65bc-5943-b6f6-ef34b2cbedc5', 'Ốp để chân phải xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '44c35deb-63ae-520d-850f-28aa2e30c448', '4f5db827-70db-566e-a0c1-d4d8196384d7', 42, '1dbc6e33-efe4-5924-a4ed-8a7a615445ee', 'Ốp để chân phải đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dcc5f778-101f-5646-ac1f-5c5cea95dc6f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 43, '5ff135d7-2d03-599b-bee1-3b0fddc04f19', 'Ốp để chân phải xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '055e6353-2a16-5786-9764-21c047f90699', '4f5db827-70db-566e-a0c1-d4d8196384d7', 44, 'caaad947-ad15-547c-b8ca-ee2efe862ca6', 'Ốp để chân phải đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f1a49a8b-fa5c-56c9-99ae-986ad3fdab39', '4f5db827-70db-566e-a0c1-d4d8196384d7', 45, '230bd9da-c94c-5f3d-9ac3-ee7b22354465', 'Ốp thân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '58c9617a-de3b-57d9-b843-ae9c558365c6', '4f5db827-70db-566e-a0c1-d4d8196384d7', 46, '496483b9-1ad9-5490-b207-117f5d528363', 'Ốp thân trái trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '59f42e4e-76ee-5a02-be9d-5a9ca4a7817c', '4f5db827-70db-566e-a0c1-d4d8196384d7', 47, 'cfcd55b7-60fc-5247-a918-7462b323c2b7', 'Ốp thân trái xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '36e43e26-372b-54a9-86b2-a6ef5a5c200b', '4f5db827-70db-566e-a0c1-d4d8196384d7', 48, '61a8e4bb-d2f9-544a-ae68-21b3c9988019', 'Ốp thân trái đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd0b232d5-7e7a-595f-8eda-87d3e6d973f2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 49, '36efe13a-4ba2-5166-ba04-4f02726b7664', 'Ốp thân trái xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a3bf5735-c33f-53cf-a681-9f0f6e1b8ca9', '4f5db827-70db-566e-a0c1-d4d8196384d7', 50, '6b26dbf6-e871-5b8b-8882-3fa779727604', 'Ốp thân trái đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'aff7acdf-238f-5f31-8718-a53df1693a44', '4f5db827-70db-566e-a0c1-d4d8196384d7', 51, '6500c855-dc7d-5852-b905-811353010a4c', 'Ốp thân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5a58d093-76e8-570d-87db-bd855efd412f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 52, '555c5af3-d0ac-5b78-9468-3d39d505bbd9', 'Ốp thân phải trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd681dad0-bf1c-5b9c-9533-1df6e85413ed', '4f5db827-70db-566e-a0c1-d4d8196384d7', 53, 'cf7e497f-00f0-52a4-bc11-c212788163c5', 'Ốp thân phải xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2739fabd-5bfc-50df-82f0-d8b53d1f44c8', '4f5db827-70db-566e-a0c1-d4d8196384d7', 54, '9a74c815-e459-5883-a1d8-d83663ed0cf5', 'Ốp thân phải đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4bd0065e-d023-5da6-9dac-7953df30d0ce', '4f5db827-70db-566e-a0c1-d4d8196384d7', 55, 'bd716143-169b-5e40-9dbb-c40da89af40a', 'Ốp thân phải xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '88b5d73d-e14d-5578-9f6b-c6e0e65a6a4d', '4f5db827-70db-566e-a0c1-d4d8196384d7', 56, '023b0464-9d47-55c9-a838-8c3ecb28c3e7', 'Ốp thân phải đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '10f63389-d686-5d00-808a-20d06fc60dc3', '4f5db827-70db-566e-a0c1-d4d8196384d7', 57, '87561f0e-92ab-530e-8de4-c230f8d3fe8c', 'Ốp trung tâm', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '93928fe5-a5d0-5515-aee8-d3bd403fff38', '4f5db827-70db-566e-a0c1-d4d8196384d7', 58, '1f4ad259-50a4-5d61-aefc-813729d7b783', 'Ốp trung tâm trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bf4317d7-7cf1-507f-8077-d75c42c4bd80', '4f5db827-70db-566e-a0c1-d4d8196384d7', 59, '6c4d9658-8f30-5c0e-b272-946c2cea74d9', 'Ốp trung tâm xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dd6a19a8-6862-5ebf-bdef-1009430e0d2f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 60, 'a314799c-b544-5e71-a5ce-974537d105c5', 'Ốp trung tâm đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'da9b03e5-1802-5f98-89cc-a8c341d0c916', '4f5db827-70db-566e-a0c1-d4d8196384d7', 61, '372d7704-1456-5d34-85ef-b833cdd66079', 'Ốp trung tâm xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'baacd63c-9ce7-55c3-aba7-d8912010e1c5', '4f5db827-70db-566e-a0c1-d4d8196384d7', 62, 'a0718c62-2bea-519d-8b59-7f6364a4a5b4', 'Ốp trung tâm đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c112d47b-6469-57c2-8186-e2a636cd62d8', '4f5db827-70db-566e-a0c1-d4d8196384d7', 63, '58e1908d-d14a-55fc-87dc-994f0ce7618e', 'Tấm nối ốp thân xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '34ae8091-549c-58b7-8aeb-65618da6885d', '4f5db827-70db-566e-a0c1-d4d8196384d7', 64, 'fc0cf2d1-594f-5b80-9415-f2dc43a843c2', 'Tấm nối ốp thân xe trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd74984c9-270b-5873-8ea1-5882030d57c2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 65, 'd2f7f86a-5dd9-5b89-856d-c8bf9d73df9b', 'Tấm nối ốp thân xe xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e8ae4718-fb2b-5024-a831-978f176a0c9d', '4f5db827-70db-566e-a0c1-d4d8196384d7', 66, 'a05d3846-701b-590b-9f43-1d6b347cce76', 'Tấm nối ốp thân xe đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd22950b4-a7bd-5013-90d6-38b843ae0217', '4f5db827-70db-566e-a0c1-d4d8196384d7', 67, 'b35d6491-3abf-50f8-896d-99c4108c56c3', 'Tấm nối ốp thân xe xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f83adc6d-b8e6-53b9-82a0-ff770cb38297', '4f5db827-70db-566e-a0c1-d4d8196384d7', 68, '88b125f0-20d9-540e-a051-8fc5ca076763', 'Tấm nối ốp thân xe đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '58a3b79c-62c4-5acf-9b6e-c36523f72824', '4f5db827-70db-566e-a0c1-d4d8196384d7', 69, 'ca377c43-a184-5750-af0a-0e89a4e76bb0', 'Ốp đồng hồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '88d0fff7-06d0-53f6-a133-8001216558c7', '4f5db827-70db-566e-a0c1-d4d8196384d7', 70, 'b87b46ca-7d5c-5153-8702-cb7f63192711', 'Chắn bùn trước bên trong', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'cb67adc9-5e13-54a5-9bb6-06cfe65a0796', '4f5db827-70db-566e-a0c1-d4d8196384d7', 71, 'a52b2e04-78b2-5e50-9c19-c91b9dd11767', 'Nối hộp dụng cụ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '20de2e85-08b5-57fe-ab88-03b04e825a33', '4f5db827-70db-566e-a0c1-d4d8196384d7', 72, '10fb7b3d-953e-5c66-b798-732f4ba04598', 'Hộp dụng cụ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0b43043a-2d17-54f0-9138-157c2c8a5918', '4f5db827-70db-566e-a0c1-d4d8196384d7', 73, '445429e6-b561-5e7f-b09b-d0bba29a5a59', 'Nắp che số khung', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b7a52e42-9e36-5f6b-abe8-8685cc90474d', '4f5db827-70db-566e-a0c1-d4d8196384d7', 74, '0860f254-d05d-5962-80fa-50cefa502252', 'Hộc để đồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ba01f45f-986f-5b58-8f26-53dcf861c326', '4f5db827-70db-566e-a0c1-d4d8196384d7', 75, 'd5e480c3-b641-54d7-aac3-4b892a1dea9e', 'Cốp xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '23eed694-52e2-57be-8685-6d96ed668220', '4f5db827-70db-566e-a0c1-d4d8196384d7', 76, '6f3e1d3e-5c6c-5040-97bc-3af0e6956416', 'Sàn để chân', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9ebe913f-1833-5c69-95ad-2d2a0afd443d', '4f5db827-70db-566e-a0c1-d4d8196384d7', 77, '09d77103-ce6f-5c14-9bd1-f612880362f5', 'Cao su bịt sàn để chân', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '292b7232-f367-51ce-93f1-993d7af9ef1f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 78, '3645e2ba-1c42-586c-b9ea-bc7468ba9235', 'Còi xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '93d3b3fc-3a0a-579e-b81d-2828272641c4', '4f5db827-70db-566e-a0c1-d4d8196384d7', 79, '92e15d0c-0b27-5eba-9aa2-34858c13f009', 'Ốp trước cốp', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '12d689fa-d94e-5528-8b3d-38a9a7fe4046', '4f5db827-70db-566e-a0c1-d4d8196384d7', 80, 'b3772105-d2b5-5a5a-827e-c172020a2cd6', 'Để chân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '047312c9-4ec8-5c22-b60a-5b40b422af2a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 81, 'd132e4d2-3ab7-578e-8cb1-a851849c771e', 'Để chân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f07f4af4-4927-57e1-84dd-c830c239f893', '4f5db827-70db-566e-a0c1-d4d8196384d7', 82, 'e3144fc2-261b-5b83-b52b-d6c91433df51', 'Chắn bùn sau bên trong', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '761ca87e-2ae2-53ba-9da4-a11589dcc425', '4f5db827-70db-566e-a0c1-d4d8196384d7', 83, '0adef39c-3871-537e-a481-0ebc4f1784e0', 'Chắn bùn sau bên ngoài', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1a5b3fac-06a5-5bf3-aec5-925d39923b5a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 84, '81aa2503-58b3-50fc-900b-d39f90334656', 'Đuôi gắn biển số', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '695287cf-ef9e-5b08-ad21-e178cc11570c', '4f5db827-70db-566e-a0c1-d4d8196384d7', 85, '51abdec1-42d6-5de8-82f0-cd16ae55108b', 'Đèn pha', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9f4c18e2-098a-541e-b93e-0cf81dda0c0c', '4f5db827-70db-566e-a0c1-d4d8196384d7', 86, 'cfa056b9-8c94-5e7e-bfc5-47dd97729dc3', 'Xi nhan Trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e87fa42d-e86d-5276-99ec-d3237e4e99d8', '4f5db827-70db-566e-a0c1-d4d8196384d7', 87, '56e53bae-9bcb-5a47-9c61-85d5c9dcb337', 'Xi nhan Phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7fc5da79-c6a3-5b0f-b75a-0c3df271ed17', '4f5db827-70db-566e-a0c1-d4d8196384d7', 88, 'b0ec7835-f119-5988-8943-c9ed9c51a2de', 'Đèn hậu', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6d9a19d8-e023-5c56-a056-9bac76393e60', '4f5db827-70db-566e-a0c1-d4d8196384d7', 89, '8dcc316a-61c4-5369-a77f-28984c2f1f66', 'Đèn biển số', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b7264f9c-ab53-5193-a902-3853bfc8c5d0', '4f5db827-70db-566e-a0c1-d4d8196384d7', 90, '71ab9290-76b7-59d7-86f5-64b6c5aafb53', 'Ghi đông', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'dc500cae-8b99-5df5-8dbc-0684da56c5ef', '4f5db827-70db-566e-a0c1-d4d8196384d7', 91, '3d64c676-f3c4-50ea-a30f-930c7aa2dc6f', 'Gắp', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '52461484-dd12-5cf4-abfd-25a90df9d59a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 92, '9d75caa9-5dba-5973-b141-70a32a8c7571', 'Chân chống nghiêng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3682aad2-d87d-5e1f-ac0d-aab0ddeaac30', '4f5db827-70db-566e-a0c1-d4d8196384d7', 93, '000cf6c5-1f66-5c9c-ac65-76d1a24491b5', 'Chân chống giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8ff99499-2dc3-567c-8ee9-4466de6e015a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 94, '5b7b5a0d-ec87-590b-9feb-7019bcf5bc26', 'Khung xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2b4dd0d3-d0b0-58fb-94d5-5bdcbc3c0366', '4f5db827-70db-566e-a0c1-d4d8196384d7', 95, '9b7b429d-93ce-5a81-92df-8623970b1e65', 'Yên xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '43b006f6-d538-5051-940d-462c8f646a95', '4f5db827-70db-566e-a0c1-d4d8196384d7', 96, '8b63dd58-61cb-53c3-a3c8-8449aef69e30', 'Cảnh báo đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6ec85f52-b486-5f0a-8a84-96fc73cb8f3a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 97, 'f8374b14-08e8-58e9-beb4-b6ec7d9f3076', 'Cảnh báo tròn vàng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '50cb4d71-2208-5e78-9c29-7c1070b4137c', '4f5db827-70db-566e-a0c1-d4d8196384d7', 98, 'da4bc5ca-037f-5185-9d04-e8cf879c67a6', 'Móc treo đồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '344afab4-52f6-5dbf-9fd8-ebb1b6a9eb87', '4f5db827-70db-566e-a0c1-d4d8196384d7', 99, '2b3a3e47-a84f-5d0a-a9df-ec11b1ca5bde', 'Tay dắt nhôm (cảng sau)', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e48bf42d-df32-50e5-8682-406f116a0593', '4f5db827-70db-566e-a0c1-d4d8196384d7', 100, '230105c6-5274-5a3d-9e71-bc439aeecf07', 'Đồng hồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '39eec1ae-2bdc-56b7-a571-24bc7eaebad9', '4f5db827-70db-566e-a0c1-d4d8196384d7', 101, '2a086bd2-49d4-59bb-b188-05a4aa0bddd5', 'Bộ công tắc trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2f6afd5d-ed8e-5200-bc8c-88c23a75a304', '4f5db827-70db-566e-a0c1-d4d8196384d7', 102, 'ab4b8189-0be5-56fe-b97d-4c33fbc0209e', 'Bộ công tắc phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '68ddd8ee-37b5-50bd-bcb3-c50a9637d384', '4f5db827-70db-566e-a0c1-d4d8196384d7', 103, 'feaed352-c515-5dda-bda7-f09733b3c431', 'trục giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e3684aa3-d19b-5abf-a31f-c40be5678b91', '4f5db827-70db-566e-a0c1-d4d8196384d7', 104, '12a699f8-0a50-53a7-84e4-e55ddf39ba51', 'đùi bàn đạp', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '50464ccc-b2c9-5e12-83e8-3f4af60b2bd2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 105, '57e805fa-8730-5931-ade4-bca3d12e5dd6', 'bánh răng trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '97fd47c4-8b68-5e80-8e02-57bbeb23005b', '4f5db827-70db-566e-a0c1-d4d8196384d7', 106, '93d52ca7-dc63-5ac3-a9bc-da08edddffcb', 'bàn đạp', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b6f7c727-ce3d-59dd-a483-d9aa50e386e2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 107, 'b5d6d51c-bf60-5f24-9636-05b19405a175', 'xích xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '816e19fc-4e32-51b2-a7c9-1d3430fe096d', '4f5db827-70db-566e-a0c1-d4d8196384d7', 108, '5dca96ea-d9a7-5f3f-a41f-89d3ef514b6b', 'bộ côn nồi giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8ececec2-c8a1-5f0c-8906-41aa177e91f9', '4f5db827-70db-566e-a0c1-d4d8196384d7', 109, '6108637a-f478-5318-8632-5155e4020876', 'bánh răng sau', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e39c732b-68cb-5672-a9f1-d5a3111c9129', '4f5db827-70db-566e-a0c1-d4d8196384d7', 110, 'fe90d679-fbe0-59c3-854a-e87af73e7848', 'Bộ ổ khóa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ff094dbc-afca-5515-9678-021ba0903cb7', '4f5db827-70db-566e-a0c1-d4d8196384d7', 111, 'da7d9952-adf1-5721-83ab-c4325a4dfbc1', 'Chảng 3', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6ea0254a-94a0-5b56-9319-3b08ca21fbdf', '4f5db827-70db-566e-a0c1-d4d8196384d7', 112, '872fd8e8-623d-5257-b268-329454f6d676', 'Phuộc trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '67504f47-21bf-5521-8dce-99b0a8ed2748', '4f5db827-70db-566e-a0c1-d4d8196384d7', 113, '36081cc2-aadd-5560-a643-79ce69b7cea4', 'Phuộc sau', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '960eef7b-314b-517a-8110-e73a608547b1', '4f5db827-70db-566e-a0c1-d4d8196384d7', 114, 'b623493f-3849-56c6-bb71-1e21eceb7659', 'Tay thắng trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9dcaae4c-5d95-55ed-a24b-45638ed35fa2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 115, 'cbb144f2-7e20-5f32-9d6b-66dfcda41bef', 'Tay ga trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2fcb5ca3-3aa2-58a9-9d84-6bc3a4fffdd9', '4f5db827-70db-566e-a0c1-d4d8196384d7', 116, '101dfa2a-238b-56f8-87b5-3d89a6398384', 'Tay ga phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b3ce89eb-5b4b-56c9-a3df-6868397e5c47', '4f5db827-70db-566e-a0c1-d4d8196384d7', 117, '6170ab67-25bf-5031-a334-803870506ff4', 'Tay thắng phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7dfd4b3e-4673-57c1-861e-16e6180274c2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 118, '7098220d-6ea5-584e-ab94-6cc1dc676981', 'Đĩa phanh trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7fec2738-6a8b-5e81-a696-81f5117e7631', '4f5db827-70db-566e-a0c1-d4d8196384d7', 119, '0b06fb8b-d827-5dc4-a4bc-3c22062c5ea2', 'Mâm trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f0fbf801-6e77-5dff-a905-30f0f9d35532', '4f5db827-70db-566e-a0c1-d4d8196384d7', 120, '40b34923-04bc-5558-aeca-87a6b53fc5f7', 'Cụm phanh sau', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '4af0476b-87e6-5ac4-881f-9791e0850e40', '4f5db827-70db-566e-a0c1-d4d8196384d7', 121, '190f7ab9-a1e4-5d06-b046-503f4566b6df', 'Động cơ sau', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '06aa388e-88b7-5e1d-83f9-4adb40f9771f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 122, '26696719-9037-5663-a674-4b65ea4b8750', 'Bộ điều khiển IC (5 con ốc - 10 nắp chụp nhựa)', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd782251e-8244-58bd-9e53-3ee9b102cda6', '4f5db827-70db-566e-a0c1-d4d8196384d7', 123, 'c0168953-f28f-51d3-835b-7686ac972bbd', 'Chip', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8d1e465e-b04d-5769-a6ff-4afa81f3c55a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 124, '2f81a71d-c103-5b63-825b-02798bfbdce3', 'CP (APTOMAT)', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '691890e8-0471-5b16-be79-7f5187736b27', '4f5db827-70db-566e-a0c1-d4d8196384d7', 125, '500fae61-05c4-59e1-b773-a94a2389312f', 'Khóa yên', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '3480e7d9-5ad8-53f9-b72a-24e032a0b0aa', '4f5db827-70db-566e-a0c1-d4d8196384d7', 126, 'a6a4b6db-bf6f-5ffa-9c1f-8467fa903b63', 'Bộ bi chén cồ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a415249b-48c4-5645-a35e-b463109d2907', '4f5db827-70db-566e-a0c1-d4d8196384d7', 127, '3645e2ba-1c42-586c-b9ea-bc7468ba9235', 'Còi xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0604fc48-0a64-59db-9d39-3e299a358fe7', '4f5db827-70db-566e-a0c1-d4d8196384d7', 128, '11ab3af5-233e-5720-9c3e-961cd59b466f', 'Cục đổi nguồn', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fcb2e3af-e564-5aa5-bc4c-8a9d582d1595', '4f5db827-70db-566e-a0c1-d4d8196384d7', 129, 'd1849b84-e3ed-5ad2-98be-a1ac03d31632', 'Dây sạc USB', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '54a4e94b-7218-5b6b-a424-de285d51381f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 130, 'c144f1f2-6590-5e9b-aeef-b98937a22b89', 'Dây thắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '24e91f6a-14be-5b63-b377-b7016436a4e9', '4f5db827-70db-566e-a0c1-d4d8196384d7', 131, '3cbe92b6-9fe8-5e06-a01d-2e0fd0e3ce18', 'Dây khóa yên', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c1f84975-edc6-5d48-8501-b6284f18b1cf', '4f5db827-70db-566e-a0c1-d4d8196384d7', 132, '8787898d-3a86-5303-a2c1-8938033c52d7', 'Dây điện chính', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6f39868e-ec1c-54b3-b0bb-7e1eee978829', '4f5db827-70db-566e-a0c1-d4d8196384d7', 133, '31231427-124c-557b-993f-576e3f9dda3f', 'Dây sạc xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '33ac255c-1a27-5e04-a5c5-e933ef0601cc', '4f5db827-70db-566e-a0c1-d4d8196384d7', 134, 'c7be6dab-4122-5682-8400-43e8715ef458', 'Dây điện đơn CP', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '31ec04f7-f7f6-520c-be38-73743210de4b', '4f5db827-70db-566e-a0c1-d4d8196384d7', 135, '23959935-df23-54c5-8c80-bd8c89b21178', 'Bộ dây điện có cầu chì câu bình', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bf1d2877-54c9-5f5e-ae68-8c19b86cf58c', '4f5db827-70db-566e-a0c1-d4d8196384d7', 136, 'e0a41f09-bbc4-549c-822e-bd24801387f8', 'Công tắc còi xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '34c8d8ee-35a2-5f52-bde9-c8c9857b7618', '4f5db827-70db-566e-a0c1-d4d8196384d7', 137, '8a058867-7361-5758-bb34-bec057b82f80', 'Dây chuyển đổi Trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f849c0c5-8053-5ba5-824e-b1d504ca1149', '4f5db827-70db-566e-a0c1-d4d8196384d7', 138, '07b0660c-0591-53be-9712-81e07ed39103', 'Lò xo chân chống nghiêng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '884ba237-12f0-557e-9560-a2f37cac3f5c', '4f5db827-70db-566e-a0c1-d4d8196384d7', 139, '046c7305-08f9-555b-9d0e-cbd679367115', 'Lò xo chân chống giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '9d8ef7be-261f-5c87-9fbf-a8503f796c92', '4f5db827-70db-566e-a0c1-d4d8196384d7', 140, '18262e13-8ed9-5ed1-a827-b61790ff6279', 'Van hơi 50', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5a7b90ca-b19b-5b50-9131-fd2bd30173e2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 141, '731dc522-b874-54eb-837b-b9c6c1930689', 'Van hơi 70', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f8890f58-bf7d-5a24-b961-bec1b1284670', '4f5db827-70db-566e-a0c1-d4d8196384d7', 142, '513c9518-5f81-528e-b280-2ee1c024058a', 'Nút bịt trục giữa', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8110562d-17c0-5a17-a4a6-ee5ce27e543a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 143, 'c66f91f1-0544-571e-a28d-46851267d033', 'Cục sạc xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a96c5bee-fcc5-5f4c-af1b-de5b2ed74237', '4f5db827-70db-566e-a0c1-d4d8196384d7', 144, 'a262632e-4e42-5f59-97d4-cd64a295747c', 'Trục M12 x 190', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e3b12729-787c-5d08-b0cd-e20549839a4b', '4f5db827-70db-566e-a0c1-d4d8196384d7', 145, 'b7bad263-96d1-57b5-a555-5298d5055eef', 'Trục M12 x 224', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '08aa78be-f037-56e9-96ca-9d1bd810019f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 146, 'ee60abe0-04cf-5171-8e2e-9ef4b5f80032', 'Bu lông M8 x 20', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c9d22389-2ceb-5ced-a9c3-b3c1b0ed8a59', '4f5db827-70db-566e-a0c1-d4d8196384d7', 147, '538dc09b-45bf-5684-8b25-4f15f95757ac', 'Bu lông M8 x 30', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5726b301-55a2-5e51-8b17-d017bda2ab32', '4f5db827-70db-566e-a0c1-d4d8196384d7', 148, '998e3070-2dc6-560c-9c85-8c2b2d788ebd', 'Bu lông M10 x 25 chống nghiêng', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a1a5b130-0fd1-50e0-82a3-10c7532974d2', '4f5db827-70db-566e-a0c1-d4d8196384d7', 149, 'db8354f8-5308-56c7-90cc-e9dee08ee532', 'Bu lông M6 x 12', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fdc6f3b3-1450-5732-b6a5-cf4bda856564', '4f5db827-70db-566e-a0c1-d4d8196384d7', 150, 'ca8c54f2-5504-5ab9-8dee-e9c2111c0eeb', 'Bu lông M10 x 40', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2ac3994f-1ab6-5202-81e4-b50388c38b17', '4f5db827-70db-566e-a0c1-d4d8196384d7', 151, '9702bd6a-1821-56bb-81a0-337af726d4f2', 'Bu lông M8 x 37', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c4a37bbc-5449-53b4-ba46-369334d26cf3', '4f5db827-70db-566e-a0c1-d4d8196384d7', 152, 'c65cc0d2-e54f-5c14-950c-f338653ba17d', 'Bu lông M6 x 16', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0c96588a-1fcb-58d0-aee4-503d6b136318', '4f5db827-70db-566e-a0c1-d4d8196384d7', 153, 'd9e8bd6c-3d50-5208-a853-5298d509d6a8', 'Bu lông M10 x 25', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'bbf41765-1a9e-50f4-9a3e-e6430e3ecc99', '4f5db827-70db-566e-a0c1-d4d8196384d7', 154, 'e7ee4627-05ed-5167-800b-a21994397cb0', 'Bu lông M3 x 25', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2dc7a291-5f9b-509c-b88b-dbaa2c74c950', '4f5db827-70db-566e-a0c1-d4d8196384d7', 155, '1d80c741-0200-5d51-a97a-24dd3511e2d8', 'Ecu M3', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '201a2db1-1cea-5312-b9e0-3ddefeb3f2b0', '4f5db827-70db-566e-a0c1-d4d8196384d7', 156, 'b76a85e4-8263-5e88-9c80-a45a3537db8c', 'Bu lông M10 x 45', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1b3cc118-23e4-5f0d-854d-e014ac29d73f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 157, '674625ae-37ae-56c7-a0aa-d60e9872fad1', 'Bu lông M10 x 35', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2d24a5a5-60f7-511d-abec-0a913d2002ac', '4f5db827-70db-566e-a0c1-d4d8196384d7', 158, '3f86d8b6-6b50-5428-be07-98c051c5a43d', 'Bu lông ốc vít M6 x 12 ren mịn', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1daa9726-650e-553b-9512-c5341f09f44a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 159, 'a1c7413a-7e1b-5307-b166-21dcbbd0e75a', 'Ốc Vít M4 x 12', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '588d4433-1eb1-5806-8bef-d33fd065b497', '4f5db827-70db-566e-a0c1-d4d8196384d7', 160, '12f767b4-075a-5279-aa47-5b8315bcbbb3', 'Ốc vít M4.8 x 14', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '51664ee3-1dd4-5f90-b171-39cfc183eecb', '4f5db827-70db-566e-a0c1-d4d8196384d7', 161, '0832a0dc-b12b-575d-8110-19d7190bb065', 'Ốc vít M4 x 14', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd6181b07-6451-529c-a78c-6b1a46977181', '4f5db827-70db-566e-a0c1-d4d8196384d7', 162, 'ab17123f-c774-5b7b-93c0-8b82f37280a6', 'Ecu M6', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '52034afe-c0a5-561c-939d-2279ee6a8b0f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 163, '4b226213-bca0-511d-947a-f071fe16c7ed', 'Ecu M10 có khóa ren', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd641bbc5-90ff-52d9-8132-3385a0043953', '4f5db827-70db-566e-a0c1-d4d8196384d7', 164, '821146bc-3c62-5fcc-b597-72f16b67dd05', 'Ecu m10', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'db2bad30-fa6a-55c0-8695-2a800214fe1f', '4f5db827-70db-566e-a0c1-d4d8196384d7', 165, 'c9218497-a739-5b95-ac20-235f3b023515', 'Ecu m12 có khóa ren', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '7c0783bd-b7dc-5588-ae49-1d87dba5086c', '4f5db827-70db-566e-a0c1-d4d8196384d7', 166, '1d6ee912-7665-511e-98eb-6b113c279bd2', 'Khâu dài trục m13 x 20', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'de6f0042-676c-5ec1-b990-b8cc906bdc00', '4f5db827-70db-566e-a0c1-d4d8196384d7', 167, '4eceeb12-da97-59e4-a66c-d05cb39089da', 'Khâu ngắn trục m13 x 17', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2766ec67-934f-5b4e-b3e0-77eb4cbafcba', '4f5db827-70db-566e-a0c1-d4d8196384d7', 168, '0a5206a1-b840-5712-957e-1785edbfd8ac', 'Khâu cổ', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'eb450032-b56e-5e24-9942-898d3e1e3e5e', '4f5db827-70db-566e-a0c1-d4d8196384d7', 169, '3f8d9c58-8c48-5d33-b170-573f354bada2', 'Khâu chống giữa', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5d01aa7e-9c38-55bb-ad2f-e1da9711211a', '4f5db827-70db-566e-a0c1-d4d8196384d7', 170, '2b4e849b-81ce-50e3-b23d-09b9e8e655ff', 'Nẹp bắt vít 4 ly', '330.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    '658fefce-0463-51a1-9bde-7ef7b4fc80b0', 'PO-202606005', 'f52bdbc8-8918-5354-ab43-182ce9b6e97f', '2026-06-12T18:29:28.601Z', '2026-03-19T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: LD-Lockset 1000', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2ed09228-6a84-51e7-850f-fe17921e8df3', '658fefce-0463-51a1-9bde-7ef7b4fc80b0', 1, '89a056f5-d969-5abc-8e00-46fb74557828', 'bộ khoá có đèn logo K LOTUS', '1000.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    'cffc2f1d-f61b-5a51-88df-1e315437e64d', 'PO-202606006', '4084ec91-368a-5d06-a7ba-23a3d5b4a257', '2026-06-12T18:29:28.601Z', '2026-02-28T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: Kenda - 20', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b066f219-a4c0-5e94-be29-5a26ff23b787', 'cffc2f1d-f61b-5a51-88df-1e315437e64d', 1, 'e0e2042d-84f2-500a-baf7-571a5e79c85d', 'Lốp xe', '20.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    '8ba6833f-a7fb-5a06-a916-edf84f25e3f9', 'PO-202606007', '4084ec91-368a-5d06-a7ba-23a3d5b4a257', '2026-06-12T18:29:28.601Z', '2026-03-12T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: Kenda - 500', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '88a2eda8-1d3e-54c2-9064-8c6b52c10533', '8ba6833f-a7fb-5a06-a916-edf84f25e3f9', 1, 'e0e2042d-84f2-500a-baf7-571a5e79c85d', 'Lốp xe', '500.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    'fbfd1c28-740c-5322-bd2c-74d5e3c05b8f', 'PO-202606008', '4084ec91-368a-5d06-a7ba-23a3d5b4a257', '2026-06-12T18:29:28.601Z', '2026-04-13T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: Kenda - 600', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd0945a9a-131e-5862-a8bd-a8024c63a189', 'fbfd1c28-740c-5322-bd2c-74d5e3c05b8f', 1, 'e0e2042d-84f2-500a-baf7-571a5e79c85d', 'Lốp xe', '500.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 'PO-202606009', '0972ad20-002e-5f47-a25d-8ad882f0e493', '2026-06-12T18:29:28.601Z', '2026-04-22T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: CMC-200', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5c974c14-5fd3-588e-a899-44345a11651f', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 1, '62671ea8-4582-5327-b189-38068f61cd80', 'Vành đèn pha', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '91f8d900-27cb-5086-a362-34d5a0a66133', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 2, 'e3098d27-0284-501d-a0ec-e46445887fa8', 'Ốp đầu trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e2a0d01b-9259-5603-be4d-4c82999055ef', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 3, '569fb5aa-262e-5479-948b-aff027822865', 'Ốp đầu trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'cf4109c8-c713-5fec-9d44-e0bf9c1e7b01', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 4, 'b0da05a1-b689-5ece-a70d-b0e6fcdc8b95', 'Ốp đầu trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6889e3d3-7042-538e-b933-3a329bae8588', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 5, '5c38e394-ba6a-5971-a68e-f94e58d2a3cc', 'Ốp đầu trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '37c9e7ab-8fc4-50c0-b60c-d6384117dc0e', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 6, '65bfe454-fff1-50cd-b34b-08a4bf16a414', 'Ốp đầu trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '39cbd4d0-2c3d-543b-94fa-4785fc02788b', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 7, 'ed2a0e56-1a58-5737-b359-b0b30dab9542', 'Ốp đầu trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ea2829d3-3344-5279-b3c4-e33a803cef09', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 8, 'a3607267-389b-515c-999b-6c9f10ec6f64', 'Thanh logo mặt nạ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6a74255f-3cf8-53f6-8d62-fba739712c8b', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 9, '7deb50f4-3a53-5e8d-b3d5-8580089de146', 'Ốp chắn gió trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '546fea9c-3a81-5de0-90a3-206f30efe04c', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 10, 'a970c451-f713-54f1-b6bd-0821d37adca6', 'Tấm nối chắn gió trước bên trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '092e9fb8-0311-59fa-bfca-a8c63f818ae4', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 11, 'a0ad3acf-36f3-51e6-8b72-ea2538218497', 'Tấm nối chắn gió trước bên phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '800477b2-320e-57c7-a2f8-1b8b924cdc0f', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 12, 'd378b061-e1f7-566d-b3cf-2006e26719a9', 'Chắn bùn trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b84861f0-5d99-5ce0-9ce9-7ba646909a70', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 13, 'fa3c49f7-d141-58fc-b4af-147fca130c2c', 'Chắn bùn trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fda0ceb3-6a0f-555d-a8ae-212574e780c6', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 14, '73842302-3667-5686-82b7-eb3b29197db7', 'Chắn bùn trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '95d39964-557e-5928-8802-f20b85991e84', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 15, 'b818af0e-724f-5ae7-8488-81a4c8eabe15', 'Chắn bùn trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '67c80591-e8e3-568b-8261-e58665c0dc67', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 16, '0d6bc7e6-05b6-584b-bab3-63fa95cfed55', 'Chắn bùn trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '566447bb-0bdd-5003-8ccb-06efe8da591d', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 17, 'e13570cb-2881-571a-b991-f4f5c5ac0571', 'Chắn bùn trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a0cbecdf-8165-54d6-8c40-71759eb31277', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 18, 'a3627167-d29a-52fe-a443-53f357acabaa', 'Ốp để chân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f03fdc8d-5bc8-564b-9612-8fe92e806ce8', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 19, 'c080bb34-51aa-5b77-9f39-1639b93e9eb9', 'Ốp để chân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5b62b0b3-9875-5882-8f17-fe8f0606ff2a', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 20, '230bd9da-c94c-5f3d-9ac3-ee7b22354465', 'Ốp thân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'f918a8e3-4504-5ce9-9644-fd18a15778e9', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 21, '6500c855-dc7d-5852-b905-811353010a4c', 'Ốp thân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '498b842b-1d07-53c2-b527-d859a0803f9c', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 22, '87561f0e-92ab-530e-8de4-c230f8d3fe8c', 'Ốp trung tâm', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0ae5c4f5-e2b7-5b5a-92b7-b0b98c1c5d53', 'ca7fbafc-9cd4-5c2a-944c-0bd141dc4354', 23, '58e1908d-d14a-55fc-87dc-994f0ce7618e', 'Tấm nối ốp thân xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    'df935194-f757-59cb-9b7a-7887f19122f7', 'PO-202606010', '8215c6a0-7a0c-5151-817c-c4f50b462828', '2026-06-12T18:29:28.601Z', '2026-04-21T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: DHP-200', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'fe654358-4250-5fe5-8da9-315a354bc0f6', 'df935194-f757-59cb-9b7a-7887f19122f7', 1, '62671ea8-4582-5327-b189-38068f61cd80', 'Vành đèn pha', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '1c4cce50-4d3c-588d-94b9-0c62f7a9d852', 'df935194-f757-59cb-9b7a-7887f19122f7', 2, 'e3098d27-0284-501d-a0ec-e46445887fa8', 'Ốp đầu trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c87cc339-7ed6-52f1-a017-e57e6f009c5e', 'df935194-f757-59cb-9b7a-7887f19122f7', 3, '569fb5aa-262e-5479-948b-aff027822865', 'Ốp đầu trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ceaafa84-3501-53f7-be07-479cb1b8b665', 'df935194-f757-59cb-9b7a-7887f19122f7', 4, 'b0da05a1-b689-5ece-a70d-b0e6fcdc8b95', 'Ốp đầu trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '50077079-1cc9-5a5a-8597-a5aa4bcba231', 'df935194-f757-59cb-9b7a-7887f19122f7', 5, '5c38e394-ba6a-5971-a68e-f94e58d2a3cc', 'Ốp đầu trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'e6d29d1f-c395-56c0-9925-315e0090c13a', 'df935194-f757-59cb-9b7a-7887f19122f7', 6, '65bfe454-fff1-50cd-b34b-08a4bf16a414', 'Ốp đầu trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'afff6055-0e04-5d04-b214-def52d8e80a5', 'df935194-f757-59cb-9b7a-7887f19122f7', 7, 'ed2a0e56-1a58-5737-b359-b0b30dab9542', 'Ốp đầu trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '773569b6-4285-52c9-8de1-45f27c8a95bc', 'df935194-f757-59cb-9b7a-7887f19122f7', 8, 'a3607267-389b-515c-999b-6c9f10ec6f64', 'Thanh logo mặt nạ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'd80b858d-75ff-5afd-a95d-c2c6f39cd24d', 'df935194-f757-59cb-9b7a-7887f19122f7', 9, '7deb50f4-3a53-5e8d-b3d5-8580089de146', 'Ốp chắn gió trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '997a6c8e-9d96-5f6b-b959-a0927a7553a2', 'df935194-f757-59cb-9b7a-7887f19122f7', 10, 'a970c451-f713-54f1-b6bd-0821d37adca6', 'Tấm nối chắn gió trước bên trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '0140f6cc-1193-569a-a122-1e8d99f55c35', 'df935194-f757-59cb-9b7a-7887f19122f7', 11, 'a0ad3acf-36f3-51e6-8b72-ea2538218497', 'Tấm nối chắn gió trước bên phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'c942d6c3-de35-5795-ae6f-7a679b94940e', 'df935194-f757-59cb-9b7a-7887f19122f7', 12, 'd378b061-e1f7-566d-b3cf-2006e26719a9', 'Chắn bùn trước', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'a56d7953-b3c2-575e-97a2-ed125845a881', 'df935194-f757-59cb-9b7a-7887f19122f7', 13, 'fa3c49f7-d141-58fc-b4af-147fca130c2c', 'Chắn bùn trước trắng', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'cce0a97d-813c-5189-888b-68e90c4afa36', 'df935194-f757-59cb-9b7a-7887f19122f7', 14, '73842302-3667-5686-82b7-eb3b29197db7', 'Chắn bùn trước xanh', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '04c83b08-e8f3-5d90-aa57-b7d10649054a', 'df935194-f757-59cb-9b7a-7887f19122f7', 15, 'b818af0e-724f-5ae7-8488-81a4c8eabe15', 'Chắn bùn trước đỏ', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '303ef401-57c8-550b-bf35-311a7b2ca550', 'df935194-f757-59cb-9b7a-7887f19122f7', 16, '0d6bc7e6-05b6-584b-bab3-63fa95cfed55', 'Chắn bùn trước xám', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'b95610d4-a7fd-52c1-97d9-fe31c7659a28', 'df935194-f757-59cb-9b7a-7887f19122f7', 17, 'e13570cb-2881-571a-b991-f4f5c5ac0571', 'Chắn bùn trước đen', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '74040d42-9ff3-583d-b194-2e76df267c8c', 'df935194-f757-59cb-9b7a-7887f19122f7', 18, 'a3627167-d29a-52fe-a443-53f357acabaa', 'Ốp để chân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '8c4dfe53-7899-5364-91bb-57d1f8d4f7b2', 'df935194-f757-59cb-9b7a-7887f19122f7', 19, 'c080bb34-51aa-5b77-9f39-1639b93e9eb9', 'Ốp để chân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '68d3fdb3-aadd-53b3-a112-e5aa98f8941c', 'df935194-f757-59cb-9b7a-7887f19122f7', 20, '230bd9da-c94c-5f3d-9ac3-ee7b22354465', 'Ốp thân trái', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '08b9cd28-293f-5eef-a8fe-aae8a600ce31', 'df935194-f757-59cb-9b7a-7887f19122f7', 21, '6500c855-dc7d-5852-b905-811353010a4c', 'Ốp thân phải', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '50a81f8b-68b2-5a87-b01d-8c5fa351914b', 'df935194-f757-59cb-9b7a-7887f19122f7', 22, '87561f0e-92ab-530e-8de4-c230f8d3fe8c', 'Ốp trung tâm', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '929dd2bf-5392-50b0-89ad-e5fba67d2336', 'df935194-f757-59cb-9b7a-7887f19122f7', 23, '58e1908d-d14a-55fc-87dc-994f0ce7618e', 'Tấm nối ốp thân xe', '200.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    '02997718-d895-5b84-aa73-e7d497849125', 'PO-202606011', '6ad15722-cf7b-5661-9608-e899c3786042', '2026-06-12T18:29:28.601Z', '2026-03-10T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: Thiên Chúc-2000', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '59d7c159-4686-5acb-97f7-4d9f5649b1ea', '02997718-d895-5b84-aa73-e7d497849125', 1, '9d128669-1a1a-5eb2-bda3-fffe6363a241', 'Tem nhãn hiệu PACEO', '4000.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ea5a9f4c-0a6d-507c-8b13-fe50f71be4a7', '02997718-d895-5b84-aa73-e7d497849125', 2, '9d128669-1a1a-5eb2-bda3-fffe6363a241', 'Tem nhãn hiệu PACEO', '2000.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ac85c8af-d743-5e31-8933-25cd74dbe950', '02997718-d895-5b84-aa73-e7d497849125', 3, '78f10a09-b884-59bb-b194-7c5d4f7c9810', 'Tem logo K Lotus', '2000.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    'ac40561d-90cf-576e-b074-5030f03e51a1', 'PO-202606012', '08dcd0e2-d691-5f11-85fc-bc9867a40567', '2026-06-12T18:29:28.601Z', '2026-03-09T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: Đại Thành-2000', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '334b083d-5e9d-5bed-9f9c-ef2a29d95796', 'ac40561d-90cf-576e-b074-5030f03e51a1', 1, '3f99db2b-f332-5d31-9084-202542421d91', 'Gương xe', '2000.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    '0ca1280c-d46a-506e-9b30-0cb4da428125', 'PO-202606013', '75533283-54d2-541e-bc70-f87638307bfd', '2026-06-12T18:29:28.601Z', '2026-04-21T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: LLQP-5000', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '6028ac47-2242-5042-a70a-14b8eb7adb9d', '0ca1280c-d46a-506e-9b30-0cb4da428125', 1, '8bd52b7b-7176-5b4a-8853-db5def85cadd', 'Bảng ốp nhôm nhựa in UV BN5', '5000.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    '3ca3582c-0193-5614-91ee-9845845eb88c', 'PO-202606014', 'cf22ee26-689f-52ac-af63-2a61863ec0c0', '2026-06-12T18:29:28.601Z', '2026-04-21T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: Dây rút', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        'ab520d40-f011-5dd1-9f78-f1f7505b8782', '3ca3582c-0193-5614-91ee-9845845eb88c', 1, 'a3ee67a0-0883-593f-a0b1-215ab7165393', 'Dây rút R3', '5000.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    'e3ad4e4a-a2c1-5a58-a2dd-3e8b395bdb39', 'PO-202606015', 'c235845a-0bc1-5057-8003-9fd1b454f084', '2026-06-12T18:29:28.601Z', '2026-04-21T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: Mỡ bò', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '5ecbc578-0a1e-5f6e-90fd-b99786964224', 'e3ad4e4a-a2c1-5a58-a2dd-3e8b395bdb39', 1, 'fcb45238-ca86-586c-ba90-4d4af5072dc4', 'Mỡ bò', '3.000', '0.000', '0.000', '0.000'
      );
INSERT INTO public.erp_purchase_orders (
    id, po_no, supplier_id, order_date, expected_date, status, payment_status, remarks, created_at, updated_at
  ) VALUES (
    '208d0f32-7128-5050-934a-9ebaf3bd2ace', 'PO-202606016', 'eeb69e73-cb71-5d3a-9fba-259f4ededc19', '2026-06-12T18:29:28.601Z', '2026-04-21T00:00:00.000Z', 'CONFIRMED', 'UNPAID', 'Nguồn từ sheet: Túi zip', '2026-06-12T18:29:28.601Z', '2026-06-12T18:29:28.601Z'
  );
INSERT INTO public.erp_purchase_order_lines (
        id, purchase_order_id, line_no, item_id, description, qty_ordered, qty_received, unit_price, amount
      ) VALUES (
        '2d5be483-f08d-500b-be63-51c94c82f34e', '208d0f32-7128-5050-934a-9ebaf3bd2ace', 1, '1b1c5475-7b84-5d92-87c4-3ae9fe95eaf2', 'Túi Zip 15x27', '3.000', '0.000', '0.000', '0.000'
      );
