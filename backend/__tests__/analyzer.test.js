import { CommitAnalyzer } from '../services/analyzer.js';

describe('CommitAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new CommitAnalyzer();
  });

  describe('getLastTimeWindow', () => {
    describe('with day names', () => {
      it('should return valid date objects for day names', () => {
        const result = analyzer.getLastTimeWindow('Monday', '10:00', 'Monday', '12:00');
        
        expect(result.since).toBeInstanceOf(Date);
        expect(result.until).toBeInstanceOf(Date);
        expect(result.since < result.until).toBe(true);
      });

      it('should handle multi-day window', () => {
        const result = analyzer.getLastTimeWindow('Monday', '09:00', 'Friday', '17:00');
        
        expect(result.since).toBeDefined();
        expect(result.until).toBeDefined();
        expect(result.since < result.until).toBe(true);
      });

      it('should handle week-spanning window (end time before start time)', () => {
        const result = analyzer.getLastTimeWindow('Monday', '11:00', 'Monday', '09:00');
        
        expect(result.since).toBeDefined();
        expect(result.until).toBeDefined();
        // Should span 7 days
        const daysDiff = (result.until - result.since) / (1000 * 60 * 60 * 24);
        expect(daysDiff).toBeGreaterThan(6);
      });

      it('should be case-insensitive for day names', () => {
        const result1 = analyzer.getLastTimeWindow('Monday', '10:00', 'Friday', '12:00');
        const result2 = analyzer.getLastTimeWindow('monday', '10:00', 'friday', '12:00');
        const result3 = analyzer.getLastTimeWindow('MONDAY', '10:00', 'FRIDAY', '12:00');
        
        expect(result1.since.getTime()).toBe(result2.since.getTime());
        expect(result2.since.getTime()).toBe(result3.since.getTime());
      });
    });

    describe('with specific dates', () => {
      it('should parse specific dates correctly', () => {
        const result = analyzer.getLastTimeWindow('2026-02-16', '10:00', '2026-02-20', '17:00');
        
        expect(result.since).toBeDefined();
        expect(result.until).toBeDefined();
        expect(result.since.getFullYear()).toBe(2026);
        expect(result.since.getMonth()).toBe(1); // February (0-indexed)
        expect(result.since.getDate()).toBe(16);
        expect(result.until.getDate()).toBe(20);
      });

      it('should set correct times with specific dates', () => {
        const result = analyzer.getLastTimeWindow('2026-02-16', '10:30', '2026-02-20', '17:45');
        
        expect(result.since.getHours()).toBe(10);
        expect(result.since.getMinutes()).toBe(30);
        expect(result.until.getHours()).toBe(17);
        expect(result.until.getMinutes()).toBe(45);
      });

      it('should handle same-day specific dates', () => {
        const result = analyzer.getLastTimeWindow('2026-02-16', '09:00', '2026-02-16', '17:00');
        
        expect(result.since.getDate()).toBe(result.until.getDate());
      });
    });

    describe('error handling', () => {
      it('should throw on mixed date and day name formats', () => {
        expect(() => {
          analyzer.getLastTimeWindow('2026-02-16', '10:00', 'Friday', '17:00');
        }).toThrow();
      });
    });
  });

  describe('analyzeCommits', () => {
    it('should calculate stats from commit array', () => {
      const commits = [
        {
          stats: { additions: 10, deletions: 2 }
        },
        {
          stats: { additions: 20, deletions: 5 }
        },
        {
          stats: { additions: 15, deletions: 3 }
        }
      ];

      const stats = analyzer.analyzeCommits(commits);

      expect(stats.commitCount).toBe(3);
      expect(stats.totalAdditions).toBe(45);
      expect(stats.totalDeletions).toBe(10);
      expect(stats.totalLinesChanged).toBe(55);
      expect(stats.avgLinesPerCommit).toBe(18); // 55 / 3 ≈ 18
    });

    it('should handle empty commits array', () => {
      const stats = analyzer.analyzeCommits([]);

      expect(stats.commitCount).toBe(0);
      expect(stats.totalAdditions).toBe(0);
      expect(stats.totalDeletions).toBe(0);
      expect(stats.totalLinesChanged).toBe(0);
      expect(stats.avgLinesPerCommit).toBe(0);
    });

    it('should handle commits without stats', () => {
      const commits = [
        {}, // No stats
        {
          stats: { additions: 10, deletions: 2 }
        }
      ];

      const stats = analyzer.analyzeCommits(commits);

      expect(stats.commitCount).toBe(2);
      expect(stats.totalAdditions).toBe(10);
      expect(stats.totalLinesChanged).toBe(12);
    });

    it('should calculate average lines per commit correctly', () => {
      const commits = [
        { stats: { additions: 100, deletions: 0 } },
        { stats: { additions: 200, deletions: 0 } }
      ];

      const stats = analyzer.analyzeCommits(commits);

      expect(stats.avgLinesPerCommit).toBe(150);
    });

    it('should handle single commit', () => {
      const commits = [
        { stats: { additions: 50, deletions: 10 } }
      ];

      const stats = analyzer.analyzeCommits(commits);

      expect(stats.commitCount).toBe(1);
      expect(stats.totalLinesChanged).toBe(60);
      expect(stats.avgLinesPerCommit).toBe(60);
    });
  });
});
