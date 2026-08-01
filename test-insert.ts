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
    const draftRepo = AppDataSource.getRepository(SinvoiceDraft);
    const draft = draftRepo.create({
        documentNo: 'TEST-INSERT-1',
        status: 'DRAFT',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        totalAmount: '0',
        vatAmount: '0',
    });
    await draftRepo.save(draft);
    console.log("Saved draft.");
    const saved = await draftRepo.findOne({ where: { documentNo: 'TEST-INSERT-1' } });
    console.log("DB createdAt:", saved?.createdAt);
    await draftRepo.delete({ documentNo: 'TEST-INSERT-1' });
    process.exit(0);
}).catch(console.error);
