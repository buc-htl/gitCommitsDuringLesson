export default {
  template: `
    <div class="app-container">
      <header class="header">
        <h1>📊 GitHub Commits Analyzer</h1>
        <p class="subtitle">Analyzing commits during configured time windows</p>
      </header>

      <main class="main-content">
        <!-- Status Bar -->
        <div class="status-bar">
          <div class="status-item">
            <span class="label">Organization:</span>
            <span class="value">{{ stats.organization || 'Loading...' }}</span>
          </div>
          <div class="status-item">
            <span class="label">Time Window:</span>
            <span class="value">{{ getTimeWindowDisplay() }}</span>
          </div>
          <div class="status-item">
            <span class="label">Last Update:</span>
            <span class="value">{{ getLastUpdateTime() }}</span>
          </div>
          <div class="status-item">
            <button @click="refreshData" class="btn-refresh">
              🔄 Refresh
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading">
          <p>⏳ Loading data...</p>
        </div>

        <!-- No Data State -->
        <div v-else-if="!stats.repositories || stats.repositories.length === 0" class="no-data">
          <p>📭 No commits found in the current time window</p>
        </div>

        <!-- Statistics Table -->
        <div v-else class="table-container">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th class="text-right">Commits</th>
                <th class="text-right">Lines Changed</th>
                <th class="text-right">Additions</th>
                <th class="text-right">Deletions</th>
                <th class="text-right">Avg Lines/Commit</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="repo in stats.repositories" :key="repo.name" class="repo-row">
                <td class="repo-name">
                  <a :href="repo.url" target="_blank" rel="noopener noreferrer">
                    {{ repo.name }}
                  </a>
                </td>
                <td class="text-right">
                  <span class="badge badge-primary">{{ repo.commitCount }}</span>
                </td>
                <td class="text-right">
                  <span class="badge badge-info">{{ repo.totalLinesChanged }}</span>
                </td>
                <td class="text-right">
                  <span class="badge badge-success">+{{ repo.totalAdditions }}</span>
                </td>
                <td class="text-right">
                  <span class="badge badge-danger">-{{ repo.totalDeletions }}</span>
                </td>
                <td class="text-right">
                  <span class="badge badge-secondary">{{ repo.avgLinesPerCommit }}</span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Summary Footer -->
          <div class="summary-footer">
            <p>
              <strong>Total:</strong>
              {{ totalCommits }} commits |
              {{ totalLinesChanged }} lines changed |
              Across {{ stats.repositories.length }} repositories
            </p>
          </div>
        </div>
      </main>

      <!-- Auto-refresh indicator -->
      <div class="auto-refresh-info">
        Auto-refresh every {{ refreshInterval / 1000 }} seconds
      </div>
    </div>
  `,

  data() {
    return {
      stats: {
        organization: null,
        timeWindow: {},
        lastUpdate: null,
        repositories: []
      },
      loading: true,
      refreshInterval: 30000, // 30 seconds
      refreshTimer: null
    };
  },

  computed: {
    totalCommits() {
      return this.stats.repositories?.reduce((sum, repo) => sum + repo.commitCount, 0) || 0;
    },
    totalLinesChanged() {
      return this.stats.repositories?.reduce((sum, repo) => sum + repo.totalLinesChanged, 0) || 0;
    }
  },

  methods: {
    async fetchStats() {
      try {
        this.loading = true;
        const response = await fetch('/api/stats');
        this.stats = await response.json();
        this.loading = false;
      } catch (error) {
        console.error('Error fetching stats:', error);
        this.loading = false;
      }
    },

    refreshData() {
      console.log('Manual refresh triggered');
      this.fetchStats();
    },

    getTimeWindowDisplay() {
      if (!this.stats.timeWindow) return 'N/A';
      const tw = this.stats.timeWindow;
      return `${tw.day || 'N/A'} ${tw.startTime || ''} - ${tw.endTime || ''}`;
    },

    getLastUpdateTime() {
      if (!this.stats.lastUpdate) return 'N/A';
      const date = new Date(this.stats.lastUpdate);
      return date.toLocaleTimeString('de-DE');
    },

    startAutoRefresh() {
      this.refreshTimer = setInterval(() => {
        this.fetchStats();
      }, this.refreshInterval);
    },

    stopAutoRefresh() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
      }
    }
  },

  mounted() {
    this.fetchStats();
    this.startAutoRefresh();
  },

  beforeUnmount() {
    this.stopAutoRefresh();
  }
};
