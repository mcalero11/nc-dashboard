import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from './user.service.js';
import { User } from './user.entity.js';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    googleId: 'google-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    spreadsheetId: null,
    encryptedRefreshToken: null,
    opsSheetAccess: 'unchecked',
    opsPersonAliases: [],
    userType: 'internal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('UserService', () => {
  let service: UserService;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockRepository = {
    findOneBy: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    manager: {
      transaction: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get(UserService);
  });

  describe('findUsersWithTokens', () => {
    it('should return all users that have a refresh token', async () => {
      const users = [
        makeUser({ googleId: 'g-1', encryptedRefreshToken: 'enc-token-1' }),
        makeUser({ googleId: 'g-2', encryptedRefreshToken: 'enc-token-2' }),
      ];
      mockQueryBuilder.getMany.mockResolvedValue(users);

      const result = await service.findUsersWithTokens();

      expect(result).toEqual(users);
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.encryptedRefreshToken IS NOT NULL',
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should return empty array when no users have tokens', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.findUsersWithTokens();

      expect(result).toEqual([]);
    });
  });

  describe('findUsersWithOpsAccess', () => {
    it('should filter by has_access status AND non-null token', async () => {
      const users = [
        makeUser({
          googleId: 'g-1',
          opsSheetAccess: 'has_access',
          encryptedRefreshToken: 'enc-token',
        }),
      ];
      mockQueryBuilder.getMany.mockResolvedValue(users);

      const result = await service.findUsersWithOpsAccess();

      expect(result).toEqual(users);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.opsSheetAccess = :status',
        { status: 'has_access' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.encryptedRefreshToken IS NOT NULL',
      );
    });
  });

  describe('findByGoogleId', () => {
    it('should return user when found', async () => {
      const user = makeUser();
      mockRepository.findOneBy.mockResolvedValue(user);

      const result = await service.findByGoogleId('google-1');

      expect(result).toEqual(user);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        googleId: 'google-1',
      });
    });

    it('should return null when not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await service.findByGoogleId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateOpsSheetAccess', () => {
    it('should update the access status and timestamp', async () => {
      await service.updateOpsSheetAccess('google-1', 'has_access');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { googleId: 'google-1' },
        expect.objectContaining({
          opsSheetAccess: 'has_access',
          updatedAt: expect.any(String) as unknown as string,
        }),
      );
    });
  });
});
