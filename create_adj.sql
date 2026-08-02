DO $$
DECLARE
    new_adj_id uuid;
    item record;
    line_number integer := 1;
BEGIN
    INSERT INTO erp_inventory_adjustments (adjustment_no, adjustment_date, status, remarks)
    VALUES ('ADJ-ALL-' || to_char(now(), 'YYYYMMDDHH24MISS'), now(), 'DRAFT', 'Tăng số lượng tất cả item lên 10000')
    RETURNING id INTO new_adj_id;

    FOR item IN SELECT id, item_name FROM erp_inventory_items WHERE is_deleted = false LOOP
        INSERT INTO erp_inventory_adjustment_lines (adjustment_id, item_id, item_name, qty_adjusted, type_adjust, line_no)
        VALUES (new_adj_id, item.id, item.item_name, 10000, 'INCREASE', line_number);
        line_number := line_number + 1;
    END LOOP;
END $$;
