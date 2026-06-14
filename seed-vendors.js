const fs = require('fs');

const inputPath = '/opt/repos/liouni-erp-core/liouni-erp-web/k_lotus_vendors.json';
const outputPath = '/opt/repos/liouni-erp-core/liouni-erp-api/seed-vendors.sql';

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

let sql = `DELETE FROM public.erp_business_partners WHERE partner_type = 'VENDOR';\n\n`;

for (const vendor of data) {
  const id = vendor.id ? `'${vendor.id}'` : 'gen_random_uuid()';
  const code = vendor.code ? `'${vendor.code.replace(/'/g, "''")}'` : 'NULL';
  const name = vendor.name ? `'${vendor.name.replace(/'/g, "''")}'` : 'NULL';
  const displayName = vendor.displayName ? `'${vendor.displayName.replace(/'/g, "''")}'` : 'NULL';
  const partnerType = `'VENDOR'`;
  const taxCode = vendor.taxCode ? `'${vendor.taxCode.replace(/'/g, "''")}'` : 'NULL';
  const phone = vendor.phone ? `'${vendor.phone.replace(/'/g, "''")}'` : 'NULL';
  const email = vendor.email ? `'${vendor.email.replace(/'/g, "''")}'` : 'NULL';
  const address = vendor.address ? `'${vendor.address.replace(/'/g, "''")}'` : 'NULL';
  const contactName = vendor.contactName ? `'${vendor.contactName.replace(/'/g, "''")}'` : 'NULL';
  const status = vendor.status ? `'${vendor.status.replace(/'/g, "''")}'` : `'ACTIVE'`;
  const notes = vendor.notes ? `'${vendor.notes.replace(/'/g, "''")}'` : 'NULL';
  const isDeleted = vendor.isDeleted ? 'true' : 'false';

  sql += `INSERT INTO public.erp_business_partners (
    id, code, name, display_name, partner_type, tax_code, phone, email, address, contact_name, status, notes, is_deleted
  ) VALUES (
    ${id}, ${code}, ${name}, ${displayName}, ${partnerType}, ${taxCode}, ${phone}, ${email}, ${address}, ${contactName}, ${status}, ${notes}, ${isDeleted}
  );\n`;
}

fs.writeFileSync(outputPath, sql);
console.log(`Successfully generated ${outputPath} with ${data.length} vendors.`);
