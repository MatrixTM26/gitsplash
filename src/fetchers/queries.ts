// ============================================================
// GitHub GraphQL Queries
// ============================================================

export const USER_QUERY = `
  query GetUser($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      name
      avatarUrl
      bio
      company
      location
      email
      websiteUrl
      twitterUsername
      createdAt
      updatedAt
      followers { totalCount }
      following { totalCount }
      repositories(
        ownerAffiliations: [OWNER]
        privacy: PUBLIC
      ) {
        totalCount
        totalDiskUsage
      }
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          colors
          weeks {
            firstDay
            contributionDays {
              contributionCount
              contributionLevel
              date
              color
            }
          }
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            name
            nameWithOwner
            primaryLanguage {
              name
              color
            }
          }
          contributions { totalCount }
        }
      }
      organizations(first: 20) {
        totalCount
        nodes {
          login
          name
          avatarUrl
          description
          url
        }
      }
    }
  }
`;

export const REPOS_QUERY = `
  query GetRepos($login: String!, $after: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $after
        ownerAffiliations: [OWNER]
        orderBy: { field: PUSHED_AT, direction: DESC }
        isFork: false
      ) {
        nodes {
          name
          nameWithOwner
          description
          url
          isPrivate
          isFork
          stargazerCount
          forkCount
          createdAt
          updatedAt
          pushedAt
          primaryLanguage {
            name
            color
          }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            totalSize
            edges {
              size
              node {
                name
                color
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

export const REPO_CONTRIBUTORS_QUERY = `
  query GetContributors($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      collaborators(first: 10, affiliation: ALL) {
        totalCount
        edges {
          permission
          node {
            login
            name
            avatarUrl
            url
          }
        }
      }
    }
  }
`;

export const ALL_YEARS_QUERY = `
  query GetAllYears($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionYears
      }
    }
  }
`;

export const YEAR_CONTRIBUTIONS_QUERY = `
  query GetYearContributions($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;

export const ORG_DETAILS_QUERY = `
  query GetOrgDetails($login: String!) {
    organization(login: $login) {
      login
      name
      avatarUrl
      description
      url
      membersWithRole { totalCount }
      repositories(privacy: PUBLIC) { totalCount }
    }
  }
`;

// Fetch orgs the user is following (via following endpoint - REST only)
// Also fetch detailed org info including avatarUrl for rendering
export const ORG_AVATAR_QUERY = `
  query GetOrgAvatar($login: String!) {
    organization(login: $login) {
      login
      name
      avatarUrl
      description
      url
      membersWithRole { totalCount }
      repositories(privacy: PUBLIC) { totalCount }
    }
  }
`;
