import axios from 'axios';

export class GitHubService {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://api.github.com';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
  }

  async getOrgRepositories(org) {
    try {
      let allRepos = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.client.get(`/orgs/${org}/repos`, {
          params: {
            per_page: 100,
            page: page,
            sort: 'updated',
            direction: 'desc'
          }
        });

        if (response.data.length === 0) {
          hasMore = false;
        } else {
          allRepos = allRepos.concat(response.data);
          // If we got less than 100, we've reached the last page
          if (response.data.length < 100) {
            hasMore = false;
          }
          page++;
        }
      }

      return allRepos;
    } catch (error) {
      console.error(`Error fetching repos for org ${org}:`, error.message);
      return [];
    }
  }

  async getRepositoryCommits(owner, repo, since, until) {
    try {
      let allCommits = [];
      let page = 1;
      let hasMore = true;
      const sinceMs = since.getTime();
      const untilMs = until.getTime();

      while (hasMore) {
        const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
          params: {
            since: since.toISOString(),
            until: until.toISOString(),
            per_page: 100,
            page: page
          }
        });

        if (response.data.length === 0) {
          hasMore = false;
        } else {
          // Filter commits to only include those actually within the time window
          const filtered = response.data.filter(commit => {
            const commitTime = new Date(commit.commit.author.date).getTime();
            return commitTime >= sinceMs && commitTime <= untilMs;
          });
          
          allCommits = allCommits.concat(filtered);
          
          // Stop if we got fewer than 100 results (last page)
          // or if we've gone past the time window (commits are ordered newest first)
          if (response.data.length < 100) {
            hasMore = false;
          } else {
            // Check if the oldest commit on this page is before our window
            const oldestCommitTime = new Date(response.data[response.data.length - 1].commit.author.date).getTime();
            if (oldestCommitTime < sinceMs) {
              hasMore = false;
            } else {
              page++;
            }
          }
        }
      }

      return allCommits;
    } catch (error) {
      console.error(`Error fetching commits for ${owner}/${repo}:`, error.message);
      return [];
    }
  }

  async getCommitDetails(owner, repo, sha) {
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/commits/${sha}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching commit details for ${sha}:`, error.message);
      return null;
    }
  }
}
