import re

with open('src/erp-invoices-core/erp-invoices-core.service.ts', 'r') as f:
    content = f.read()

# Extract columnSearch and columnFilters logic from findAll
start_marker = "      // -------------------------------------------------------------\n      // Dynamic Column Search\n      // -------------------------------------------------------------"
end_marker = "      let qbOrderColumn = orderColumn;"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Could not find column logic blocks")
    exit(1)

blocks = content[start_idx:end_idx]
# Remove one level of indentation
blocks = '\n'.join([line[2:] if line.startswith('  ') else line for line in blocks.split('\n')])

# Add parsing logic at the beginning of exportExcel
export_start = content.find("  async exportExcel(query: ErpInvoiceQuery): Promise<Buffer> {")

# Find where to insert the blocks inside exportExcel
insert_marker = "    if (query.tag_id) {\n      qb.andWhere(\n        `inv.id IN (SELECT entity_id FROM sys_entity_tags WHERE entity_type = 'erp_invoice' AND tag_id = :tagId)`,\n        { tagId: query.tag_id },\n      );\n    }"
insert_idx = content.find(insert_marker, export_start)

if insert_idx == -1:
    print("Could not find insert marker in exportExcel")
    exit(1)

insert_idx += len(insert_marker)

parsing_logic = """
    let columnSearch: Record<string, string> = {};
    let columnFilters: Record<string, string[]> = {};
    try {
      if (query.column_search) columnSearch = JSON.parse(query.column_search);
      if (query.column_filters) columnFilters = JSON.parse(query.column_filters);
    } catch (e) {
      this.logger.error('Failed to parse column_search or column_filters', e);
    }
"""

new_content = content[:insert_idx] + "\n" + parsing_logic + "\n" + blocks + content[insert_idx:]

with open('src/erp-invoices-core/erp-invoices-core.service.ts', 'w') as f:
    f.write(new_content)

print("exportExcel fixed successfully")
