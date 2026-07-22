import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { applyMultiKeywordFilter } from './src/common/utils/query-builder.util';

@Entity()
class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  invoice_no: string;
}

async function test() {
  const AppDataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [Invoice],
    synchronize: true,
  });

  await AppDataSource.initialize();

  const qb = AppDataSource.getRepository(Invoice).createQueryBuilder('inv');
  
  applyMultiKeywordFilter(qb, 'inv.invoice_no', '37;22', 'invoiceNoSearch');

  const [sql, params] = qb.getQueryAndParameters();
  console.log('SQL:', sql);
  console.log('Params:', params);
}

test().catch(console.error);
