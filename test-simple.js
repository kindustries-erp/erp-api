const AdmZip = require('adm-zip');
const fs = require('fs');

async function run() {
  const S3Client = require('@aws-sdk/client-s3').S3Client;
  const GetObjectCommand = require('@aws-sdk/client-s3').GetObjectCommand;
  const client = new S3Client({
    region: 'auto',
    endpoint: 'https://9655589609991f469ba1118084e84643.r2.cloudflarestorage.com',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '4c2957d910f91d297327f4458c4bac64',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '2a129ffb157bd52b826ff6deef6bb96b9969db21eb557224213d2f9d863f6fb3',
    }
  });

  // just fetch a hardcoded known zip file that the user uploaded earlier: 49137_0108926276.xml (it is actually a zip)
  const objRes = await client.send(new GetObjectCommand({
    Bucket: 'erp-test',
    Key: 'invoices/IN/2026/06/49137_0108926276.xml'
  }));

  const arrayBuffer = await objRes.Body.transformToByteArray();
  const buffer = Buffer.from(arrayBuffer);
  
  fs.writeFileSync('test.zip', buffer);
  console.log('Saved test.zip');
  
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    const zip = new AdmZip(buffer);
    const xmlEntry = zip.getEntries().find(e => e.entryName.endsWith('.xml'));
    if (xmlEntry) {
      const xml = xmlEntry.getData().toString();
      console.log('XML length:', xml.length);
      fs.writeFileSync('test.xml', xml);
    }
  }
}
run();
