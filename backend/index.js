import express from 'express';
import cron from 'node-cron';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import readline from 'readline/promises';
import { GitHubService } from './services/github.js';
import { CommitAnalyzer } from './services/analyzer.js';
import { SuspiciousActivityDetector } from './services/suspiciousActivityDetector.js';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to parse JSONC (JSON with Comments)
function parseJSONWithComments(jsonString) {
  // Remove single-line comments
  let result = jsonString.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove trailing commas before } and ]
  result = result.replace(/,\s*([\]}])/g, '$1');
  return JSON.parse(result);
}

const app = express();
const PORT = 3000;

// Store current statistics
let currentStats = {
  organization: null,
  lastUpdate: null,
  repositories: []
};

// Load configuration
let config;
try {
  const configPath = join(__dirname, 'config.jsonc');
  const configContent = readFileSync(configPath, 'utf-8');
  config = parseJSONWithComments(configContent);
} catch (error) {
  console.error('Error loading config.jsonc:', error.message);
  process.exit(1);
}

// Initialize services
const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error('❌ Error: GITHUB_TOKEN not found in .env file');
  process.exit(1);
}

const githubService = new GitHubService(githubToken);
const analyzer = new CommitAnalyzer();
const suspiciousDetector = new SuspiciousActivityDetector();

// Middleware
app.use(express.static(join(__dirname, '../frontend')));
app.use(express.json());

// API Routes
app.get('/api/stats', (req, res) => {
  res.json(currentStats);
});

app.get('/api/config', (req, res) => {
  res.json({
    organizations: config.organizations.map(org => ({
      name: org.name,
      timeWindows: org.timeWindows
    }))
  });
});

// Main analysis function
async function analyzeOrganization(organization) {
  console.log(`\n📊 Analyzing organization: ${organization.name}`);
  
  const timeWindow = organization.timeWindows[0];
  
  // Build display text supporting both day names and specific dates
  let timeWindowDisplay;
  if (timeWindow.startDate && timeWindow.endDate) {
    // Using specific dates
    timeWindowDisplay = timeWindow.startDate === timeWindow.endDate 
      ? `${timeWindow.startDate} ${timeWindow.startTime} - ${timeWindow.endTime}`
      : `${timeWindow.startDate} ${timeWindow.startTime} - ${timeWindow.endDate} ${timeWindow.endTime}`;
    console.log(`⏰ Time window: ${timeWindowDisplay}`);
  } else if (timeWindow.startDay && timeWindow.endDay) {
    // Using day names
    timeWindowDisplay = timeWindow.startDay === timeWindow.endDay 
      ? `${timeWindow.startDay} ${timeWindow.startTime} - ${timeWindow.endTime}`
      : `${timeWindow.startDay} ${timeWindow.startTime} - ${timeWindow.endDay} ${timeWindow.endTime}`;
    console.log(`⏰ Time window: ${timeWindowDisplay}`);
  }
  
  // Determine which fields to pass to analyzer
  const startParam = timeWindow.startDate || timeWindow.startDay;
  const endParam = timeWindow.endDate || timeWindow.endDay;
  
  const { since, until } = analyzer.getLastTimeWindow(
    startParam,
    timeWindow.startTime,
    endParam,
    timeWindow.endTime
  );
  

  try {
    // Get all repositories
    const repos = await githubService.getOrgRepositories(organization.name);
    console.log(`✅ Found ${repos.length} repositories`);

    const repoStats = [];
    const repoCommitsMap = new Map(); // Store commits for suspicious activity analysis

    // Analyze each repository
    for (const repo of repos) {
      process.stdout.write(`  📦 ${repo.name}... `);
      
      const commits = await githubService.getRepositoryCommits(
        organization.name,
        repo.name,
        since,
        until
      );

      // Filter out commits from ignored committers
      let filteredCommits = commits;
      if (organization.ignoreCommitters && organization.ignoreCommitters.length > 0) {
        const ignoreList = organization.ignoreCommitters.map(name => name.toLowerCase());
        filteredCommits = commits.filter(commit => 
          !ignoreList.includes((commit.commit.author.name || '').toLowerCase())
        );
      }

      if (filteredCommits.length === 0) {
        console.log(`✓ 0 commits`);
        continue;
      }

      // Get detailed stats for each commit
      let detailedCommits = [];
      if (filteredCommits.length > 0) {
        for (const commit of filteredCommits) {
          const details = await githubService.getCommitDetails(
            organization.name,
            repo.name,
            commit.sha
          );
          if (details) {
            detailedCommits.push(details);
          }
        }
      }

      const stats = analyzer.analyzeCommits(detailedCommits);
      
      // Store commits for suspicious activity analysis
      if (detailedCommits.length > 0) {
        repoCommitsMap.set(repo.name, detailedCommits);
      }
      
      // Debug: Show each commit with timestamp and message (if enabled in config)
      if (config.debugCommits && detailedCommits.length > 0) {
        console.log(`\n    [COMMITS in ${repo.name}]`);
        detailedCommits.forEach((commit, idx) => {
          const sha = commit.sha.substring(0, 7);
          const timestamp = commit.commit.author.date;
          const fullMessage = commit.commit.message;
          const author = commit.commit.author.name;
          console.log(`      ${idx + 1}. [${sha}] ${timestamp} | ${author}`);
          console.log(`         Message: ${fullMessage}`);
        });
      }
      
      repoStats.push({
        name: repo.name,
        url: repo.html_url,
        ...stats
      });

      console.log(`✓ ${stats.commitCount} commits, ${stats.totalLinesChanged} lines changed`);
    }

    // Update global state
    currentStats = {
      organization: organization.name,
      timeWindow: {
        ...timeWindow,
        since: since.toISOString(),
        until: until.toISOString()
      },
      lastUpdate: new Date().toISOString(),
      repositories: repoStats
    };

    const reposWithCommits = repoStats.filter(r => r.commitCount > 0).length;
    console.log(`\n✨ Analysis complete! ${repos.length} repositories processed, ${reposWithCommits} with commits in time window.\n`);
    
    // Detect suspicious activity if enabled
    if (config.detectSuspiciousActivity && repoCommitsMap.size > 0) {
      const reports = [];
      for (const [repoName, commits] of repoCommitsMap) {
        reports.push(suspiciousDetector.analyze(commits, repoName));
      }
      suspiciousDetector.printReport(reports, since, until);
    }
  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
  }
}

// Prompt user to select an organization
async function selectOrganization() {
  if (config.organizations.length === 0) {
    console.error('❌ No organizations configured in config.jsonc');
    process.exit(1);
  }

  if (config.organizations.length === 1) {
    return config.organizations[0];
  }

  console.log('\n📋 Available organizations:');
  config.organizations.forEach((org, index) => {
    const tw = org.timeWindows[0];
    // Build display text supporting both day names and specific dates
    let timeWindowDisplay;
    if (tw.startDate && tw.endDate) {
      timeWindowDisplay = tw.startDate === tw.endDate 
        ? `${tw.startDate} ${tw.startTime}-${tw.endTime}`
        : `${tw.startDate} ${tw.startTime}-${tw.endDate} ${tw.endTime}`;
    } else if (tw.startDay && tw.endDay) {
      timeWindowDisplay = tw.startDay === tw.endDay 
        ? `${tw.startDay} ${tw.startTime}-${tw.endTime}`
        : `${tw.startDay} ${tw.startTime}-${tw.endDay} ${tw.endTime}`;
    } else {
      timeWindowDisplay = 'N/A';
    }
    console.log(`  ${index + 1}. ${org.name} (${timeWindowDisplay})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let selectedOrg = null;
  while (!selectedOrg) {
    const answer = await rl.question('\n🔢 Select organization number: ');
    const num = parseInt(answer.trim());
    
    if (num >= 1 && num <= config.organizations.length) {
      selectedOrg = config.organizations[num - 1];
      console.log(`✅ Selected: ${selectedOrg.name}\n`);
    } else {
      console.log(`❌ Invalid selection. Please enter a number between 1 and ${config.organizations.length}`);
    }
  }

  rl.close();
  return selectedOrg;
}

// Schedule periodic analysis
async function scheduleAnalysis() {
  const org = await selectOrganization();
  
  // Initial run
  console.log('🚀 Starting initial analysis...');
  analyzeOrganization(org);

  // Schedule recurring analysis
  console.log(`⏱️  Scheduling recurring analysis with cron: "${config.checkInterval}"`);
  cron.schedule(config.checkInterval, () => {
    analyzeOrganization(org);
  });
}

// Start server
app.listen(PORT, async () => {
  console.log(`\n🌐 Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api/stats\n`);
  await scheduleAnalysis();
});
