const GQL_ENDPOINT = "https://api.github.com/graphql";
import { getWithTTL, setWithTTL, cacheGetEntry, isFresh } from "../cache/cache";

export async function githubGraphQL(token, query, variables = {}) {
  const res = await fetch(GQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL error: ${res.status}`);
  const data = await res.json();
  if (data.errors) {
    const msg = data.errors.map((e) => e.message).join("; ");
    throw new Error(msg || "Unknown GraphQL error");
  }
  return data.data;
}

export const ORG_REPOS_ISSUES = `
  query OrgReposIssues($org: String!, $after: String) {
    organization(login: $org) {
      name
      url
      repositories(first: 30, after: $after, orderBy: {field: PUSHED_AT, direction: DESC}) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          name
          nameWithOwner
          url
          assignableUsers(first: 30) {
            nodes {
              id
              login
              avatarUrl
              url
            }
          }
          labels(first: 50) {
            nodes {
              id
              name
              description
              color
            }
          }
          milestones(first: 30, states: [OPEN]) {
            nodes {
              id
              title
              description
              dueOn
              state
              url
            }
          }
          projects(first: 20, states: [OPEN]) {
            nodes {
              id
              name
              number
            }
          }
          projectsV2(first: 20) {
            nodes {
              id
              title
              number
              url
            }
          }
          issues(first: 100, orderBy: {field: UPDATED_AT, direction: DESC}, states: [OPEN, CLOSED]) {
            nodes {
              id
              number
              title
              body
              url
              state
              createdAt
              closedAt
              repository { id nameWithOwner url }
              assignees(first: 10) { nodes { login avatarUrl url } }
              labels(first: 20) { nodes { id name color } }
              milestone { id title url dueOn description }
              issueType { id name color }
            }
          }
        }
      }
    }
  }
`;

export const ORG_PROJECTS = `
  query OrgProjects($org: String!, $after: String) {
    organization(login: $org) {
      projectsV2(first: 20, after: $after) {
        nodes { id number title url }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export const PROJECT_ITEMS = `
  query ProjectItems($pid: ID!, $after: String) {
    node(id: $pid) {
      ... on ProjectV2 {
        number
        title
        url
        items(first: 100, after: $after) {
          nodes {
            content {
              __typename
              ... on Issue {
                id
                number
                title
                url
                state
                createdAt
                repository { nameWithOwner }
                issueType { id name color }
              }
            }
            id
            fieldValues(first: 20) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    __typename
                    ... on ProjectV2SingleSelectField { name }
                  }
                }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
        fields(first: 20) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchProjectsWithStatus(token, org, options = {}) {
  const { swr = false, onUpdate } = options;
  const cacheKey = `projects:${org}`;
  if (swr) {
    const entry = await cacheGetEntry(cacheKey);
    if (entry) {
      // trigger background refresh
      setTimeout(async () => {
        try {
          const fresh = await fetchProjectsWithStatus(token, org);
          onUpdate && onUpdate(fresh);
        } catch {}
      }, 0);
      return entry.value;
    }
  } else {
    const cached = await getWithTTL(cacheKey);
    if (cached) return cached;
  }
  let projects = [];
  let cursor = null;
  while (true) {
    const data = await githubGraphQL(token, ORG_PROJECTS, { org, after: cursor });
    const nodes = data.organization?.projectsV2?.nodes || [];
    projects = projects.concat(nodes);
    if (!data.organization?.projectsV2?.pageInfo?.hasNextPage) break;
    cursor = data.organization.projectsV2.pageInfo.endCursor;
  }

  const out = [];
  for (const proj of projects) {
    let items = [];
    let after = null;
    let statusFieldId = null;
    let statusOptions = {};
    while (true) {
      const data = await githubGraphQL(token, PROJECT_ITEMS, { pid: proj.id, after });
      const node = data.node;
      if (!statusFieldId) {
        const fields = node?.fields?.nodes || [];
        const statusField = fields.find(f => (f.name || '').toLowerCase() === 'status');
        if (statusField) {
          statusFieldId = statusField.id;
          statusOptions = Object.fromEntries((statusField.options || []).map(o => [o.name, o.id]));
        }
      }
      const nodes = node?.items?.nodes || [];
      const rows = nodes
        .map((item) => {
          const issue = item.content;
          if (!issue || issue.__typename !== "Issue") return null;
          const status = (item.fieldValues?.nodes || [])
            .filter((f) => f.__typename === "ProjectV2ItemFieldSingleSelectValue")
            .map((f) => {
              const fname = (f.field?.name || "").toLowerCase();
              return fname === "status" ? f.name : null;
            })
            .find(Boolean) || null;
          return {
            id: issue.id,
            number: issue.number,
            title: issue.title,
            url: issue.url,
            state: issue.state,
            createdAt: issue.createdAt,
            repository: issue.repository?.nameWithOwner || "",
            project_status: status,
            issueType: issue.issueType || null,
            project_item_id: item.id,
          };
        })
        .filter(Boolean);
      items = items.concat(rows);
      if (!node?.items?.pageInfo?.hasNextPage) break;
      after = node.items.pageInfo.endCursor;
    }
    out.push({ id: proj.id, number: proj.number, title: proj.title, url: proj.url, issues: items, statusFieldId, statusOptions });
  }
  await setWithTTL(cacheKey, out, 10 * 60 * 1000); // 10 minutes
  return out;
}

export async function fetchIssueTypes(token, org, options = {}) {
  const { swr = false, onUpdate } = options;
  const cacheKey = `issueTypes:${org}`;
  if (swr) {
    const entry = await cacheGetEntry(cacheKey);
    if (entry) {
      setTimeout(async () => {
        try {
          const fresh = await fetchIssueTypes(token, org);
          onUpdate && onUpdate(fresh);
        } catch {}
      }, 0);
      return entry.value;
    }
  } else {
    const cached = await getWithTTL(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(`https://api.github.com/orgs/${encodeURIComponent(org)}/issue-types`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub REST error: ${res.status}`);
  const data = await res.json();
  const out = data?.issue_types || data;
  await setWithTTL(cacheKey, out, 24 * 60 * 60 * 1000); // 24 hours
  return out;
}

const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($input: CreateIssueInput!) {
    createIssue(input: $input) {
      issue {
        id
        number
        title
        body
        url
        state
        createdAt
        closedAt
        repository { id nameWithOwner url }
        assignees(first: 10) { nodes { login avatarUrl url } }
        labels(first: 20) { nodes { id name color } }
        milestone { id title url dueOn description }
        issueType { id name color }
      }
    }
  }
`;

const ADD_PROJECT_V2_ITEM = `
  mutation AddProjectV2Item($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item { id }
    }
  }
`;

export const ISSUE_WITH_TIMELINE = `
  query IssueWithTimeline($owner: String!, $name: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        id
        number
        title
        body
        url
        state
        createdAt
        closedAt
        repository { nameWithOwner url }
        assignees(first: 10) { nodes { login avatarUrl url } }
        labels(first: 20) { nodes { id name color } }
        milestone { id title url dueOn description }
        issueType { id name color }
        timelineItems(
          first: 100,
          after: $after
        ) {
          nodes {
            __typename
            ... on ClosedEvent { createdAt actor { login avatarUrl url } }
            ... on ReopenedEvent { createdAt actor { login avatarUrl url } }
            ... on LabeledEvent { createdAt actor { login avatarUrl url } label { name color } }
            ... on UnlabeledEvent { createdAt actor { login avatarUrl url } label { name color } }
            ... on AssignedEvent { createdAt actor { login avatarUrl url } assignee { ... on User { login avatarUrl url } } }
            ... on UnassignedEvent { createdAt actor { login avatarUrl url } assignee { ... on User { login avatarUrl url } } }
            ... on IssueComment { id createdAt author { login avatarUrl url } body }
            ... on CrossReferencedEvent {
              createdAt
              actor { login avatarUrl url }
              willCloseTarget
              source {
                __typename
                ... on PullRequest {
                  number
                  title
                  url
                  merged
                  mergedAt
                  author { login avatarUrl url }
                  repository { nameWithOwner }
                }
              }
            }
            ... on MilestonedEvent { createdAt actor { login avatarUrl url } milestoneTitle }
            ... on DemilestonedEvent { createdAt actor { login avatarUrl url } milestoneTitle }
            ... on AddedToProjectEvent { createdAt actor { login avatarUrl url } project { name } }
            ... on RemovedFromProjectEvent { createdAt actor { login avatarUrl url } project { name } }
            ... on MovedColumnsInProjectEvent { createdAt actor { login avatarUrl url } project { name } previousProjectColumnName projectColumnName }
            ... on RenamedTitleEvent { createdAt actor { login avatarUrl url } previousTitle currentTitle }
            ... on ConvertedNoteToIssueEvent { createdAt actor { login avatarUrl url } }
            ... on MarkedAsDuplicateEvent { createdAt actor { login avatarUrl url } }
            ... on UnmarkedAsDuplicateEvent { createdAt actor { login avatarUrl url } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

export async function fetchIssueWithTimeline(token, owner, repo, number, options = {}) {
  const { swr = false, onUpdate } = options;
  const cacheKey = `issue:${owner}/${repo}#${number}`;
  if (swr) {
    const entry = await cacheGetEntry(cacheKey);
    if (entry) {
      setTimeout(async () => {
        try {
          const fresh = await fetchIssueWithTimeline(token, owner, repo, number);
          onUpdate && onUpdate(fresh);
        } catch {}
      }, 0);
      return entry.value;
    }
  } else {
    const cached = await getWithTTL(cacheKey);
    if (cached) return cached;
  }
  let after = null;
  let issue = null;
  let timeline = [];
  while (true) {
    const data = await githubGraphQL(token, ISSUE_WITH_TIMELINE, { owner, name: repo, number, after });
    const node = data?.repository?.issue;
    if (!node) break;
    if (!issue) {
      issue = { ...node };
      delete issue.timelineItems;
      // Normalize nested connection fields to plain arrays
      issue.assignees = issue.assignees?.nodes || [];
      issue.labels = issue.labels?.nodes || [];
    }
    const nodes = node.timelineItems?.nodes || [];
    timeline = timeline.concat(nodes);
    if (!node.timelineItems?.pageInfo?.hasNextPage) break;
    after = node.timelineItems.pageInfo.endCursor;
  }
  if (issue) {
    issue.timelineItems = timeline;
    await setWithTTL(cacheKey, issue, 24 * 60 * 60 * 1000); // 24 hours
  }
  return issue;
}

export async function createIssue(token, payload) {
  const {
    repositoryId,
    title,
    body,
    assigneeIds = [],
    labelIds = [],
    milestoneId,
    projectIds = [],
    issueTypeId,
    projectV2Ids = [],
  } = payload || {};

  if (!repositoryId) {
    throw new Error("Repository is required");
  }
  if (!title) {
    throw new Error("Title is required");
  }

  const input = {
    repositoryId,
    title,
  };
  if (body) input.body = body;
  if (assigneeIds.length) input.assigneeIds = assigneeIds;
  if (labelIds.length) input.labelIds = labelIds;
  if (milestoneId) input.milestoneId = milestoneId;
  if (projectIds.length) input.projectIds = projectIds;
  if (issueTypeId) input.issueTypeId = issueTypeId;

  const data = await githubGraphQL(token, CREATE_ISSUE_MUTATION, { input });
  const issueNode = data?.createIssue?.issue;
  if (!issueNode) {
    throw new Error("Failed to create issue");
  }
  const issue = {
    ...issueNode,
    assignees: issueNode.assignees?.nodes || [],
    labels: issueNode.labels?.nodes || [],
    repositoryId: repositoryId,
  };

  const projectV2Items = {};
  for (const projectId of projectV2Ids || []) {
    const added = await githubGraphQL(token, ADD_PROJECT_V2_ITEM, {
      projectId,
      contentId: issue.id,
    });
    const itemId = added?.addProjectV2ItemById?.item?.id || null;
    projectV2Items[projectId] = itemId;
  }

  return { issue, projectV2Items };
}

// Aggregate org repos + issues with caching
export async function fetchOrgReposIssues(token, org, options = {}) {
  const { swr = false, onUpdate } = options;
  const cacheKey = `orgReposIssues:${org}`;
  if (swr) {
    const entry = await cacheGetEntry(cacheKey);
    if (entry) {
      setTimeout(async () => {
        try {
          const fresh = await fetchOrgReposIssues(token, org);
          onUpdate && onUpdate(fresh);
        } catch {}
      }, 0);
      return entry.value;
    }
  } else {
    const cached = await getWithTTL(cacheKey);
    if (cached) return cached;
  }
  let allRepos = [];
  let cursor = null;
  for (let page = 0; page < 4; page++) { // up to ~120 repos (4 * 30)
    const data = await githubGraphQL(token, ORG_REPOS_ISSUES, { org, after: cursor });
    const orgNode = data.organization;
    if (!orgNode) throw new Error("Organization not found or access denied.");
    const nodes = orgNode.repositories.nodes || [];
    allRepos = allRepos.concat(nodes.map(n => ({
      id: n.id,
      name: n.name,
      url: n.url,
      nameWithOwner: n.nameWithOwner,
      assignableUsers: (n.assignableUsers?.nodes || []).map(u => ({
        id: u.id,
        login: u.login,
        avatarUrl: u.avatarUrl,
        url: u.url,
      })),
      availableLabels: (n.labels?.nodes || []).map(l => ({
        id: l.id,
        name: l.name,
        description: l.description,
        color: l.color,
      })),
      availableMilestones: (n.milestones?.nodes || []).map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        dueOn: m.dueOn,
        state: m.state,
        url: m.url,
      })),
      availableProjects: (n.projects?.nodes || []).map(p => ({
        id: p.id,
        name: p.name,
        number: p.number,
      })),
      availableProjectsV2: (n.projectsV2?.nodes || []).map(p => ({
        id: p.id,
        title: p.title,
        number: p.number,
        url: p.url,
      })),
      issues: (n.issues?.nodes || []).map(i => ({
        id: i.id,
        number: i.number,
        title: i.title,
        body: i.body,
        url: i.url,
        state: i.state,
        createdAt: i.createdAt,
        closedAt: i.closedAt,
        repositoryId: n.id,
        repository: i.repository,
        assignees: i.assignees?.nodes || [],
        labels: i.labels?.nodes || [],
        milestone: i.milestone || null,
        issueType: i.issueType || null,
      }))
    })));
    if (!orgNode.repositories.pageInfo.hasNextPage) break;
    cursor = orgNode.repositories.pageInfo.endCursor;
  }
  await setWithTTL(cacheKey, allRepos, 10 * 60 * 1000); // 10 minutes
  return allRepos;
}
