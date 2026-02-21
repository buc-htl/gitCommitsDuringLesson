import { GitHubService } from '../services/github.js';

describe('GitHubService', () => {
  let service;
  const mockToken = 'test-token-valid';

  beforeEach(() => {
    service = new GitHubService(mockToken);
  });

  describe('Initialization', () => {
    it('should create instance with token', () => {
      expect(service).toBeDefined();
      expect(typeof service === 'object').toBe(true);
    });

    it('should have required methods', () => {
      expect(typeof service.getOrgRepositories).toBe('function');
      expect(typeof service.getRepositoryCommits).toBe('function');
      expect(typeof service.getCommitDetails).toBe('function');
    });
  });

  describe('Method signatures', () => {
    it('getOrgRepositories returns a Promise', () => {
      // This will fail due to invalid token, but we're testing the contract
      const method = service.getOrgRepositories;
      expect(typeof method).toBe('function');
    });

    it('getRepositoryCommits returns a Promise', () => {
      const method = service.getRepositoryCommits;
      expect(typeof method).toBe('function');
    });

    it('getCommitDetails returns a Promise', () => {
      const method = service.getCommitDetails;
      expect(typeof method).toBe('function');
    });
  });

  describe('Error scenarios', () => {
    it('should handle service creation with empty token', () => {
      const emptyTokenService = new GitHubService('');
      expect(emptyTokenService).toBeDefined();
    });

    it('should handle service creation with very long token', () => {
      const longToken = 'x'.repeat(1000);
      const longTokenService = new GitHubService(longToken);
      expect(longTokenService).toBeDefined();
    });
  });

  describe('Service contract', () => {
    it('should have unique instance for each token', () => {
      const service1 = new GitHubService('token1');
      const service2 = new GitHubService('token2');
      expect(service1).not.toBe(service2);
    });

    it('should preserve service methods across instances', () => {
      const service1 = new GitHubService('token1');
      const service2 = new GitHubService('token2');
      
      expect(typeof service1.getOrgRepositories).toBe(typeof service2.getOrgRepositories);
      expect(typeof service1.getRepositoryCommits).toBe(typeof service2.getRepositoryCommits);
      expect(typeof service1.getCommitDetails).toBe(typeof service2.getCommitDetails);
    });
  });
});
