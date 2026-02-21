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
                <th @click="sortTable('name')" class="sortable">
                  Repository
                  <span class="sort-indicator" v-if="sortBy === 'name'">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
                </th>
                <th @click="sortTable('commitCount')" class="text-right sortable">
                  Commits
                  <span class="sort-indicator" v-if="sortBy === 'commitCount'">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
                </th>
                <th @click="sortTable('totalLinesChanged')" class="text-right sortable">
                  Lines Changed
                  <span class="sort-indicator" v-if="sortBy === 'totalLinesChanged'">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
                </th>
                <th @click="sortTable('totalAdditions')" class="text-right sortable">
                  Additions
                  <span class="sort-indicator" v-if="sortBy === 'totalAdditions'">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
                </th>
                <th @click="sortTable('totalDeletions')" class="text-right sortable">
                  Deletions
                  <span class="sort-indicator" v-if="sortBy === 'totalDeletions'">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
                </th>
                <th @click="sortTable('avgLinesPerCommit')" class="text-right sortable">
                  Avg Lines/Commit
                  <span class="sort-indicator" v-if="sortBy === 'avgLinesPerCommit'">{{ sortDirection === 'asc' ? '▲' : '▼' }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="repo in sortedRepositories" :key="repo.name" class="repo-row">
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
      refreshTimer: null,
      sortBy: 'name',
      sortDirection: 'asc'
    };
  },

  computed: {
    sortedRepositories() {
      if (!this.stats.repositories) return [];
      const repos = [...this.stats.repositories];
      
      repos.sort((a, b) => {
        let aValue = a[this.sortBy];
        let bValue = b[this.sortBy];
        
        // Handle string comparison (repository name)
        if (typeof aValue === 'string') {
          const comparison = aValue.localeCompare(bValue, undefined, { sensitivity: 'base' });
          return this.sortDirection === 'asc' ? comparison : -comparison;
        }
        
        // Handle numeric comparison
        if (this.sortDirection === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
      
      return repos;
    },
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
    },

    sortTable(column) {
      if (this.sortBy === column) {
        // Toggle direction if same column
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // New column, default to ascending
        this.sortBy = column;
        this.sortDirection = 'asc';
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
