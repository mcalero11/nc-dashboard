export const OPS_SYNC_QUEUE = 'ops-resource-sync';
export const OPS_SYNC_JOB_SCHEDULER_ID = 'ops-sync-repeatable';

export interface OpsSyncJobPayload {
  triggeredBy: 'schedule' | 'manual';
  userId?: string;
}
