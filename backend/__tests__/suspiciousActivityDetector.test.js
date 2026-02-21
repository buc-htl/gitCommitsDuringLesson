import { jest } from '@jest/globals';
import { SuspiciousActivityDetector } from '../services/suspiciousActivityDetector.js';

describe('SuspiciousActivityDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new SuspiciousActivityDetector();
  });

  describe('analyze', () => {
    it('should return zero score for empty commits', () => {
      const result = detector.analyze([], 'test-repo');

      expect(result.score).toBe(0);
      expect(result.flags).toHaveLength(0);
      expect(result.repoName).toBe('test-repo');
    });

    it('should detect mass activity pattern', () => {
      const now = new Date('2026-02-21T10:00:00Z');
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date(now - 5 * 60000).toISOString() } },
          stats: { additions: 150, deletions: 50 }
        },
        {
          commit: { author: { name: 'Student', date: new Date(now - 3 * 60000).toISOString() } },
          stats: { additions: 200, deletions: 60 }
        },
        {
          commit: { author: { name: 'Student', date: new Date(now - 1 * 60000).toISOString() } },
          stats: { additions: 180, deletions: 40 }
        }
      ];

      const result = detector.analyze(commits, 'suspicious-repo');

      expect(result.score).toBeGreaterThan(0);
      const massActivityFlag = result.flags.find(f => f.type === 'MASS_ACTIVITY');
      expect(massActivityFlag).toBeDefined();
      expect(massActivityFlag.severity).toMatch(/high|medium/);
    });

    it('should detect single large commit', () => {
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date().toISOString() } },
          stats: { additions: 600, deletions: 100 }
        }
      ];

      const result = detector.analyze(commits, 'large-commit-repo');

      expect(result.score).toBeGreaterThan(0);
      const massCommitFlag = result.flags.find(f => f.type === 'MASS_COMMIT');
      expect(massCommitFlag).toBeDefined();
    });

    it('should detect single commit for entire exercise', () => {
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date().toISOString() } },
          stats: { additions: 200, deletions: 0 }
        }
      ];

      const result = detector.analyze(commits, 'one-commit-repo');

      expect(result.score).toBeGreaterThan(0);
      const singleCommitFlag = result.flags.find(f => f.type === 'SINGLE_COMMIT');
      expect(singleCommitFlag).toBeDefined();
    });

    it('should detect no corrections pattern', () => {
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date().toISOString() } },
          stats: { additions: 300, deletions: 5 }
        }
      ];

      const result = detector.analyze(commits, 'no-corrections-repo');

      expect(result.score).toBeGreaterThan(0);
      const noCorrectionsFlag = result.flags.find(f => 
        f.type === 'NO_CORRECTIONS' || f.type === 'ONLY_ADDITIONS'
      );
      expect(noCorrectionsFlag).toBeDefined();
    });

    it('should detect rapid-fire commits', () => {
      const now = new Date('2026-02-21T10:00:00Z');
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date(now - 60000).toISOString() } },
          stats: { additions: 49, deletions: 10 }
        },
        {
          commit: { author: { name: 'Student', date: new Date(now - 40000).toISOString() } },
          stats: { additions: 59, deletions: 15 }
        },
        {
          commit: { author: { name: 'Student', date: new Date(now - 20000).toISOString() } },
          stats: { additions: 54, deletions: 12 }
        }
      ];

      const result = detector.analyze(commits, 'rapid-fire-repo');

      expect(result.score).toBeGreaterThan(0);
      const rapidFireFlag = result.flags.find(f => f.type === 'RAPID_FIRE');
      expect(rapidFireFlag).toBeDefined();
    });

    it('should detect unrealistic speed', () => {
      const now = new Date('2026-02-21T10:00:00Z');
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date(now - 2 * 60000).toISOString() } },
          stats: { additions: 50, deletions: 10 }
        },
        {
          commit: { author: { name: 'Student', date: new Date(now - 1 * 60000).toISOString() } },
          stats: { additions: 150, deletions: 30 } // 150 lines in 1 minute = 150 lines/min
        }
      ];

      const result = detector.analyze(commits, 'fast-repo');

      expect(result.score).toBeGreaterThan(0);
      const speedFlag = result.flags.find(f => f.type === 'UNREALISTIC_SPEED');
      expect(speedFlag).toBeDefined();
    });

    it('should detect generic commit messages', () => {
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date().toISOString() }, message: 'update' },
          stats: { additions: 50, deletions: 10 }
        },
        {
          commit: { author: { name: 'Student', date: new Date().toISOString() }, message: 'fix' },
          stats: { additions: 60, deletions: 15 }
        },
        {
          commit: { author: { name: 'Student', date: new Date().toISOString() }, message: 'done' },
          stats: { additions: 55, deletions: 12 }
        }
      ];

      const result = detector.analyze(commits, 'generic-msgs-repo');

      expect(result.score).toBeGreaterThan(0);
      const msgFlag = result.flags.find(f => 
        f.type === 'GENERIC_MESSAGES' || f.type === 'MOSTLY_GENERIC'
      );
      expect(msgFlag).toBeDefined();
    });

    it('should cap score at 100', () => {
      const now = new Date('2026-02-21T10:00:00Z');
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date(now - 10 * 60000).toISOString() }, message: 'update' },
          stats: { additions: 600, deletions: 5 }
        },
        {
          commit: { author: { name: 'Student', date: new Date(now - 8 * 60000).toISOString() }, message: 'fix' },
          stats: { additions: 500, deletions: 8 }
        },
        {
          commit: { author: { name: 'Student', date: new Date(now - 6 * 60000).toISOString() }, message: 'done' },
          stats: { additions: 550, deletions: 10 }
        }
      ];

      const result = detector.analyze(commits, 'extreme-repo');

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should include totalLines and commitCount in result', () => {
      const commits = [
        {
          commit: { author: { name: 'Student', date: new Date().toISOString() } },
          stats: { additions: 100, deletions: 20 }
        },
        {
          commit: { author: { name: 'Student', date: new Date().toISOString() } },
          stats: { additions: 80, deletions: 15 }
        }
      ];

      const result = detector.analyze(commits, 'test-repo');

      expect(result.totalLines).toBe(215); // 100 + 20 + 80 + 15
      expect(result.commitCount).toBe(2);
    });

    it('should handle realistic student commits without flagging', () => {
      const now = new Date('2026-02-21T10:00:00Z');
      const commits = [
        {
          commit: { 
            author: { name: 'Student', date: new Date(now - 2 * 60 * 60000).toISOString() },
            message: 'Add function to calculate sum'
          },
          stats: { additions: 30, deletions: 5 }
        },
        {
          commit: { 
            author: { name: 'Student', date: new Date(now - 1 * 60 * 60000).toISOString() },
            message: 'Fix bug in sum calculation'
          },
          stats: { additions: 15, deletions: 8 }
        },
        {
          commit: { 
            author: { name: 'Student', date: new Date(now - 30 * 60000).toISOString() },
            message: 'Refactor and add comments'
          },
          stats: { additions: 20, deletions: 10 }
        }
      ];

      const result = detector.analyze(commits, 'legitimate-repo');

      expect(result.score).toBeLessThanOrEqual(10); // Should have minimal or no flags
    });
  });

  describe('printReport', () => {
    it('should print empty report when no suspicious repos', () => {
      const reports = [
        { score: 0, flags: [], repoName: 'clean-repo', commitCount: 3, totalLines: 100 }
      ];
      const since = new Date('2026-02-16');
      const until = new Date('2026-02-20');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      detector.printReport(reports, since, until);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No suspicious activity'));

      consoleSpy.mockRestore();
    });

    it('should print report with suspicious repos', () => {
      const reports = [
        {
          score: 75,
          flags: [
            { type: 'MASS_ACTIVITY', severity: 'high', message: 'Test flag', points: 50 }
          ],
          repoName: 'suspicious-repo',
          commitCount: 5,
          totalLines: 1000
        }
      ];
      const since = new Date('2026-02-16');
      const until = new Date('2026-02-20');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      detector.printReport(reports, since, until);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('SUSPICIOUS ACTIVITY REPORT'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('suspicious-repo'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('git log'));

      consoleSpy.mockRestore();
    });

    it('should include git log command with formatted dates', () => {
      const reports = [
        {
          score: 50,
          flags: [],
          repoName: 'test-repo',
          commitCount: 1,
          totalLines: 500
        }
      ];
      const since = new Date('2026-02-16T10:00:00');
      const until = new Date('2026-02-20T17:00:00');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      detector.printReport(reports, since, until);

      const gitLogCall = consoleSpy.mock.calls.find(call => 
        call[0].includes('git log')
      );
      expect(gitLogCall).toBeDefined();
      expect(gitLogCall[0]).toMatch(/--since/);
      expect(gitLogCall[0]).toMatch(/--until/);

      consoleSpy.mockRestore();
    });

    it('should sort reports by score descending', () => {
      const reports = [
        { score: 30, flags: [], repoName: 'repo1', commitCount: 1, totalLines: 100 },
        { score: 85, flags: [], repoName: 'repo2', commitCount: 1, totalLines: 500 },
        { score: 50, flags: [], repoName: 'repo3', commitCount: 1, totalLines: 300 }
      ];
      const since = new Date('2026-02-16');
      const until = new Date('2026-02-20');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      detector.printReport(reports, since, until);

      const calls = consoleSpy.mock.calls.map(c => c[0]).join('\n');
      const repo2Index = calls.indexOf('repo2');
      const repo3Index = calls.indexOf('repo3');
      const repo1Index = calls.indexOf('repo1');

      expect(repo2Index).toBeLessThan(repo3Index);
      expect(repo3Index).toBeLessThan(repo1Index);

      consoleSpy.mockRestore();
    });
  });
});
