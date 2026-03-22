import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ops_allocations')
export class OpsAllocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_name', type: 'text' })
  projectName: string;

  @Column({ name: 'role', type: 'text', default: '' })
  role: string;

  @Column({ name: 'person_name', type: 'text', default: '' })
  personName: string;

  @Column({ name: 'comments', type: 'text', default: '' })
  comments: string;

  @Column({ name: 'is_unassigned', type: 'boolean', default: false })
  isUnassigned: boolean;

  @Column({ name: 'weekly_hours', type: 'text', default: '{}' })
  weeklyHours: string;

  @Column({ name: 'sheet_row_index', type: 'integer' })
  sheetRowIndex: number;

  @Column({ name: 'sync_batch_id', type: 'text' })
  syncBatchId: string;
}
