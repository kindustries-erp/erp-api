import re

file_path = '/home/dev/repos-dev-1/erp/erp-api/src/sales-orders-core/sales-orders-core.service.ts'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Update findAll column_filters
old_filter_code = '''            if (col === 'soNo') qb.andWhere('so.so_no IN (:...soNos)', { soNos: vals });
            else if (col === 'status') qb.andWhere('so.status IN (:...cStatuses)', { cStatuses: vals });
            else if (col === 'remarks') qb.andWhere('so.remarks IN (:...remarks)', { remarks: vals });
            else if (col === 'customerName') qb.andWhere('bp.name IN (:...customerNames)', { customerNames: vals });
            else if (col === 'orderDate') qb.andWhere("TO_CHAR(so.order_date, 'YYYY-MM-DD') IN (:...orderDates)", { orderDates: vals });
            else if (col === 'expectedDeliveryDate') qb.andWhere("TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD') IN (:...expDates)", { expDates: vals });'''

new_filter_code = '''            if (col === 'soNo') qb.andWhere('so.so_no IN (:...soNos)', { soNos: vals });
            else if (col === 'status') qb.andWhere('so.status IN (:...cStatuses)', { cStatuses: vals });
            else if (col === 'remarks') qb.andWhere('so.remarks IN (:...remarks)', { remarks: vals });
            else if (col === 'customerName') qb.andWhere('bp.name IN (:...customerNames)', { customerNames: vals });
            else if (col === 'orderDate') qb.andWhere("TO_CHAR(so.order_date, 'YYYY-MM-DD') IN (:...orderDates)", { orderDates: vals });
            else if (col === 'expectedDeliveryDate') qb.andWhere("TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD') IN (:...expDates)", { expDates: vals });
            else if (col === 'totalQty') {
              qb.andWhere(sqb => {
                const subQuery = sqb.subQuery()
                  .select('l.so_id')
                  .from('erp_sales_order_lines', 'l')
                  .groupBy('l.so_id')
                  .having('SUM(l.qty_ordered) IN (:...totalQtys)')
                  .getQuery();
                return `so.id IN ${subQuery}`;
              }, { totalQtys: vals.map(v => Number(v)) });
            }'''
content = content.replace(old_filter_code, new_filter_code)

# 2. Update findAll column_search
old_search_code = '''              if (col === 'soNo') sqb.orWhere(`so.so_no ILIKE :csw${idx}`, p);
              else if (col === 'status') sqb.orWhere(`so.status ILIKE :csw${idx}`, p);
              else if (col === 'remarks') sqb.orWhere(`so.remarks ILIKE :csw${idx}`, p);
              else if (col === 'customerName') sqb.orWhere(`bp.name ILIKE :csw${idx} OR bp.code ILIKE :csw${idx}`, p);
              else if (col === 'orderDate') sqb.orWhere(`TO_CHAR(so.order_date, 'YYYY-MM-DD') ILIKE :csw${idx}`, p);
              else if (col === 'expectedDeliveryDate') sqb.orWhere(`TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD') ILIKE :csw${idx}`, p);'''

new_search_code = '''              if (col === 'soNo') sqb.orWhere(`so.so_no ILIKE :csw${idx}`, p);
              else if (col === 'status') sqb.orWhere(`so.status ILIKE :csw${idx}`, p);
              else if (col === 'remarks') sqb.orWhere(`so.remarks ILIKE :csw${idx}`, p);
              else if (col === 'customerName') sqb.orWhere(`bp.name ILIKE :csw${idx} OR bp.code ILIKE :csw${idx}`, p);
              else if (col === 'orderDate') sqb.orWhere(`TO_CHAR(so.order_date, 'YYYY-MM-DD') ILIKE :csw${idx}`, p);
              else if (col === 'expectedDeliveryDate') sqb.orWhere(`TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD') ILIKE :csw${idx}`, p);
              else if (col === 'totalQty') {
                const subQuery = sqb.subQuery()
                  .select('l.so_id')
                  .from('erp_sales_order_lines', 'l')
                  .groupBy('l.so_id')
                  .having(`SUM(l.qty_ordered)::text ILIKE :csw${idx}`)
                  .getQuery();
                sqb.orWhere(`so.id IN ${subQuery}`, p);
              }'''
content = content.replace(old_search_code, new_search_code)


with open(file_path, 'w') as f:
    f.write(content)
