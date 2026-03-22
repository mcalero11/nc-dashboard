import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { startOfWeek, format } from 'date-fns';
import { OpsProject } from './entities/ops-project.entity.js';
import { OpsAllocation } from './entities/ops-allocation.entity.js';
import { OpsSyncConfig } from './entities/ops-sync-config.entity.js';
import { User } from '../user/user.entity.js';
import type {
  OpsProjectsResponse,
  OpsAllocationsResponse,
  OpsSyncStatusResponse,
  OpsProjectDto,
  OpsAllocationDto,
} from '@nc-dashboard/shared';

export interface AllocationFilters {
  projectName?: string;
  personName?: string;
  includeInternal?: boolean;
  unassignedOnly?: boolean;
}

interface AllocationIdentityResolution {
  status: 'resolved' | 'ambiguous' | 'no_match';
  matchedPersonNames: string[];
  candidatePersonNames: string[];
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class ResourceAllocationService {
  constructor(
    @InjectRepository(OpsProject)
    private readonly projectRepo: Repository<OpsProject>,
    @InjectRepository(OpsAllocation)
    private readonly allocationRepo: Repository<OpsAllocation>,
    @InjectRepository(OpsSyncConfig)
    private readonly syncConfigRepo: Repository<OpsSyncConfig>,
  ) {}

  async getProjects(includeInternal?: boolean): Promise<OpsProjectsResponse> {
    const qb = this.projectRepo.createQueryBuilder('p');
    if (includeInternal === false) {
      qb.where('p.isInternal = :isInternal', { isInternal: false });
    }
    qb.orderBy('p.projectName', 'ASC');
    const projects = await qb.getMany();

    const config = await this.syncConfigRepo.findOneBy({ id: 'singleton' });

    const projectDtos: OpsProjectDto[] = projects.map((p) => ({
      projectName: p.projectName,
      engagementType: p.engagementType,
      metadata: p.metadata,
      isInternal: p.isInternal,
    }));

    return {
      projects: projectDtos,
      lastSyncAt: config?.lastSyncAt ?? null,
    };
  }

  async getAllocations(
    user: User,
    filters?: AllocationFilters,
  ): Promise<OpsAllocationsResponse> {
    const qb = this.allocationRepo.createQueryBuilder('a');

    if (filters?.projectName) {
      qb.andWhere('a.projectName = :projectName', {
        projectName: filters.projectName,
      });
    }
    if (filters?.includeInternal === false) {
      // Exclude projects starting with 'z'
      qb.andWhere("a.projectName NOT LIKE 'z%'");
    }
    if (filters?.unassignedOnly) {
      qb.andWhere('a.isUnassigned = :isUnassigned', { isUnassigned: true });
    }

    const rawAllocations = await qb.getMany();
    const resolution = this.resolveIdentity(
      user,
      rawAllocations,
      filters?.personName,
    );

    const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const currentWeekDate = format(currentMonday, 'yyyy-MM-dd');
    const config = await this.syncConfigRepo.findOneBy({ id: 'singleton' });
    const relevantAllocations =
      resolution.status === 'resolved'
        ? rawAllocations.filter((allocation) =>
            resolution.matchedPersonNames.includes(allocation.personName),
          )
        : [];
    const allocationDtos = this.toAllocationDtos(relevantAllocations);
    const weekDates = this.collectWeekDates(rawAllocations);

    const baseResponse = {
      currentWeekDate,
      weekDates,
      lastSyncAt: config?.lastSyncAt ?? null,
      savedAliases: user.opsPersonAliases ?? [],
    };

    if (resolution.status === 'resolved') {
      return {
        ...baseResponse,
        status: 'resolved',
        allocations: allocationDtos,
        matchedPersonNames: resolution.matchedPersonNames,
        candidatePersonNames: resolution.candidatePersonNames,
      };
    }

    if (resolution.status === 'ambiguous') {
      return {
        ...baseResponse,
        status: 'ambiguous',
        allocations: [],
        matchedPersonNames: [],
        candidatePersonNames: resolution.candidatePersonNames,
      };
    }

    return {
      ...baseResponse,
      status: 'no_match',
      allocations: [],
      matchedPersonNames: [],
      candidatePersonNames: [],
    };
  }

  async shouldTriggerSyncAfterAccess(): Promise<boolean> {
    const config = await this.syncConfigRepo.findOneBy({ id: 'singleton' });
    if (!config?.lastSyncAt || config.lastSyncStatus !== 'success') {
      return true;
    }

    const allocationCount = await this.allocationRepo.count();
    return allocationCount === 0;
  }

  async getSyncStatus(): Promise<OpsSyncStatusResponse> {
    const config = await this.syncConfigRepo.findOneBy({ id: 'singleton' });

    if (!config || !config.lastSyncStatus) {
      return { lastSyncAt: null, status: 'never', error: null };
    }

    return {
      lastSyncAt: config.lastSyncAt,
      status: config.lastSyncStatus as 'success' | 'failed',
      error: config.lastSyncError,
    };
  }

  private toAllocationDtos(allocations: OpsAllocation[]): OpsAllocationDto[] {
    return allocations.map((allocation) => ({
      projectName: allocation.projectName,
      role: allocation.role,
      personName: allocation.personName,
      comments: allocation.comments,
      isUnassigned: allocation.isUnassigned,
      weeklyHours: JSON.parse(allocation.weeklyHours) as Record<string, number>,
    }));
  }

  private collectWeekDates(allocations: OpsAllocation[]): string[] {
    const weekDateSet = new Set<string>();
    for (const allocation of allocations) {
      const weeklyHours = JSON.parse(allocation.weeklyHours) as Record<
        string,
        number
      >;
      for (const date of Object.keys(weeklyHours)) {
        weekDateSet.add(date);
      }
    }

    return Array.from(weekDateSet).sort();
  }

  private resolveIdentity(
    user: User,
    allocations: OpsAllocation[],
    explicitName?: string,
  ): AllocationIdentityResolution {
    const distinctPersonNames = Array.from(
      new Set(
        allocations
          .filter((allocation) => !allocation.isUnassigned)
          .map((allocation) => allocation.personName.trim())
          .filter(Boolean),
      ),
    );

    const exactPreferredNames = Array.from(
      new Set(
        [
          explicitName?.trim(),
          ...(user.opsPersonAliases ?? []),
          `${user.firstName} ${user.lastName}`.trim(),
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    const matchedPersonNames = distinctPersonNames.filter((personName) => {
      const normalizedPersonName = normalizeName(personName);
      return exactPreferredNames.some(
        (preferredName) =>
          normalizeName(preferredName) === normalizedPersonName,
      );
    });

    if (matchedPersonNames.length > 0) {
      return {
        status: 'resolved',
        matchedPersonNames,
        candidatePersonNames: matchedPersonNames,
      };
    }

    const firstName = normalizeName(user.firstName);
    const lastName = normalizeName(user.lastName);
    const fallbackTokens = Array.from(
      new Set([firstName, lastName].filter((token) => token.length > 0)),
    );

    const candidatePersonNames = distinctPersonNames
      .filter((personName) => {
        const normalizedPersonName = normalizeName(personName);
        return fallbackTokens.some((token) =>
          normalizedPersonName.includes(token),
        );
      })
      .sort((left, right) => left.localeCompare(right));

    if (candidatePersonNames.length > 0) {
      return {
        status: 'ambiguous',
        matchedPersonNames: [],
        candidatePersonNames,
      };
    }

    return {
      status: 'no_match',
      matchedPersonNames: [],
      candidatePersonNames: [],
    };
  }
}
