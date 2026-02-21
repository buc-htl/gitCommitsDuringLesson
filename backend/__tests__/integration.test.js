import { CommitAnalyzer } from '../services/analyzer.js';
import { SuspiciousActivityDetector } from '../services/suspiciousActivityDetector.js';

describe('Integration Tests', () => {
  let analyzer;
  let detector;

  beforeEach(() => {
    analyzer = new CommitAnalyzer();
    detector = new SuspiciousActivityDetector();
  });

  describe('Complete workflow: Time window -> Stats -> Suspicious detection', () => {
    it('should analyze a realistic student assignment scenario', () => {
      // Scenario: Student works on assignment Monday 9:00-11:00
      const since = new Date('2026-02-16T09:00:00Z'); // Monday 09:00
      const until = new Date('2026-02-16T11:00:00Z');  // Monday 11:00

      // Realistic commits spread across 2 hours
      const commits = [
        {
          commit: {
            message: 'Initial project setup',
            author: { name: 'John Doe', date: new Date('2026-02-16T09:05:00Z').toISOString() }
          },
          stats: { additions: 45, deletions: 0 }
        },
        {
          commit: {
            message: 'Implement main function',
            author: { name: 'John Doe', date: new Date('2026-02-16T09:35:00Z').toISOString() }
          },
          stats: { additions: 120, deletions: 10 }
        },
        {
          commit: {
            message: 'Add error handling',
            author: { name: 'John Doe', date: new Date('2026-02-16T10:15:00Z').toISOString() }
          },
          stats: { additions: 80, deletions: 25 }
        },
        {
          commit: {
            message: 'Fix edge case',
            author: { name: 'John Doe', date: new Date('2026-02-16T10:50:00Z').toISOString() }
          },
          stats: { additions: 35, deletions: 15 }
        }
      ];

      const stats = analyzer.analyzeCommits(commits);
      const suspicious = detector.analyze(commits, 'legitimate-assignment');

      // Check stats
      expect(stats.commitCount).toBe(4);
      expect(stats.totalAdditions).toBe(280);
      expect(stats.totalDeletions).toBe(50);
      expect(stats.avgLinesPerCommit).toBe(83);

      // Should not be heavily flagged
      expect(suspicious.score).toBeLessThan(30);
    });

    it('should flag suspicious copy-pasted code pattern', () => {
      // Scenario: All commits in 5 minutes with large changes
      const now = new Date('2026-02-16T10:00:00Z');

      const commits = [
        {
          commit: {
            message: 'upload',
            author: { name: 'Jane Smith', date: new Date(now.getTime() - 4 * 60000).toISOString() }
          },
          stats: { additions: 400, deletions: 20 }
        },
        {
          commit: {
            message: 'fix',
            author: { name: 'Jane Smith', date: new Date(now.getTime() - 3 * 60000).toISOString() }
          },
          stats: { additions: 350, deletions: 25 }
        },
        {
          commit: {
            message: 'done',
            author: { name: 'Jane Smith', date: new Date(now.getTime() - 1 * 60000).toISOString() }
          },
          stats: { additions: 380, deletions: 30 }
        }
      ];

      const suspicious = detector.analyze(commits, 'suspicious-submission');

      // Should be heavily flagged
      expect(suspicious.score).toBeGreaterThan(50);
      expect(suspicious.flags.length).toBeGreaterThan(0);
    });

    it('should handle multi-day time windows correctly', () => {
      const since = new Date('2026-02-16T10:00:00Z'); // Monday 10:00
      const until = new Date('2026-02-20T17:00:00Z');   // Friday 17:00

      // Commits across multiple days
      const commitMon = [{
        commit: { message: 'Start', author: { name: 'Bob', date: new Date('2026-02-16T14:00:00Z').toISOString() } },
        stats: { additions: 80, deletions: 10 }
      }];

      const commitWed = [{
        commit: { message: 'Continue', author: { name: 'Bob', date: new Date('2026-02-18T11:00:00Z').toISOString() } },
        stats: { additions: 120, deletions: 25 }
      }];

      const commitFri = [{
        commit: { message: 'Finish', author: { name: 'Bob', date: new Date('2026-02-20T15:00:00Z').toISOString() } },
        stats: { additions: 100, deletions: 30 }
      }];

      const allCommits = [...commitMon, ...commitWed, ...commitFri];

      const stats = analyzer.analyzeCommits(allCommits);
      const suspicious = detector.analyze(allCommits, 'multi-day-work');

      expect(stats.commitCount).toBe(3);
      expect(stats.totalAdditions).toBe(300);
      expect(suspicious.score).toBeLessThan(20); // Normal progression
    });

    it('should identify all-nighter code session', () => {
      // Scenario: Multiple commits in quick succession over short period
      const startTime = new Date('2026-02-16T23:45:00Z');

      const commits = Array(8).fill(null).map((_, i) => ({
        commit: {
          message: ['fix', 'update', 'tweak', 'adjust', 'modify', 'change', 'improve', 'final'][i],
          author: { name: 'Tired Student', date: new Date(startTime.getTime() + i * 1 * 60000).toISOString() }
        },
        stats: { additions: 80 + i * 10, deletions: 10 + i * 2 }
      }));

      const suspicious = detector.analyze(commits, 'all-nighter');

      expect(suspicious.score).toBeGreaterThan(40);
      expect(suspicious.flags.some(f => f.type === 'MASS_ACTIVITY' || f.type === 'RAPID_FIRE')).toBe(true);
    });

    it('should detect code that was never corrected', () => {
      const commits = [
        {
          commit: { message: 'Initial solution', author: { name: 'Careless', date: new Date().toISOString() } },
          stats: { additions: 500, deletions: 2 } // Almost no deletions
        }
      ];

      const suspicious = detector.analyze(commits, 'no-corrections');

      expect(suspicious.flags.some(f => 
        f.type === 'NO_CORRECTIONS' || f.type === 'ONLY_ADDITIONS'
      )).toBe(true);
    });

    it('should handle the full analysis pipeline with edge cases', () => {
      // Multiple repos in batch
      const repos = [
        {
          name: 'repo1',
          commits: [
            {
              commit: { message: 'Real work', author: { name: 'Student', date: new Date().toISOString() } },
              stats: { additions: 100, deletions: 20 }
            }
          ]
        },
        {
          name: 'repo2',
          commits: [
            {
              commit: { message: 'Bulk upload', author: { name: 'Student', date: new Date().toISOString() } },
              stats: { additions: 1000, deletions: 50 }
            }
          ]
        },
        {
          name: 'repo3',
          commits: [] // Empty repo
        }
      ];

      const results = repos.map(repo => ({
        name: repo.name,
        stats: analyzer.analyzeCommits(repo.commits),
        suspicious: detector.analyze(repo.commits, repo.name)
      }));

      // Validate results
      expect(results).toHaveLength(3);
      expect(results[0].stats.commitCount).toBe(1);
      expect(results[1].suspicious.score).toBeGreaterThan(results[0].suspicious.score);
      expect(results[2].stats.commitCount).toBe(0);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle exactly at threshold values', () => {
      // Exactly 500 lines (mass commit threshold)
      const commits = [{
        commit: { message: 'test', author: { name: 'Test', date: new Date().toISOString() } },
        stats: { additions: 500, deletions: 0 }
      }];

      const suspicious = detector.analyze(commits, 'threshold-test');

      expect(suspicious.score).toBeGreaterThan(0);
    });

    it('should handle just below threshold values', () => {
      // Just below 300 lines
      const commits = [
        {
          commit: { message: 'Initial commit', author: { name: 'Test', date: new Date().toISOString() } },
          stats: { additions: 150, deletions: 20 }
        },
        {
          commit: { message: 'Add feature', author: { name: 'Test', date: new Date().toISOString() } },
          stats: { additions: 120, deletions: 9 }
        }
      ];

      const suspicious = detector.analyze(commits, 'below-threshold');

      expect(suspicious.score).toBe(0);
    });

    it('should calculate average correctly with varying commit sizes', () => {
      const commits = [
        { stats: { additions: 10, deletions: 0 } },
        { stats: { additions: 100, deletions: 0 } },
        { stats: { additions: 200, deletions: 0 } }
      ];

      const stats = analyzer.analyzeCommits(commits);

      expect(stats.avgLinesPerCommit).toBe(103); // (10 + 100 + 200) / 3
    });
  });

  describe('Realistic academic scenarios', () => {
    it('should analyze a typical homework submission', () => {
      const since = new Date('2026-02-16T10:00:00Z');
      const until = new Date('2026-02-16T12:00:00Z');

      const homeworkCommits = [
        {
          commit: { 
            message: 'Add basic structure', 
            author: { name: 'Student A', date: new Date('2026-02-16T10:15:00Z').toISOString() } 
          },
          stats: { additions: 50, deletions: 0 }
        },
        {
          commit: { 
            message: 'Implement main logic', 
            author: { name: 'Student A', date: new Date('2026-02-16T11:00:00Z').toISOString() } 
          },
          stats: { additions: 120, deletions: 15 }
        },
        {
          commit: { 
            message: 'Add unit tests', 
            author: { name: 'Student A', date: new Date('2026-02-16T11:45:00Z').toISOString() } 
          },
          stats: { additions: 90, deletions: 5 }
        }
      ];

      const stats = analyzer.analyzeCommits(homeworkCommits);
      const suspicious = detector.analyze(homeworkCommits, 'homework');

      expect(stats.commitCount).toBe(3);
      expect(stats.totalLinesChanged).toBe(280);
      expect(suspicious.score).toBeLessThan(15);
    });

    it('should analyze a group project submission', () => {
      const groupCommits = [
        {
          commit: { 
            message: 'Setup project scaffold', 
            author: { name: 'Alice', date: new Date('2026-02-16T09:00:00Z').toISOString() } 
          },
          stats: { additions: 30, deletions: 0 }
        },
        {
          commit: { 
            message: 'Add authentication module', 
            author: { name: 'Bob', date: new Date('2026-02-16T10:30:00Z').toISOString() } 
          },
          stats: { additions: 180, deletions: 10 }
        },
        {
          commit: { 
            message: 'Add database layer', 
            author: { name: 'Charlie', date: new Date('2026-02-16T11:15:00Z').toISOString() } 
          },
          stats: { additions: 220, deletions: 20 }
        }
      ];

      const stats = analyzer.analyzeCommits(groupCommits);

      expect(stats.commitCount).toBe(3);
      expect(stats.totalAdditions).toBe(430);
      expect(stats.totalLinesChanged).toBe(460);
    });
  });
});
