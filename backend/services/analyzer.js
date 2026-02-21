export class CommitAnalyzer {
  /**
   * Calculate time window boundaries for a given day (in LOCAL timezone)
   * @param {string} day - Day of week (e.g. 'monday')
   * @param {string} startTime - Start time in local time (e.g. '10:00')
   * @param {string} endTime - End time in local time (e.g. '12:00')
   * @returns {Object} Object with since and until Date objects (in UTC for GitHub API)
   */
  getLastTimeWindow(day, startTime, endTime) {
    // Get current date in local time
    const now = new Date();
    const currentDayNumber = now.getDay();
    
    const dayMap = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0
    };
    
    const targetDayNumber = dayMap[day.toLowerCase()];
    
    // Calculate days back to get to the last occurrence of target day
    let daysBack = (currentDayNumber - targetDayNumber + 7) % 7;
    
    // If it's the target day but the time window hasn't started yet, go to last week
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    if (daysBack === 0) {
      const targetTimeMs = startHour * 3600000 + startMin * 60000;
      const nowTimeMs = now.getHours() * 3600000 + now.getMinutes() * 60000;
      
      if (nowTimeMs < targetTimeMs) {
        daysBack = 7; // Time window hasn't started yet today, go back a week
      }
    }
    
    // Create the target date (midnight of the target day in local time)
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - daysBack);
    targetDate.setHours(0, 0, 0, 0);
    
    // Create since and until in local time
    const sinceLoc = new Date(targetDate);
    sinceLoc.setHours(startHour, startMin, 0, 0);
    
    const untilLoc = new Date(targetDate);
    untilLoc.setHours(endHour, endMin, 0, 0);
    
    // JavaScript Date.toISOString() automatically converts local time to UTC correctly
    // No need for manual timezone offset adjustment!
    
    return { since: sinceLoc, until: untilLoc };
  }

  /**
   * Analyze commits and calculate statistics
   * @param {Array} commits - Array of commit objects from GitHub API
   * @returns {Object} Statistics object
   */
  analyzeCommits(commits) {
    let totalLinesChanged = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;
    const linesPerCommit = [];

    commits.forEach(commit => {
      const additions = commit.commit?.comment_count || 0; // fallback
      const deletions = commit.commit?.comment_count || 0;
      
      // Use stats if available (from detailed commit endpoint)
      if (commit.stats) {
        totalAdditions += commit.stats.additions || 0;
        totalDeletions += commit.stats.deletions || 0;
        const linesChanged = (commit.stats.additions || 0) + (commit.stats.deletions || 0);
        totalLinesChanged += linesChanged;
        linesPerCommit.push(linesChanged);
      }
    });

    const avgLinesPerCommit = commits.length > 0 
      ? Math.round(totalLinesChanged / commits.length) 
      : 0;

    return {
      commitCount: commits.length,
      totalLinesChanged: totalLinesChanged,
      totalAdditions: totalAdditions,
      totalDeletions: totalDeletions,
      avgLinesPerCommit: avgLinesPerCommit,
      linesPerCommit: linesPerCommit
    };
  }
}
