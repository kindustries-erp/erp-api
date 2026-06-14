INSERT INTO public.erp_inventory_transactions (
    id, transaction_type, item_id, warehouse_code, qty_in, qty_out, unit_cost, transaction_date, notes
)
SELECT 
    gen_random_uuid(), 
    'OPENING_BALANCE', 
    component_item_id, 
    'WH-MAIN', 
    qty_required * 10, 
    0, 
    0, 
    CURRENT_DATE, 
    'Seed raw materials for 10 PACEO bikes'
FROM public.erp_bom_lines;

INSERT INTO public.erp_inventory_balances (
    id, item_id, warehouse_code, qty_on_hand, qty_reserved, avg_unit_cost, inventory_value
)
SELECT 
    gen_random_uuid(), 
    component_item_id, 
    'WH-MAIN', 
    qty_required * 10, 
    0, 
    0, 
    0
FROM public.erp_bom_lines;
