import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('ops_sync_config')
export class OpsSyncConfig {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'spreadsheet_id', type: 'text', nullable: true })
  spreadsheetId: string | null;

  @Column({ name: 'last_sync_at', type: 'text', nullable: true })
  lastSyncAt: string | null;

  @Column({ name: 'last_sync_status', type: 'text', nullable: true })
  lastSyncStatus: string | null;

  @Column({ name: 'last_sync_error', type: 'text', nullable: true })
  lastSyncError: string | null;

  @Column({ name: 'last_sync_user_id', type: 'text', nullable: true })
  lastSyncUserId: string | null;

  @Column({ name: 'updated_at', type: 'text', nullable: true })
  updatedAt: string | null;
}
