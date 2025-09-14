const GQL_ENDPOINT = "https://api.github.com/graphql";

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
              repository { nameWithOwner url }
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

export async function fetchProjectsWithStatus(token, org) {
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
  return out;
}

export async function fetchIssueTypes(token, org) {
  const res = await fetch(`https://api.github.com/orgs/${encodeURIComponent(org)}/issue-types`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub REST error: ${res.status}`);
  const data = await res.json();
  return data?.issue_types || data;
}

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
          first: 50,
          after: $after,
          itemTypes: [ASSIGNED_EVENT, UNASSIGNED_EVENT, CLOSED_EVENT, REOPENED_EVENT, LABELED_EVENT, UNLABELED_EVENT, ISSUE_COMMENT]
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
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

export async function fetchIssueWithTimeline(token, owner, repo, number) {
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
  }
  return issue;
}

