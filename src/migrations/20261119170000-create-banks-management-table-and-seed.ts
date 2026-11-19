import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBanksManagementTableAndSeed20261119170000 implements MigrationInterface {
  name = 'CreateBanksManagementTableAndSeed20261119170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "banks_management" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "code" character varying(50) NOT NULL,
        "short_name" character varying(100) NOT NULL,
        "name" character varying(255) NOT NULL,
        "bin" character varying(10) NOT NULL,
        "logo_url" character varying(500),
        "aliases" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "transfer_supported" boolean NOT NULL DEFAULT true,
        "lookup_supported" boolean NOT NULL DEFAULT true,
        "synced_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
        CONSTRAINT "PK_banks_management_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_banks_management_extra_data_object" CHECK (jsonb_typeof(extra_data) = 'object')
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_banks_management_code_active"
      ON "banks_management" ("code") WHERE "is_deleted" = false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_banks_management_bin" ON "banks_management" ("bin");
      CREATE INDEX IF NOT EXISTS "IDX_banks_management_is_active" ON "banks_management" ("is_active");
      CREATE INDEX IF NOT EXISTS "IDX_banks_management_is_deleted" ON "banks_management" ("is_deleted");
    `);

    const seedBanks = [
      [
        'VCB',
        'Vietcombank',
        'Ngân hàng TMCP Ngoại thương Việt Nam',
        '970436',
        'https://api.vietqr.io/img/VCB.png',
        JSON.stringify(['Vietcombank', 'Ngoai thuong']),
      ],
      [
        'ICB',
        'VietinBank',
        'Ngân hàng TMCP Công thương Việt Nam',
        '970415',
        'https://api.vietqr.io/img/ICB.png',
        JSON.stringify(['VietinBank', 'Cong thuong']),
      ],
      [
        'BIDV',
        'BIDV',
        'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
        '970418',
        'https://api.vietqr.io/img/BIDV.png',
        JSON.stringify(['Dau tu va phat trien']),
      ],
      [
        'VBA',
        'Agribank',
        'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam',
        '970405',
        'https://api.vietqr.io/img/VBA.png',
        JSON.stringify(['Agribank', 'Nong nghiep']),
      ],
      [
        'TCB',
        'Techcombank',
        'Ngân hàng TMCP Kỹ thương Việt Nam',
        '970407',
        'https://api.vietqr.io/img/TCB.png',
        JSON.stringify(['Techcombank', 'Ky thuong']),
      ],
      [
        'MB',
        'MBBank',
        'Ngân hàng TMCP Quân đội',
        '970422',
        'https://api.vietqr.io/img/MB.png',
        JSON.stringify(['MBBank', 'MB Bank', 'Quan doi']),
      ],
      [
        'ACB',
        'ACB',
        'Ngân hàng TMCP Á Châu',
        '970416',
        'https://api.vietqr.io/img/ACB.png',
        JSON.stringify(['A Chau']),
      ],
      [
        'VPB',
        'VPBank',
        'Ngân hàng TMCP Việt Nam Thịnh Vượng',
        '970432',
        'https://api.vietqr.io/img/VPB.png',
        JSON.stringify(['VPBank', 'Thinh vuong']),
      ],
      [
        'TPB',
        'TPBank',
        'Ngân hàng TMCP Tiên Phong',
        '970423',
        'https://api.vietqr.io/img/TPB.png',
        JSON.stringify(['TPBank', 'Tien phong']),
      ],
      [
        'STB',
        'Sacombank',
        'Ngân hàng TMCP Sài Gòn Thương Tín',
        '970403',
        'https://api.vietqr.io/img/STB.png',
        JSON.stringify(['Sacombank', 'Sai gon thuong tin']),
      ],
      [
        'VIB',
        'VIB',
        'Ngân hàng TMCP Quốc tế Việt Nam',
        '970441',
        'https://api.vietqr.io/img/VIB.png',
        JSON.stringify(['Quoc te']),
      ],
      [
        'HDB',
        'HDBank',
        'Ngân hàng TMCP Phát triển TP. Hồ Chí Minh',
        '970437',
        'https://api.vietqr.io/img/HDB.png',
        JSON.stringify(['HDBank']),
      ],
      [
        'SHB',
        'SHB',
        'Ngân hàng TMCP Sài Gòn - Hà Nội',
        '970443',
        'https://api.vietqr.io/img/SHB.png',
        JSON.stringify(['Sai gon Ha noi']),
      ],
      [
        'OCB',
        'OCB',
        'Ngân hàng TMCP Phương Đông',
        '970448',
        'https://api.vietqr.io/img/OCB.png',
        JSON.stringify(['Phuong dong']),
      ],
      [
        'MSB',
        'MSB',
        'Ngân hàng TMCP Hàng Hải Việt Nam',
        '970426',
        'https://api.vietqr.io/img/MSB.png',
        JSON.stringify(['Hang hai']),
      ],
      [
        'SCB',
        'SCB',
        'Ngân hàng TMCP Sài Gòn',
        '970429',
        'https://api.vietqr.io/img/SCB.png',
        JSON.stringify(['Sai gon']),
      ],
      [
        'EIB',
        'Eximbank',
        'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam',
        '970431',
        'https://api.vietqr.io/img/EIB.png',
        JSON.stringify(['Eximbank', 'Xuat nhap khau']),
      ],
      [
        'SEAB',
        'SeABank',
        'Ngân hàng TMCP Đông Nam Á',
        '970440',
        'https://api.vietqr.io/img/SEAB.png',
        JSON.stringify(['SeABank', 'Dong Nam A']),
      ],
      [
        'LPB',
        'LPBank',
        'Ngân hàng TMCP Lộc Phát Việt Nam',
        '970449',
        'https://api.vietqr.io/img/LPB.png',
        JSON.stringify(['LPBank', 'LienVietPostBank', 'Buu dien lien viet']),
      ],
      [
        'PVCB',
        'PVcomBank',
        'Ngân hàng TMCP Đại chúng Việt Nam',
        '970412',
        'https://api.vietqr.io/img/PVCB.png',
        JSON.stringify(['PVcomBank', 'Dai chung']),
      ],
      [
        'NAB',
        'NamABank',
        'Ngân hàng TMCP Nam Á',
        '970428',
        'https://api.vietqr.io/img/NAB.png',
        JSON.stringify(['NamABank', 'Nam A Bank', 'Nam A']),
      ],
      [
        'BAB',
        'BacABank',
        'Ngân hàng TMCP Bắc Á',
        '970409',
        'https://api.vietqr.io/img/BAB.png',
        JSON.stringify(['BacABank', 'Bac A']),
      ],
      [
        'ABB',
        'ABBank',
        'Ngân hàng TMCP An Bình',
        '970425',
        'https://api.vietqr.io/img/ABB.png',
        JSON.stringify(['ABBank', 'An Binh']),
      ],
      [
        'KLB',
        'Kienlongbank',
        'Ngân hàng TMCP Kiên Long',
        '970452',
        'https://api.vietqr.io/img/KLB.png',
        JSON.stringify(['Kienlongbank', 'Kien long']),
      ],
      [
        'MBV',
        'MBV',
        'Ngân hàng TNHH MTV Việt Nam Hiện Đại',
        '970414',
        'https://api.vietqr.io/img/MBV.png',
        JSON.stringify(['MBV', 'Oceanbank', 'Dai duong', 'Viet Nam Hien Dai']),
      ],
      [
        'GPB',
        'GPBank',
        'Ngân hàng Thương mại TNHH MTV Dầu Khí Toàn Cầu',
        '970408',
        'https://api.vietqr.io/img/GPB.png',
        JSON.stringify(['GPBank', 'Dau khi toan cau']),
      ],
      [
        'BVB',
        'BaoVietBank',
        'Ngân hàng TMCP Bảo Việt',
        '970438',
        'https://api.vietqr.io/img/BVB.png',
        JSON.stringify(['BaoVietBank', 'Bao viet']),
      ],
      [
        'VCCB',
        'Vietcapitalbank',
        'Ngân hàng TMCP Bản Việt',
        '970454',
        'https://api.vietqr.io/img/VCCB.png',
        JSON.stringify(['Vietcapitalbank', 'Ban viet']),
      ],
      [
        'PGB',
        'PGBank',
        'Ngân hàng TMCP Xăng dầu Petrolimex',
        '970430',
        'https://api.vietqr.io/img/PGB.png',
        JSON.stringify(['PGBank', 'Petrolimex']),
      ],
      [
        'VAB',
        'VietABank',
        'Ngân hàng TMCP Việt Á',
        '970427',
        'https://api.vietqr.io/img/VAB.png',
        JSON.stringify(['VietABank', 'Viet A']),
      ],
      [
        'NCB',
        'NCB',
        'Ngân hàng TMCP Quốc Dân',
        '970419',
        'https://api.vietqr.io/img/NCB.png',
        JSON.stringify(['Quoc dan']),
      ],
      [
        'SGICB',
        'SaigonBank',
        'Ngân hàng TMCP Sài Gòn Công Thương',
        '970400',
        'https://api.vietqr.io/img/SGICB.png',
        JSON.stringify(['SaigonBank', 'Saigonbank', 'Sai gon Cong thuong']),
      ],
      [
        'IVB',
        'Indovinabank',
        'Ngân hàng TNHH Indovina',
        '970434',
        'https://api.vietqr.io/img/IVB.png',
        JSON.stringify(['Indovinabank', 'Indovina']),
      ],
      [
        'PBVN',
        'PublicBank',
        'Ngân hàng TNHH MTV Public Việt Nam',
        '970439',
        'https://api.vietqr.io/img/PBVN.png',
        JSON.stringify(['PublicBank', 'Public Bank']),
      ],
      [
        'SHBVN',
        'ShinhanBank',
        'Ngân hàng TNHH MTV Shinhan Việt Nam',
        '970424',
        'https://api.vietqr.io/img/SHBVN.png',
        JSON.stringify(['ShinhanBank', 'Shinhan Bank', 'Shinhan']),
      ],
      [
        'WVN',
        'Woori',
        'Ngân hàng TNHH MTV Woori Việt Nam',
        '970457',
        'https://api.vietqr.io/img/WVN.png',
        JSON.stringify(['Woori', 'Woori Bank']),
      ],
      [
        'UOB',
        'UnitedOverseas',
        'Ngân hàng United Overseas - Chi nhánh TP. Hồ Chí Minh',
        '970458',
        'https://api.vietqr.io/img/UOB.png',
        JSON.stringify(['UOB', 'UnitedOverseas', 'United Overseas']),
      ],
    ];

    for (const bank of seedBanks) {
      await queryRunner.query(
        `INSERT INTO "banks_management" ("code", "short_name", "name", "bin", "logo_url", "aliases")
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT ("code") WHERE "is_deleted" = false
         DO UPDATE SET "logo_url" = EXCLUDED."logo_url", "bin" = EXCLUDED."bin", "synced_at" = now()`,
        bank,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "banks_management" CASCADE;`);
  }
}
