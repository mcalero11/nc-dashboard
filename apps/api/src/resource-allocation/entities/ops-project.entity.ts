import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ops_projects')
export class OpsProject {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_name', type: 'text' })
  projectName: string;

  @Column({ name: 'engagement_type', type: 'text', default: '' })
  engagementType: string;

  @Column({ name: 'metadata', type: 'text', default: '' })
  metadata: string;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal: boolean;

  @Column({ name: 'sheet_row_index', type: 'integer' })
  sheetRowIndex: number;

  @Column({ name: 'sync_batch_id', type: 'text' })
  syncBatchId: string;
}
