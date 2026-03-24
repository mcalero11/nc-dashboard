import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserType1774500000000 implements MigrationInterface {
  name = 'AddUserType1774500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "user_type" text NOT NULL DEFAULT ('internal')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "user_type"`);
  }
}
