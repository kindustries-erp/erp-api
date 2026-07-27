import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { KgaraClientService } from './kgara-api-core/kgara-client.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const client = app.get(KgaraClientService);

  try {
    const data = await client.getGrossProfitDetail(
      '0b4d6d3a-55df-492b-abaf-377d84b61d05',
      '2026-06-01',
      '2026-06-17',
    );
    console.log('JSON OUTPUT KEYS:', Object.keys(data));
    if (data.results) console.log('results keys:', Object.keys(data.results));
    if (Array.isArray(data))
      console.log('It is an array of length', data.length);
    if (data.data) console.log('data is an array of length', data.data.length);
  } catch (e) {
    console.error(e);
  }
  await app.close();
}
bootstrap();
