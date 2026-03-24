import { Entity, PrimaryColumn, Column } from 'typeorm';
import type { UserType } from '@nc-dashboard/shared';

@Entity('users')
export class User {
  @PrimaryColumn({ name: 'google_id' })
  googleId: string;

  @Column()
  email: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'spreadsheet_id', nullable: true, type: 'text' })
  spreadsheetId: string | null;

  @Column({ name: 'encrypted_refresh_token', nullable: true, type: 'text' })
  encryptedRefreshToken: string | null;

  @Column({ name: 'created_at' })
  createdAt: string;

  @Column({ name: 'ops_sheet_access', type: 'text', default: 'unchecked' })
  opsSheetAccess: string;

  @Column({
    name: 'ops_person_aliases',
    type: 'simple-json',
    default: '[]',
  })
  opsPersonAliases: string[];

  @Column({ name: 'user_type', type: 'text', default: 'internal' })
  userType: UserType;

  @Column({ name: 'updated_at' })
  updatedAt: string;
}
