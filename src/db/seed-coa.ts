import { ErpChartOfAccount } from '../accounting-core/entities/erp_chart_of_account.entity';
import AppDataSource from './data-source';

// Thông tư 99/2025/TT-BTC (thay thế TT 200/2014)
const chartOfAccountsTT99 = [
  { accountCode: '111', accountName: 'Tiền mặt', accountType: 'ASSET' },
  {
    accountCode: '1111',
    accountName: 'Tiền Việt Nam',
    accountType: 'ASSET',
    parentCode: '111',
  },
  {
    accountCode: '1112',
    accountName: 'Ngoại tệ',
    accountType: 'ASSET',
    parentCode: '111',
  },
  {
    accountCode: '112',
    accountName: 'Tiền gửi ngân hàng',
    accountType: 'ASSET',
  },
  {
    accountCode: '1121',
    accountName: 'Tiền Việt Nam',
    accountType: 'ASSET',
    parentCode: '112',
  },
  {
    accountCode: '1122',
    accountName: 'Ngoại tệ',
    accountType: 'ASSET',
    parentCode: '112',
  },
  {
    accountCode: '131',
    accountName: 'Phải thu của khách hàng',
    accountType: 'ASSET',
  },
  {
    accountCode: '133',
    accountName: 'Thuế GTGT được khấu trừ',
    accountType: 'ASSET',
  },
  {
    accountCode: '1331',
    accountName: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ',
    accountType: 'ASSET',
    parentCode: '133',
  },
  { accountCode: '141', accountName: 'Tạm ứng', accountType: 'ASSET' },
  {
    accountCode: '152',
    accountName: 'Nguyên liệu, vật liệu',
    accountType: 'ASSET',
  },
  { accountCode: '153', accountName: 'Công cụ, dụng cụ', accountType: 'ASSET' },
  { accountCode: '155', accountName: 'Thành phẩm', accountType: 'ASSET' },
  { accountCode: '156', accountName: 'Hàng hóa', accountType: 'ASSET' },
  {
    accountCode: '211',
    accountName: 'Tài sản cố định hữu hình',
    accountType: 'ASSET',
  },
  {
    accountCode: '214',
    accountName: 'Hao mòn tài sản cố định',
    accountType: 'ASSET',
  },
  {
    accountCode: '242',
    accountName: 'Chi phí trả trước',
    accountType: 'ASSET',
  },
  {
    accountCode: '331',
    accountName: 'Phải trả cho người bán',
    accountType: 'LIABILITY',
  },
  {
    accountCode: '333',
    accountName: 'Thuế và các khoản phải nộp Nhà nước',
    accountType: 'LIABILITY',
  },
  {
    accountCode: '3331',
    accountName: 'Thuế GTGT phải nộp',
    accountType: 'LIABILITY',
    parentCode: '333',
  },
  {
    accountCode: '33311',
    accountName: 'Thuế GTGT đầu ra',
    accountType: 'LIABILITY',
    parentCode: '3331',
  },
  {
    accountCode: '334',
    accountName: 'Phải trả người lao động',
    accountType: 'LIABILITY',
  },
  {
    accountCode: '338',
    accountName: 'Phải trả, phải nộp khác',
    accountType: 'LIABILITY',
  },
  {
    accountCode: '411',
    accountName: 'Vốn đầu tư của chủ sở hữu',
    accountType: 'EQUITY',
  },
  {
    accountCode: '4111',
    accountName: 'Vốn góp của chủ sở hữu',
    accountType: 'EQUITY',
    parentCode: '411',
  },
  {
    accountCode: '421',
    accountName: 'Lợi nhuận sau thuế chưa phân phối',
    accountType: 'EQUITY',
  },
  {
    accountCode: '511',
    accountName: 'Doanh thu bán hàng và cung cấp dịch vụ',
    accountType: 'REVENUE',
  },
  {
    accountCode: '5111',
    accountName: 'Doanh thu bán hàng hóa',
    accountType: 'REVENUE',
    parentCode: '511',
  },
  {
    accountCode: '5112',
    accountName: 'Doanh thu bán các thành phẩm',
    accountType: 'REVENUE',
    parentCode: '511',
  },
  {
    accountCode: '5113',
    accountName: 'Doanh thu cung cấp dịch vụ',
    accountType: 'REVENUE',
    parentCode: '511',
  },
  {
    accountCode: '515',
    accountName: 'Doanh thu hoạt động tài chính',
    accountType: 'REVENUE',
  },
  {
    accountCode: '632',
    accountName: 'Giá vốn hàng bán',
    accountType: 'EXPENSE',
  },
  {
    accountCode: '641',
    accountName: 'Chi phí bán hàng',
    accountType: 'EXPENSE',
  },
  {
    accountCode: '642',
    accountName: 'Chi phí quản lý doanh nghiệp',
    accountType: 'EXPENSE',
  },
  { accountCode: '711', accountName: 'Thu nhập khác', accountType: 'REVENUE' },
  { accountCode: '811', accountName: 'Chi phí khác', accountType: 'EXPENSE' },
  {
    accountCode: '911',
    accountName: 'Xác định kết quả kinh doanh',
    accountType: 'EQUITY',
  },
];

async function seedChartOfAccounts() {
  await AppDataSource.initialize();
  console.log('Database connected.');

  const branchRepo = AppDataSource.getRepository('erp_branches');
  const branches = await branchRepo.find();
  if (!branches.length) {
    throw new Error('No branch found! Please create a branch first.');
  }

  const repo = AppDataSource.getRepository(ErpChartOfAccount);

  // Clear existing accounts
  await repo.delete({});
  console.log('Cleared existing Chart of Accounts.');

  for (const branch of branches) {
    console.log(`Seeding for branch: ${branch.id}`);

    // Create a map to resolve parent IDs later per branch
    const createdAccounts: Record<string, ErpChartOfAccount> = {};

    for (const account of chartOfAccountsTT99) {
      let parentId: string | null = null;
      if (account.parentCode) {
        const parent = createdAccounts[account.parentCode];
        if (parent) {
          parentId = parent.id;
        }
      }

      const newAccount = repo.create({
        branchId: branch.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        parentId,
        isActive: true,
      });
      const saved = await repo.save(newAccount);
      createdAccounts[account.accountCode] = saved;
      console.log(
        `Created account for branch ${branch.id}: ${account.accountCode} - ${account.accountName}`,
      );
    }
  }

  console.log('Seed completed successfully for TT99/2025!');
  await AppDataSource.destroy();
}

seedChartOfAccounts().catch((error) => {
  console.error('Error seeding chart of accounts:', error);
  process.exit(1);
});
