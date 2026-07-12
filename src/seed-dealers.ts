import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import dataSource from './db/data-source';
import { ErpBusinessPartner } from './business-partners-core/entities/erp_business_partner.entity';

async function seedDealers() {
  await dataSource.initialize();
  console.log('Database connected!');

  const bpRepo = dataSource.getRepository(ErpBusinessPartner);

  // Determine the default partnerType from an existing record (e.g. KL0001)
  let defaultPartnerType = 'CUSTOMER'; // fallback
  const existingPartner = await bpRepo.findOne({ where: { code: 'KL0001' } });
  if (existingPartner && existingPartner.partnerType) {
    defaultPartnerType = existingPartner.partnerType;
    console.log(`Using partnerType from KL0001: ${defaultPartnerType}`);
  } else {
    // try to find any partner to infer type if KL0001 is missing
    const anyPartner = await bpRepo.findOne({ where: {} });
    if (anyPartner && anyPartner.partnerType) {
      defaultPartnerType = anyPartner.partnerType;
      console.log(
        `Using partnerType from a random partner: ${defaultPartnerType}`,
      );
    } else {
      console.log(
        `No existing partners found to infer partnerType, using fallback: ${defaultPartnerType}`,
      );
    }
  }

  const jsonPath =
    '/home/dev/repos/erp/data/web-db/danh_sach_dai_ly_klotus.json';
  const fileContent = fs.readFileSync(jsonPath, 'utf8');
  const dealers = JSON.parse(fileContent);

  console.log(`Found ${dealers.length} dealers in JSON.`);

  let insertedCount = 0;
  let updatedCount = 0;

  for (const dealer of dealers) {
    let partner = await bpRepo.findOne({ where: { code: dealer.dealerCode } });

    if (partner) {
      // Update
      partner.name = dealer.fullName || partner.name;
      partner.displayName = dealer.displayName || partner.displayName;
      partner.taxCode = dealer.taxCode || partner.taxCode;
      partner.phone = dealer.phone || partner.phone;
      partner.address = dealer.address || partner.address;
      partner.contactName = dealer.representative || partner.contactName;

      await bpRepo.save(partner);
      updatedCount++;
      console.log(`Updated: ${dealer.dealerCode}`);
    } else {
      // Insert
      partner = bpRepo.create({
        code: dealer.dealerCode,
        name: dealer.fullName || dealer.displayName || 'Unknown',
        displayName: dealer.displayName,
        taxCode: dealer.taxCode,
        phone: dealer.phone,
        address: dealer.address,
        contactName: dealer.representative,
        partnerType: defaultPartnerType,
        status: 'ACTIVE',
        isDeleted: false,
      });

      await bpRepo.save(partner);
      insertedCount++;
      console.log(`Inserted: ${dealer.dealerCode}`);
    }
  }

  console.log(
    `Seeding complete. Inserted: ${insertedCount}, Updated: ${updatedCount}`,
  );
  process.exit(0);
}

seedDealers().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
