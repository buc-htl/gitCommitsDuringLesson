export class SuspiciousActivityDetector {
  constructor() {
    this.thresholds = {
      // Lines per commit
      massCommitLines: 250,
      // Lines per minute between commits
      unrealisticSpeed: 100,
      // Time between commits (seconds)
      rapidFireInterval: 120, // 2 minutes
      // Ratio of additions to deletions
      noCorrectionsRatio: 20,
      // Generic commit messages
      genericMessages: ['update', 'fix', 'done', 'asdf', 'test', 'commit', '.', '..', '...']
    };
  }

  /**
   * Analyze commits for suspicious patterns
   * @param {Array} commits - Array of detailed commit objects
   * @param {string} repoName - Repository name
   * @returns {Object} Suspicious activity report
   */
  analyze(commits, repoName) {
    if (!commits || commits.length === 0) {
      return { score: 0, flags: [], repoName };
    }

    const flags = [];
    let score = 0;

    // Sort commits by date
    const sortedCommits = [...commits].sort((a, b) => 
      new Date(a.commit.author.date) - new Date(b.commit.author.date)
    );

    // Check 1: Mass commit (single commit with too many lines)
    sortedCommits.forEach((commit, idx) => {
      const totalLines = (commit.stats?.additions || 0) + (commit.stats?.deletions || 0);
      if (totalLines > this.thresholds.massCommitLines) {
        flags.push({
          type: 'MASS_COMMIT',
          severity: 'high',
          message: `Commit ${idx + 1}: ${totalLines} lines in single commit`,
          points: 30
        });
        score += 30;
      }
    });

    // Check 2: Only one commit for entire exercise
    if (sortedCommits.length === 1 && sortedCommits[0].stats) {
      const lines = sortedCommits[0].stats.additions || 0;
      if (lines > 50) {
        flags.push({
          type: 'SINGLE_COMMIT',
          severity: 'high',
          message: `Entire exercise (${lines} lines) in single commit`,
          points: 25
        });
        score += 25;
      }
    }

    // Check 3: No corrections (too many additions vs deletions)
    const totalAdditions = sortedCommits.reduce((sum, c) => sum + (c.stats?.additions || 0), 0);
    const totalDeletions = sortedCommits.reduce((sum, c) => sum + (c.stats?.deletions || 0), 0);
    
    if (totalDeletions > 0) {
      const ratio = totalAdditions / totalDeletions;
      if (ratio > this.thresholds.noCorrectionsRatio) {
        flags.push({
          type: 'NO_CORRECTIONS',
          severity: 'medium',
          message: `Ratio ${ratio.toFixed(1)}:1 additions/deletions (no mistakes/refactoring)`,
          points: 15
        });
        score += 15;
      }
    } else if (totalAdditions > 100) {
      // Only additions, no deletions at all
      flags.push({
        type: 'ONLY_ADDITIONS',
        severity: 'medium',
        message: `${totalAdditions} additions, 0 deletions (no corrections)`,
        points: 20
      });
      score += 20;
    }

    // Check 4: Rapid-fire commits (all within short time)
    if (sortedCommits.length >= 2) {
      const firstTime = new Date(sortedCommits[0].commit.author.date);
      const lastTime = new Date(sortedCommits[sortedCommits.length - 1].commit.author.date);
      const durationSeconds = (lastTime - firstTime) / 1000;
      
      if (durationSeconds < this.thresholds.rapidFireInterval && sortedCommits.length >= 3) {
        flags.push({
          type: 'RAPID_FIRE',
          severity: 'medium',
          message: `${sortedCommits.length} commits in ${Math.round(durationSeconds)}s`,
          points: 15
        });
        score += 15;
      }

      // Check unrealistic speed
      for (let i = 1; i < sortedCommits.length; i++) {
        const prev = sortedCommits[i - 1];
        const curr = sortedCommits[i];
        const timeDiff = (new Date(curr.commit.author.date) - new Date(prev.commit.author.date)) / 1000 / 60; // minutes
        const linesDiff = (curr.stats?.additions || 0) + (curr.stats?.deletions || 0);
        
        if (timeDiff > 0) {
          const linesPerMinute = linesDiff / timeDiff;
          if (linesPerMinute > this.thresholds.unrealisticSpeed) {
            flags.push({
              type: 'UNREALISTIC_SPEED',
              severity: 'high',
              message: `${Math.round(linesPerMinute)} lines/min between commits ${i} and ${i + 1}`,
              points: 25
            });
            score += 25;
            break; // Only report once
          }
        }
      }
    }

    // Check 5: Generic/empty commit messages
    let genericCount = 0;
    sortedCommits.forEach((commit) => {
      const msg = (commit.commit.message || '').trim().toLowerCase();
      if (!msg || this.thresholds.genericMessages.includes(msg)) {
        genericCount++;
      }
    });

    if (genericCount > 0 && genericCount === sortedCommits.length) {
      flags.push({
        type: 'GENERIC_MESSAGES',
        severity: 'low',
        message: `All ${genericCount} commit messages are generic/empty`,
        points: 10
      });
      score += 10;
    } else if (genericCount >= sortedCommits.length * 0.7) {
      flags.push({
        type: 'MOSTLY_GENERIC',
        severity: 'low',
        message: `${genericCount}/${sortedCommits.length} commit messages are generic`,
        points: 5
      });
      score += 5;
    }

    return {
      repoName,
      score: Math.min(score, 100), // Cap at 100
      flags,
      commitCount: sortedCommits.length,
      totalLines: totalAdditions + totalDeletions
    };
  }

  /**
   * Print suspicious activity report to console
   * @param {Array} reports - Array of analysis reports
   * @param {Date} since - Start of time window
   * @param {Date} until - End of time window
   */
  printReport(reports, since, until) {
    const suspicious = reports.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    
    if (suspicious.length === 0) {
      console.log('\n✅ No suspicious activity detected.\n');
      return;
    }

    console.log('\n⚠️  SUSPICIOUS ACTIVITY REPORT');
    console.log('═'.repeat(80));
    
    suspicious.forEach(report => {
      const color = report.score >= 50 ? '🔴' : report.score >= 25 ? '🟡' : '🟢';
      console.log(`\n${color} ${report.repoName} (Suspicion Score: ${report.score}/100)`);
      console.log(`   📊 ${report.commitCount} commits, ${report.totalLines} lines changed`);
      
      report.flags.forEach(flag => {
        const severity = flag.severity === 'high' ? '❗' : flag.severity === 'medium' ? '⚠️ ' : 'ℹ️ ';
        console.log(`   ${severity} ${flag.message} (+${flag.points} points)`);
      });
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`📌 Total: ${suspicious.length} repositories flagged for review\n`);
    
    // Format dates for git log command
    const sinceStr = this._formatDateForGit(since);
    const untilStr = this._formatDateForGit(until);
    
    console.log('💡 You can get more details by running the following command in each repository:');
    console.log(`   git log --since="${sinceStr}" --until="${untilStr}" --pretty=format:"%h %ad %s" --date=iso --stat HEAD\n`);
  }

  /**
   * Format Date object for git log command
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  _formatDateForGit(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}
