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

    // Validation: any invalid or misspelled day name must cause an error so tests can assert this behavior.
    if (startDayNumber === undefined || endDayNumber === undefined) {
      throw new Error(`Invalid day name in time window: ${startDay}, ${endDay}`);
    }
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    // Strategy: anchor on the most recent startDay+startTime that is not in the future.
    // This ensures that when today's start time has already passed, the window starts today.
    const currentDayNumber = now.getDay();
    const daysBackToStart = (currentDayNumber - startDayNumber + 7) % 7;

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBackToStart);
    startDate.setHours(startHour, startMin, 0, 0);

    // If today's start time has not happened yet, use previous week's window.
    if (startDate > now) {
      startDate.setDate(startDate.getDate() - 7);
    }

    // Calculate end date based on start date and configured day/time span.
    let daysForwardToEnd = (endDayNumber - startDayNumber + 7) % 7;
    if (daysForwardToEnd === 0 && (endHour < startHour || (endHour === startHour && endMin < startMin))) {
      daysForwardToEnd = 7;
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysForwardToEnd);
    endDate.setHours(endHour, endMin, 0, 0);
    
    return { since: startDate, until: endDate };
  }

  /**
   * Analyze commits and calculate statistics
   * Optionally filter by file extensions
   * @param {Array} commits - Array of commit objects from GitHub API
   * @param {Array} fileExtensions - Optional array of file extensions to include (e.g., ['.java', '.fxml'])
   * @returns {Object} Statistics object with commitCount (total), countedCommits (those with matching changes)
   */
  analyzeCommits(commits, fileExtensions = null) {
    let totalLinesChanged = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;
    const linesPerCommit = [];
    let lastCommitDate = null;

    commits.forEach((commit, index) => {
      // First commit (newest) becomes the last commit date
      if (index === 0 && commit.commit && commit.commit.author && commit.commit.author.date) {
        lastCommitDate = commit.commit.author.date;
      }
      
      // If file extensions are specified, filter by those extensions
      if (fileExtensions && commit.files && commit.files.length > 0) {
        let commitAdditions = 0;
        let commitDeletions = 0;
        
        commit.files.forEach(file => {
          // Check if file matches any of the specified extensions
          const matchesExtension = fileExtensions.some(ext => file.filename.endsWith(ext));
          if (matchesExtension) {
            commitAdditions += file.additions || 0;
            commitDeletions += file.deletions || 0;
          }
        });
        
        if (commitAdditions > 0 || commitDeletions > 0) {
          totalAdditions += commitAdditions;
          totalDeletions += commitDeletions;
          const linesChanged = commitAdditions + commitDeletions;
          totalLinesChanged += linesChanged;
          linesPerCommit.push(linesChanged);
        }
      } else if (!fileExtensions && commit.stats) {
        // Use stats if available (from detailed commit endpoint)
        totalAdditions += commit.stats.additions || 0;
        totalDeletions += commit.stats.deletions || 0;
        const linesChanged = (commit.stats.additions || 0) + (commit.stats.deletions || 0);
        totalLinesChanged += linesChanged;
        linesPerCommit.push(linesChanged);
      }
    });

    // Use only commits that contributed line-change data (after optional extension filtering).
    const avgLinesPerCommit = linesPerCommit.length > 0 
      ? Math.round(totalLinesChanged / linesPerCommit.length) 
      : 0;

    return {
      commitCount: commits.length,
      countedCommits: linesPerCommit.length,
      totalLinesChanged: totalLinesChanged,
      totalAdditions: totalAdditions,
      totalDeletions: totalDeletions,
      avgLinesPerCommit: avgLinesPerCommit,
      linesPerCommit: linesPerCommit,
      lastCommitDate: lastCommitDate
    };
  }
}
