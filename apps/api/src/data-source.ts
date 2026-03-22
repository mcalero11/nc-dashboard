import 'reflect-metadata';
import type { DataSourceOptions } from 'typeorm';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { User } from './user/user.entity.js';
import { OpsSyncConfig } from './resource-allocation/entities/ops-sync-config.entity.js';
import { OpsProject } from './resource-allocation/entities/ops-project.entity.js';
import { OpsAllocation } from './resource-allocation/entities/ops-allocation.entity.js';

const isProduction = process.env.NODE_ENV === 'production';

export const dataSourceOptions: DataSourceOptions = {
  type: 'better-sqlite3',
  database: join(process.cwd(), 'data', 'users.db'),
  entities: [User, OpsSyncConfig, OpsProject, OpsAllocation],
  migrations: [join(__dirname, 'migrations', '*.js')],
  synchronize: !isProduction,
  migrationsRun: isProduction,
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
