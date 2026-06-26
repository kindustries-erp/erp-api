import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { ErpInventoryItem } from './src/inventory-core/entities/erp_inventory_item.entity';
import { ErpUom } from './src/inventory-core/entities/erp_uom.entity';
import { ErpItemType } from './src/inventory-core/entities/erp_item_type.entity';
import { ErpTrackingPolicy } from './src/inventory-core/entities/erp_tracking_policy.entity';
import { ErpTrackingCategory } from './src/inventory-core/entities/erp_tracking_category.entity';
import { ErpGoodsIssue } from './src/goods-issues-core/entities/erp_goods_issue.entity';
import { CompanyProfile } from './src/company-profile/entities/company-profile.entity';

dotenv.config({ path: '.env.klotus-production' });

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [ErpInventoryItem, ErpUom, ErpItemType, ErpTrackingPolicy, ErpTrackingCategory, ErpGoodsIssue, CompanyProfile],
  synchronize: false,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await AppDataSource.initialize();
    
    const repo = AppDataSource.getRepository(ErpInventoryItem);
    await repo.find({ take: 2, relations: ['uom', 'itemType'] });
    console.log('Query 1 success');
    
  } catch (err) {
    console.error('Test DB Error:', err);
  } finally {
    await AppDataSource.destroy();
  }
}
run();
