const GQL_ENDPOINT = "https://api.github.com/graphql";
import YAML from "yaml";
import { getWithTTL, setWithTTL, cacheGetEntry, isFresh } from "../cache/cache";

const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_ACCEPT_HEADER = "application/vnd.github+json";

const githubRestHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: GITHUB_ACCEPT_HEADER,
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
});

const decodeBase64 = (value) => {
  if (!value) return "";
  const globalObj = typeof globalThis !== "undefined" ? globalThis : {};

  const decodeWithAtob = () => {
    if (typeof globalObj.atob !== "function") return null;
    let binary = "";
    try {
      binary = globalObj.atob(value);
    } catch {
      return null;
    }
    try {
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      if (typeof TextDecoder === "function") {
        return new TextDecoder("utf-8").decode(bytes);
      }
      return decodeURIComponent(
        Array.prototype.map
          .call(binary, (c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join("")
      );
    } catch {
      return binary;
    }
  };

  const fromAtob = decodeWithAtob();
  if (fromAtob !== null) return fromAtob;

  const nodeBuffer = globalObj.Buffer;
  if (nodeBuffer && typeof nodeBuffer.from === "function") {
    try {
      return nodeBuffer.from(value, "base64").toString("utf8");
    } catch {
      return "";
    }
  }

  return "";
};

const slugify = (value) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const normalizeFormOption = (option, index) => {
  if (!option) return null;
  if (typeof option === "string") {
    const trimmed = option.trim();
    if (!trimmed) return null;
    return {
      id: `option-${index}`,
      label: trimmed,
      value: trimmed,
      description: "",
      required: false,
      default: false,
    };
  }
  if (typeof option !== "object") return null;
  const label = option.label || option.name || option.value || `Option ${index + 1}`;
  const value = option.value || option.label || option.name || label;
  return {
    id: option.id || `option-${index}`,
    label,
    value,
    description: option.description || "",
    required: !!option.required,
    default: !!option.default || !!option.checked,
  };
};

const normalizeFormFields = (body) => {
  if (!Array.isArray(body)) return [];
  return body
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const type = (item.type || "").toLowerCase();
      const attrs = item.attributes || {};
      const validations = item.validations || {};
      const baseId =
        item.id ||
        attrs.id ||
        slugify(attrs.label || attrs.name || attrs.title || "") ||
        `field-${index}`;

      if (type === "markdown") {
        return {
          id: baseId,
          type: "markdown",
          content: attrs.value || "",
        };
      }

      if (type === "attachments" || type === "contributors") {
        return {
          id: baseId,
          type,
          label:
            attrs.label ||
            (type === "attachments" ? "Attachments" : "Contributors"),
          description: attrs.description || "",
        };
      }

      const field = {
        id: baseId,
        type,
        label: attrs.label || attrs.name || attrs.title || "",
        name: attrs.name || "",
        description: attrs.description || "",
        required: !!attrs.required,
        placeholder: attrs.placeholder || "",
        options: [],
        multiple: !!attrs.multiple,
        validations: {
          min: validations.min ?? attrs.min ?? null,
          max: validations.max ?? attrs.max ?? null,
          pattern: validations.pattern || attrs.pattern || "",
        },
        defaultValue: undefined,
      };

      if (type === "checkboxes" || type === "dropdown" || type === "multiselect") {
        const rawOptions = Array.isArray(attrs.options) ? attrs.options : [];
        const normalizedOptions = rawOptions
          .map((option, optIndex) => normalizeFormOption(option, optIndex))
          .filter(Boolean);
        field.options = normalizedOptions;

        if (type === "dropdown") {
          const isMultiple = field.multiple || attrs.multiple === true;
          field.multiple = isMultiple;
          let defaultValue = attrs.default;
          if (typeof defaultValue === "number" && normalizedOptions[defaultValue]) {
            defaultValue = normalizedOptions[defaultValue].value;
          } else if (typeof defaultValue === "string") {
            const match = normalizedOptions.find(
              (opt) => opt.value === defaultValue || opt.label === defaultValue
            );
            defaultValue = match ? match.value : defaultValue;
          } else if (Array.isArray(defaultValue)) {
            defaultValue = defaultValue
              .map((val) => {
                const match = normalizedOptions.find(
                  (opt) => opt.value === val || opt.label === val
                );
                return match ? match.value : val;
              })
              .filter(Boolean);
          } else {
            defaultValue = null;
          }
          if (!defaultValue) {
            const optionDefault = normalizedOptions.find((opt) => opt.default);
            if (optionDefault) {
              defaultValue = optionDefault.value;
            }
          }
          if (isMultiple) {
            const defaults = Array.isArray(defaultValue)
              ? defaultValue
              : defaultValue
              ? [defaultValue]
              : [];
            const optionDefaults = normalizedOptions
              .filter((opt) => opt.default)
              .map((opt) => opt.value);
            field.defaultValue = Array.from(new Set([...defaults, ...optionDefaults]));
          } else {
            field.defaultValue =
              typeof defaultValue === "string" ? defaultValue : "";
          }
        } else {
          const explicitDefaults = Array.isArray(attrs.default)
            ? attrs.default
            : attrs.default
            ? [attrs.default]
            : [];
          const optionDefaults = normalizedOptions
            .filter((opt) => opt.default)
            .map((opt) => opt.value);
          field.defaultValue = Array.from(
            new Set([
              ...explicitDefaults.map((val) => {
                const match = normalizedOptions.find(
                  (opt) => opt.value === val || opt.label === val
                );
                return match ? match.value : val;
              }),
              ...optionDefaults,
            ])
          );
        }
        return field;
      }

      switch (type) {
        case "textarea":
        case "input":
        case "number": {
          const defaultValue =
            attrs.default ?? attrs.value ?? attrs.placeholder ?? "";
          field.defaultValue =
            defaultValue != null ? String(defaultValue) : "";
          return field;
        }
        case "confirmations": {
          field.type = "checkboxes";
          field.options = [
            {
              id: `${baseId}-confirm`,
              label: attrs.label || attrs.name || "Confirmation",
              value: "confirmed",
              description: attrs.description || "",
              required: true,
              default: !!attrs.default,
            },
          ];
          field.defaultValue = attrs.default ? ["confirmed"] : [];
          return field;
        }
        default: {
          field.defaultValue = attrs.default ?? "";
          return field;
        }
      }
    })
    .filter(Boolean);
};

const renderIssueFormBody = (form) => {
  if (!form || !Array.isArray(form.body)) return "";
  const sections = [];
  for (const item of form.body) {
    if (!item || typeof item !== "object") continue;
    const type = (item.type || "").toLowerCase();
    const attrs = item.attributes || {};
    const requiredText = attrs.required ? " *(required)*" : "";

    if (type === "markdown") {
      if (attrs.value) sections.push(attrs.value.trim());
      continue;
    }

    const parts = [];
    if (attrs.label) {
      parts.push(`### ${attrs.label}${requiredText}`);
    } else if (attrs.name) {
      parts.push(`### ${attrs.name}${requiredText}`);
    }
    if (attrs.description) {
      parts.push(attrs.description.trim());
    }

    switch (type) {
      case "textarea":
      case "input":
      case "number": {
        if (attrs.placeholder) {
          parts.push(`> ${attrs.placeholder}`);
        }
        if (attrs.default) {
          parts.push(`Default: ${attrs.default}`);
        }
        break;
      }
      case "dropdown":
      case "multiselect": {
        const options = attrs.options || [];
        if (options.length) {
          parts.push(
            "Options:\n" +
              options
                .map((opt) => {
                  const optLabel = typeof opt === "string" ? opt : opt.label;
                  return optLabel ? `- ${optLabel}` : null;
                })
                .filter(Boolean)
                .join("\n")
          );
        }
        break;
      }
      case "checkboxes": {
        const options = attrs.options || [];
        if (options.length) {
          parts.push(
            options
              .map((opt) => {
                const optLabel = typeof opt === "string" ? opt : opt.label;
                if (!optLabel) return null;
                const required = opt.required ? " *(required)*" : "";
                return `- [ ] ${optLabel}${required}`;
              })
              .filter(Boolean)
              .join("\n")
          );
        }
        break;
      }
      case "contributors": {
        parts.push("Add relevant contributors.");
        break;
      }
      case "attachments": {
        parts.push("Attach supporting files as needed.");
        break;
      }
      default: {
        if (!parts.length && attrs.placeholder) {
          parts.push(attrs.placeholder);
        }
      }
    }

    const content = parts.filter(Boolean).join("\n\n");
    if (content) sections.push(content.trim());
  }
  return sections.join("\n\n").trim();
};

const fetchIssueFormTemplates = async (token, owner, name) => {
  try {
    const dirRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
        name
      )}/contents/.github/ISSUE_TEMPLATE`,
      {
        headers: githubRestHeaders(token),
      }
    );
    if (!dirRes.ok) return [];
    const items = await dirRes.json();
    if (!Array.isArray(items)) return [];
    const templates = [];
    for (const item of items) {
      if (!item || item.type !== "file") continue;
      if (!/\.ya?ml$/i.test(item.name)) continue;
      const fileRes = await fetch(item.url, { headers: githubRestHeaders(token) });
      if (!fileRes.ok) continue;
      const fileJson = await fileRes.json();
      const content = decodeBase64(fileJson.content || "");
      if (!content.trim()) continue;
      let parsed;
      try {
        parsed = YAML.parse(content);
      } catch {
        continue;
      }
      if (!parsed || typeof parsed !== "object") continue;
      const formFields = normalizeFormFields(parsed.body);
      const body = renderIssueFormBody(parsed);
      templates.push({
        name: parsed.name || item.name.replace(/\.ya?ml$/i, ""),
        description: parsed.description || "",
        body,
        title: parsed.title || "",
        formFields,
        isForm: true,
      });
    }
    return templates;
  } catch {
    return [];
  }
};

const templateIdentifiersMatch = (template, title, name, desc) => {
  return (
    (template.title || "").toLowerCase() === title &&
    (template.name || "").toLowerCase() === name &&
    (template.description || "").toLowerCase() === desc
  );
};

const templateMapHasEquivalent = (map, title, name, desc) => {
  for (const value of map.values()) {
    if (templateIdentifiersMatch(value, title, name, desc)) {
      return true;
    }
  }
  return false;
};

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

export const REPO_ISSUE_METADATA = `
  query RepoIssueMetadata($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      name
      nameWithOwner
      url
      issueTemplates {
        name
        body
        about
        title
      }
      labels(first: 100) {
        nodes {
          id
          name
          color
          description
        }
      }
      assignableUsers(first: 50) {
        nodes {
          id
          login
          name
          avatarUrl
          url
        }
      }
      milestones(first: 50, states: [OPEN]) {
        nodes {
          id
          number
          title
          state
          dueOn
          description
        }
      }
      projectsV2(first: 20) {
        nodes {
          id
          number
          title
          url
        }
      }
    }
  }
`;

const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($input: CreateIssueInput!) {
    createIssue(input: $input) {
      issue {
        id
        number
        title
        url
        createdAt
        state
        repository {
          nameWithOwner
          url
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

export async function fetchRepoIssueMetadata(token, owner, name) {
  const data = await githubGraphQL(token, REPO_ISSUE_METADATA, { owner, name });
  const repo = data.repository;
  if (!repo) {
    throw new Error("Repository not found or access denied.");
  }

  const graphTemplates =
    (repo.issueTemplates || []).map((template) => ({
      name: template.name,
      body: template.body || "",
      description: template.about || "",
      title: template.title || "",
    })) || [];

  let restTemplates = [];
  try {
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/templates`, {
      headers: githubRestHeaders(token),
    });
    if (res.ok) {
      const json = await res.json();
      const templatesArray = Array.isArray(json?.templates)
        ? json.templates
        : Array.isArray(json)
        ? json
        : [];
      restTemplates = templatesArray.map((template) => ({
        name: template.title || template.name || "",
        body: template.body || "",
        description: template.description || template.about || "",
        title: template.title || template.name || "",
      }));
    }
  } catch {
    // ignore REST fallback errors and rely on GraphQL data instead
  }

  let formTemplates = [];
  try {
    formTemplates = await fetchIssueFormTemplates(token, owner, name);
  } catch {
    formTemplates = [];
  }

  const templateMap = new Map();
  [...graphTemplates, ...restTemplates, ...formTemplates].forEach((template, index) => {
    const title = (template.title || "").toLowerCase();
    const name = (template.name || "").toLowerCase();
    const desc = (template.description || "").toLowerCase();
    if (templateMapHasEquivalent(templateMap, title, name, desc)) return;
    const key = [title, name, desc].filter(Boolean).join("|") || `template-${index}`;
    templateMap.set(key, template);
  });

  return {
    id: repo.id,
    name: repo.name,
    nameWithOwner: repo.nameWithOwner,
    url: repo.url,
    issueTemplates: templateMap.size ? Array.from(templateMap.values()) : graphTemplates,
    labels: (repo.labels?.nodes || []).map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || "",
    })),
    assignees: (repo.assignableUsers?.nodes || []).map((user) => ({
      id: user.id,
      login: user.login,
      name: user.name || "",
      avatarUrl: user.avatarUrl,
      url: user.url,
    })),
    milestones: (repo.milestones?.nodes || []).map((mile) => ({
      id: mile.id,
      number: mile.number,
      title: mile.title,
      state: mile.state,
      dueOn: mile.dueOn,
      description: mile.description || "",
    })),
    projects: (repo.projectsV2?.nodes || []).map((proj) => ({
      id: proj.id,
      number: proj.number,
      title: proj.title,
      url: proj.url,
    })),
  };
}

export async function createIssue(token, input) {
  const data = await githubGraphQL(token, CREATE_ISSUE_MUTATION, { input });
  const issue = data?.createIssue?.issue;
  if (!issue) {
    throw new Error("Failed to create issue.");
  }
  return issue;
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
      issues: (n.issues?.nodes || []).map(i => ({
        id: i.id,
        number: i.number,
        title: i.title,
        body: i.body,
        url: i.url,
        state: i.state,
        createdAt: i.createdAt,
        closedAt: i.closedAt,
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
