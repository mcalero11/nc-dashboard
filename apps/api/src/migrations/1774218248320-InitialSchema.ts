import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1774218248320 implements MigrationInterface {
  name = 'InitialSchema1774218248320';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("google_id" varchar PRIMARY KEY NOT NULL, "email" varchar NOT NULL, "first_name" varchar NOT NULL, "last_name" varchar NOT NULL, "spreadsheet_id" text, "encrypted_refresh_token" text, "created_at" varchar NOT NULL, "ops_sheet_access" text NOT NULL DEFAULT ('unchecked'), "ops_person_aliases" text NOT NULL DEFAULT ('[]'), "updated_at" varchar NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE "ops_sync_config" ("id" varchar PRIMARY KEY NOT NULL, "spreadsheet_id" text, "last_sync_at" text, "last_sync_status" text, "last_sync_error" text, "last_sync_user_id" text, "updated_at" text)`,
    );
    await queryRunner.query(
      `CREATE TABLE "ops_projects" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "project_name" text NOT NULL, "engagement_type" text NOT NULL DEFAULT (''), "metadata" text NOT NULL DEFAULT (''), "is_internal" boolean NOT NULL DEFAULT (0), "sheet_row_index" integer NOT NULL, "sync_batch_id" text NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE "ops_allocations" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "project_name" text NOT NULL, "role" text NOT NULL DEFAULT (''), "person_name" text NOT NULL DEFAULT (''), "comments" text NOT NULL DEFAULT (''), "is_unassigned" boolean NOT NULL DEFAULT (0), "weekly_hours" text NOT NULL DEFAULT ('{}'), "sheet_row_index" integer NOT NULL, "sync_batch_id" text NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ops_allocations"`);
    await queryRunner.query(`DROP TABLE "ops_projects"`);
    await queryRunner.query(`DROP TABLE "ops_sync_config"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
