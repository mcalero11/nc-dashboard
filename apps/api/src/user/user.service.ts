import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOneBy({ googleId });
  }

  async createOrUpdate(
    userData: Partial<User> & Pick<User, 'googleId'>,
  ): Promise<User> {
    return this.userRepository.manager.transaction(async (manager) => {
      const existing = await manager.findOneBy(User, {
        googleId: userData.googleId,
      });
      const now = new Date().toISOString();

      const user: User = existing
        ? { ...existing, ...userData, updatedAt: now }
        : {
            spreadsheetId: null,
            encryptedRefreshToken: null,
            opsSheetAccess: 'unchecked',
            opsPersonAliases: [],
            userType: 'internal',
            email: '',
            firstName: '',
            lastName: '',
            ...userData,
            createdAt: now,
            updatedAt: now,
          };

      return manager.save(User, user);
    });
  }

  async findUsersWithTokens(): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.encryptedRefreshToken IS NOT NULL')
      .getMany();
  }

  async findUsersWithOpsAccess(): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.opsSheetAccess = :status', { status: 'has_access' })
      .andWhere('user.encryptedRefreshToken IS NOT NULL')
      .getMany();
  }

  async updateOpsSheetAccess(googleId: string, status: string): Promise<void> {
    await this.userRepository.update(
      { googleId },
      { opsSheetAccess: status, updatedAt: new Date().toISOString() },
    );
  }

  async addOpsPersonAlias(googleId: string, alias: string): Promise<string[]> {
    const user = await this.userRepository.findOneBy({ googleId });
    if (!user) return [];

    const normalizedAlias = alias.trim();
    if (!normalizedAlias) {
      return user.opsPersonAliases ?? [];
    }

    const aliases = Array.from(
      new Set([...(user.opsPersonAliases ?? []), normalizedAlias]),
    );

    user.opsPersonAliases = aliases;
    user.updatedAt = new Date().toISOString();
    await this.userRepository.save(user);

    return aliases;
  }

  async removeOpsPersonAlias(
    googleId: string,
    alias: string,
  ): Promise<string[]> {
    const user = await this.userRepository.findOneBy({ googleId });
    if (!user) return [];

    const normalizedAlias = alias.trim();
    const aliases = (user.opsPersonAliases ?? []).filter(
      (existingAlias) => existingAlias !== normalizedAlias,
    );

    user.opsPersonAliases = aliases;
    user.updatedAt = new Date().toISOString();
    await this.userRepository.save(user);

    return aliases;
  }

  async updateSpreadsheetId(
    googleId: string,
    spreadsheetId: string,
  ): Promise<User | null> {
    const user = await this.userRepository.findOneBy({ googleId });
    if (!user) return null;

    user.spreadsheetId = spreadsheetId;
    user.updatedAt = new Date().toISOString();
    return this.userRepository.save(user);
  }
}
