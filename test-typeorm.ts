import { DataSource } from 'typeorm';
import dataSource from './src/db/data-source';

async function run() {
  try {
    await dataSource.initialize();
    console.log("Success!");
  } catch (err) {
    console.error(err);
  }
}
run();
