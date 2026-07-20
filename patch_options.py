import re

file_path = '/home/dev/repos-dev-1/erp/erp-api/src/sales-orders-core/sales-orders-core.service.ts'
with open(file_path, 'r') as f:
    content = f.read()

# We'll replace the body of getSalesOrdersColumnOptions
# From lines 1094 to 1180

def get_replacement():
    return """  async getSalesOrdersColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    let selectField = '';
    let isDateColumn = false;
    let isTotalQty = column === 'totalQty';

    if (column === 'orderDate' || column === 'expectedDeliveryDate') {
      selectField =
        column === 'orderDate'
          ? "TO_CHAR(so.order_date, 'YYYY-MM-DD')"
          : "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
      isDateColumn = true;
    } else if (column === 'soNo') selectField = 'so.so_no';
    else if (column === 'customerName') selectField = 'bp.name';
    else if (column === 'status') selectField = 'so.status';
    else if (column === 'remarks') selectField = 'so.remarks';
    else if (column === 'totalQty') selectField = 'totalQty';
    else {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let params: any[] = [];
    let paramIdx = 1;
    let filterConditions = '';

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          let filterField = '';
          if (col === 'orderDate') filterField = "TO_CHAR(so.order_date, 'YYYY-MM-DD')";
          else if (col === 'expectedDeliveryDate') filterField = "TO_CHAR(so.expected_delivery_date, 'YYYY-MM-DD')";
          else if (col === 'soNo') filterField = 'so.so_no';
          else if (col === 'customerName') filterField = 'bp.name';
          else if (col === 'status') filterField = 'so.status';
          else if (col === 'remarks') filterField = 'so.remarks';
          else if (col === 'totalQty') {
            const placeholders = vals.map(v => Number(v)).map(() => `$${paramIdx++}`).join(', ');
            // We use a subquery to filter by totalQty
            filterConditions += ` AND so.id IN (SELECT so_id FROM erp_sales_order_lines GROUP BY so_id HAVING SUM(qty_ordered) IN (${placeholders}))`;
            params.push(...vals.map(v => Number(v)));
            continue;
          }

          if (filterField) {
            const placeholders = vals.map(() => `$${paramIdx++}`).join(', ');
            filterConditions += ` AND CAST(${filterField} AS TEXT) IN (${placeholders})`;
            params.push(...vals);
          }
        }
      } catch (e) {}
    }

    let sql = '';
    if (isTotalQty) {
      sql = `
        WITH totals AS (
          SELECT SUM(l.qty_ordered) as total_qty
          FROM erp_sales_orders so
          LEFT JOIN erp_sales_order_lines l ON so.id = l.so_id
          LEFT JOIN erp_business_partners bp ON so.customer_id = bp.id
          WHERE so.is_deleted = false ${filterConditions}
          GROUP BY so.id
        )
        SELECT DISTINCT CAST(total_qty AS TEXT) as value
        FROM totals
        WHERE total_qty IS NOT NULL
      `;
    } else {
      sql = `
        SELECT DISTINCT ${selectField} as value
        FROM erp_sales_orders so
        LEFT JOIN erp_business_partners bp ON so.customer_id = bp.id
        WHERE so.is_deleted = false ${filterConditions}
      `;
      if (isDateColumn) {
        sql += ` AND ${selectField} IS NOT NULL AND ${selectField} != ''`;
      } else {
        sql += ` AND ${selectField} IS NOT NULL AND CAST(${selectField} AS TEXT) != ''`;
      }
    }

    if (search) {
      const keywords = String(search).split(';').map(k => k.trim()).filter(k => k);
      if (keywords.length > 0) {
        const conditions: string[] = [];
        for (const kw of keywords) {
          if (isTotalQty) {
            conditions.push(`CAST(total_qty AS TEXT) ILIKE $${paramIdx++}`);
          } else {
            conditions.push(`CAST(${selectField} AS TEXT) ILIKE $${paramIdx++}`);
          }
          params.push(`%${kw}%`);
        }
        sql += ` AND (${conditions.join(' OR ')})`;
      }
    }

    if (isTotalQty) {
      // Cast back to numeric for correct sorting of numbers!
      sql += ` ORDER BY CAST(value AS NUMERIC) ASC NULLS LAST`;
    } else {
      sql += ` ORDER BY ${selectField} ASC NULLS LAST`;
    }

    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as subquery`;
    const totalResult = await this.dataSource.query(countSql, params);
    const total = parseInt(totalResult[0]?.total || '0', 10);

    sql += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(pageSize, (page - 1) * pageSize);

    const itemsResult = await this.dataSource.query(sql, params);
    const items = itemsResult.map((r: any) => r.value);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
"""

# Find the function start
start_match = re.search(r'  async getSalesOrdersColumnOptions\(', content)
if not start_match:
    print("Could not find getSalesOrdersColumnOptions start")
    exit(1)

start_idx = start_match.start()
# The function goes until the end of the class which is `}\n}\n`
# We'll just replace everything from getSalesOrdersColumnOptions to the end of the file
new_content = content[:start_idx] + get_replacement()

with open(file_path, 'w') as f:
    f.write(new_content)
