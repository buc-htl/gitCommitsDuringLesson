export class CommitAnalyzer {
  /**
   * Calculate time window boundaries supporting both day names and specific dates
   * Can accept either (startDay/endDay) or (startDate/endDate) parameters
   * @param {string} startDayOrDate - Start day name (e.g. 'Monday', case-insensitive) or date (e.g. '2026-02-21')
   * @param {string} startTime - Start time in local time (e.g. '10:00')
   * @param {string} endDayOrDate - End day name (e.g. 'Friday', case-insensitive) or date (e.g. '2026-02-25')
   * @param {string} endTime - End time in local time (e.g. '17:00')
   * @returns {Object} Object with since and until Date objects (in UTC for GitHub API)
   */
  getLastTimeWindow(startDayOrDate, startTime, endDayOrDate, endTime) {
    // Check if specific dates are provided (ISO format: YYYY-MM-DD)
    const isStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startDayOrDate);
    const isEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDayOrDate);
    
    if (isStartDate && isEndDate) {
      // Use specific dates
      return this._getTimeWindowFromDates(startDayOrDate, startTime, endDayOrDate, endTime);
    } else if (!isStartDate && !isEndDate) {
      // Use day names
      return this._getTimeWindowFromDayNames(startDayOrDate, startTime, endDayOrDate, endTime);
    } else {
      throw new Error('Time window config must use either both day names or both specific dates, not mixed');
    }
  }

  /**
   * Get time window from specific dates
   * @private
   */
  _getTimeWindowFromDates(startDateStr, startTime, endDateStr, endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startDate = new Date(startDateStr);
    startDate.setHours(startHour, startMin, 0, 0);

    const endDate = new Date(endDateStr);
    endDate.setHours(endHour, endMin, 0, 0);

    return { since: startDate, until: endDate };
  }

  /**
   * Get time window from day names (recurring weekly)
   * Day names are case-insensitive (e.g. 'Monday', 'monday', 'MONDAY' all work)
   * @private
   */
  _getTimeWindowFromDayNames(startDay, startTime, endDay, endTime) {
    const now = new Date();
    
    const dayMap = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0
    };
    
    const startDayNumber = dayMap[startDay.toLowerCase()];
    const endDayNumber = dayMap[endDay.toLowerCase()];
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    // Strategy: Find the most recent occurrence of endDay+endTime that has passed
    // Then calculate the corresponding startDay+startTime
    
    // Find last occurrence of end day/time
    const currentDayNumber = now.getDay();
    let daysBackToEnd = (currentDayNumber - endDayNumber + 7) % 7;
    
    // Create tentative end date
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - daysBackToEnd);
    endDate.setHours(endHour, endMin, 0, 0);
    
    // If end date is in the future, go back one week
    if (endDate > now) {
      daysBackToEnd += 7;
      endDate.setDate(endDate.getDate() - 7);
    }
    
    // Calculate start date based on day difference
    let dayDiff = (endDayNumber - startDayNumber + 7) % 7;
    
    // Handle week-spanning case: if dayDiff is 0 and endTime < startTime
    if (dayDiff === 0 && (endHour < startHour || (endHour === startHour && endMin < startMin))) {
      // Week-spanning window: start is 7 days before end
      dayDiff = 7;
    } else if (dayDiff === 0) {
      // Same day, end >= start: it's a same-day window
      dayDiff = 0;
    }
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - dayDiff);
    startDate.setHours(startHour, startMin, 0, 0);
    
    return { since: startDate, until: endDate };
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
