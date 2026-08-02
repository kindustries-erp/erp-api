import { DataSource } from "typeorm";
import { SinvoiceDraft } from "./src/sinvoice/entities/sinvoice-draft.entity";

const AppDataSource = new DataSource({
    type: "postgres",
    url: "postgresql://neondb_owner:npg_AicstnBPeJ90@ep-falling-pine-aodtbrjs-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    entities: [SinvoiceDraft],
    synchronize: false,
    logging: true,
});

AppDataSource.initialize().then(async () => {
    const qb = AppDataSource.getRepository(SinvoiceDraft).createQueryBuilder("draft");
    qb.select(`DISTINCT draft.vat_amount`, 'value');
    qb.andWhere(`draft.vat_amount IS NOT NULL`);
    qb.andWhere(`CAST(draft.vat_amount AS TEXT) != ''`);
    qb.orderBy('value', 'ASC');
    const res = await qb.getRawMany();
    console.log("RES:", res);
    process.exit(0);
}).catch(console.error);
