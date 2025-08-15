
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Loader2, Github, RefreshCcw, Search, ShieldQuestion, ExternalLink, FolderKanban, Download, ChevronDown } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

/**
 * GitHub Issues Manager (React)
 * - Client-side demo app that uses GitHub GraphQL API
 * - Enter your GitHub Organization and a Personal Access Token (classic, repo scope is enough for public repos; also works for private repos your token can access)
 * - Features:
 *   1) Dashboard: opened vs closed graph (30 days), latest 5 issues, project-style grouping by inferred Status, top 5 assignees
 *   2) Issue register by assignee
 *   3) Issue register by tags
 *   4) Project board (columns by Status label e.g. "Status: Backlog/In Progress/Done")
 *   5) Issue register by projects (repositories)
 *
 * Notes:
 * - This is a front-end only app. The token is stored only in memory; nothing is sent anywhere except to api.github.com directly from the browser.
 * - For a production app, add pagination, caching, error handling, and stricter rate-limit management.
 */

const GQL_ENDPOINT = "https://api.github.com/graphql";

// --- Helpers ---------------------------------------------------------------
async function githubGraphQL(token, query, variables = {}) {
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

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB");
}

function daysRange(n = 30) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out; // YYYY-MM-DD
}

function monthsRange(n = 12) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toISOString().slice(0, 7));
  }
  return out; // YYYY-MM
}

function initials(str = "?") {
  const parts = str.split(/\s+|\//g).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts[1]?.[0] || "";
  return (first + last).toUpperCase();
}

function getContrastColor(hexColor) {
  // Convert hex to RGB
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function issuesToCSV(issues) {
  const headers = ["Number", "Title", "URL", "State", "Repository", "ProjectStatus", "CreatedAt", "ClosedAt"];
  const rows = issues.map(i => [
    i.number,
    '"' + (i.title || '').replace(/"/g, '""') + '"',
    i.url || '',
    i.state || '',
    (i.repository?.nameWithOwner || i.repository || ''),
    i.project_status || '',
    i.createdAt || '',
    i.closedAt || ''
  ]);
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

function downloadCSV(issues, filename) {
  const csv = issuesToCSV(issues);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- GraphQL Queries -------------------------------------------------------
const ORG_REPOS_ISSUES = `
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
              url
              state
              createdAt
              closedAt
              repository { nameWithOwner url }
              issueType { id name color }
              assignees(first: 10) { nodes { login avatarUrl url } }
              labels(first: 20) { nodes { id name color } }
              milestone { id title url dueOn description }
            }
          }
        }
      }
    }
  }
`;

const ORG_PROJECTS = `
  query OrgProjects($org: String!, $after: String) {
    organization(login: $org) {
      projectsV2(first: 20, after: $after) {
        nodes { id number title url }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const PROJECT_ITEMS = `
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
                closedAt
                repository { nameWithOwner }
                issueType { id name color }
              }
            }
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
      }
    }
  }
`;

async function fetchProjectsWithStatus(token, org) {
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
    while (true) {
      const data = await githubGraphQL(token, PROJECT_ITEMS, { pid: proj.id, after });
      const node = data.node;
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
            closedAt: issue.closedAt,
            repository: issue.repository?.nameWithOwner || "",
            issueType: issue.issueType || null,
            project_status: status,
          };
        })
        .filter(Boolean);
      items = items.concat(rows);
      if (!node?.items?.pageInfo?.hasNextPage) break;
      after = node.items.pageInfo.endCursor;
    }
    out.push({ id: proj.id, number: proj.number, title: proj.title, url: proj.url, issues: items });
  }
  return out;
}

// --- Main App -------------------------------------------------------------
export default function App() {
  const [org, setOrg] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repos, setRepos] = useState([]); // [{id, name, url, issues: [...] }]
  const [orgMeta, setOrgMeta] = useState(null);
  const [projects, setProjects] = useState([]);

    const loadData = async () => {
    setLoading(true);
    setError("");
    setRepos([]);
    setProjects([]);
    try {
      let allRepos = [];
      let cursor = null;
      for (let page = 0; page < 4; page++) { // up to ~120 repos (4 * 30)
        const data = await githubGraphQL(token, ORG_REPOS_ISSUES, { org, after: cursor });
        const orgNode = data.organization;
        if (!orgNode) throw new Error("Organization not found or access denied.");
        setOrgMeta({ name: orgNode.name, url: orgNode.url });
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
            url: i.url,
            state: i.state,
            createdAt: i.createdAt,
            closedAt: i.closedAt,
            repository: i.repository,
            issueType: i.issueType || null,
            assignees: i.assignees?.nodes || [],
            labels: i.labels?.nodes || [],
            milestone: i.milestone || null,
          }))
        }))); 
        if (!orgNode.repositories.pageInfo.hasNextPage) break;
        cursor = orgNode.repositories.pageInfo.endCursor;
      }
      setRepos(allRepos);
      const boards = await fetchProjectsWithStatus(token, org);
      setProjects(boards);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // --- Derived Data -------------------------------------------------------
  const allIssues = useMemo(() => {
    const repoIssues = repos.flatMap(r => r.issues.map(i => ({ ...i, repo: r.name, repoUrl: r.url })));
    const repoIds = new Set(repoIssues.map(i => i.id));
    const extra = [];
    projects.forEach(p => {
      p.issues.forEach(i => {
        if (!repoIds.has(i.id)) {
          extra.push({
            ...i,
            repo: i.repository,
            repoUrl: "",
            assignees: [],
            labels: [],
            milestone: null,
            repository: { nameWithOwner: i.repository },
          });
        }
      });
    });
    return [...repoIssues, ...extra];
  }, [repos, projects]);

  const sprints = useMemo(() => {
    const map = {};
    for (const iss of allIssues) {
      if (!iss.milestone) continue;
      const m = iss.milestone;
      if (!map[m.id]) {
        map[m.id] = {
          id: m.id,
          title: m.title,
          url: m.url,
          dueOn: m.dueOn,
          description: m.description,
          issues: [],
        };
      }
      map[m.id].issues.push(iss);
    }
    return Object.values(map).map(m => ({
      ...m,
      open: m.issues.filter(i => i.state === "OPEN").length,
      closed: m.issues.filter(i => i.state === "CLOSED").length,
    }));
  }, [allIssues]);

  const [range, setRange] = useState("month"); // week | month | year
  const [burnRange, setBurnRange] = useState("month"); // for burn chart

  const openedClosedSeries = useMemo(() => {
    if (range === "year") {
      const months = monthsRange(12);
      const map = Object.fromEntries(months.map(m => [m, { date: m, opened: 0, closed: 0 }]));
      for (const iss of allIssues) {
        const mOpen = iss.createdAt?.slice(0,7);
        if (map[mOpen]) map[mOpen].opened++;
        if (iss.closedAt) {
          const mClose = iss.closedAt.slice(0,7);
          if (map[mClose]) map[mClose].closed++;
        }
      }
      return Object.values(map);
    } else {
      const days = range === "week" ? daysRange(7) : daysRange(30);
      const map = Object.fromEntries(days.map(d => [d, { date: d, opened: 0, closed: 0 }]));
      for (const iss of allIssues) {
        const dOpen = iss.createdAt?.slice(0,10);
        if (map[dOpen]) map[dOpen].opened++;
        if (iss.closedAt) {
          const dClose = iss.closedAt.slice(0,10);
          if (map[dClose]) map[dClose].closed++;
        }
      }
      return Object.values(map);
    }
  }, [allIssues, range]);

  const burnDownSeries = useMemo(() => {
    if (burnRange === "year") {
      const months = monthsRange(12);
      return months.map(m => {
        const start = new Date(m + "-01");
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        const open = allIssues.filter(i => {
          const created = new Date(i.createdAt);
          const closed = i.closedAt ? new Date(i.closedAt) : null;
          return created < end && (!closed || closed >= end);
        }).length;
        const closed = allIssues.filter(i => {
          const c = i.closedAt ? new Date(i.closedAt) : null;
          return c && c < end;
        }).length;
        return { date: m, open, closed };
      });
    } else {
      const days = burnRange === "week" ? daysRange(7) : daysRange(30);
      return days.map(d => {
        const end = new Date(d);
        end.setDate(end.getDate() + 1);
        const open = allIssues.filter(i => {
          const created = new Date(i.createdAt);
          const closed = i.closedAt ? new Date(i.closedAt) : null;
          return created < end && (!closed || closed >= end);
        }).length;
        const closed = allIssues.filter(i => {
          const c = i.closedAt ? new Date(i.closedAt) : null;
          return c && c < end;
        }).length;
        return { date: d, open, closed };
      });
    }
  }, [allIssues, burnRange]);

  const formatXAxis = (d) => {
    if (range === "year") {
      return new Date(d + "-01").toLocaleString("default", { month: "short" });
    }
    const day = d.slice(8, 10);
    const month = d.slice(5, 7);
    return `${day}/${month}`;
  };

  const formatBurnXAxis = (d) => {
    if (burnRange === "year") {
      return new Date(d + "-01").toLocaleString("default", { month: "short" });
    }
    const day = d.slice(8, 10);
    const month = d.slice(5, 7);
    return `${day}/${month}`;
  };

  const latest5 = useMemo(() => {
    return [...allIssues].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  }, [allIssues]);

  const byAssignee = useMemo(() => {
    const out = new Map();
    for (const iss of allIssues) {
      const assignees = iss.assignees.length ? iss.assignees : [{ login: "(unassigned)", avatarUrl: "", url: "#" }];
      for (const a of assignees) {
        const key = a.login || "(unassigned)";
        if (!out.has(key)) out.set(key, { assignee: a, issues: [] });
        out.get(key).issues.push(iss);
      }
    }
    return Array.from(out.values()).sort((a,b) => b.issues.length - a.issues.length);
  }, [allIssues]);

  const top7Assignees = useMemo(() => byAssignee.slice(0, 7), [byAssignee]);

  const byLabel = useMemo(() => {
    const out = new Map();
    for (const iss of allIssues) {
      if (!iss.labels.length) {
        if (!out.has("(no label)")) out.set("(no label)", []);
        out.get("(no label)").push(iss);
      } else {
        for (const l of iss.labels) {
          if (!out.has(l.name)) out.set(l.name, []);
          out.get(l.name).push(iss);
        }
      }
    }
    return Array.from(out.entries()).sort((a,b) => b[1].length - a[1].length);
  }, [allIssues]);
  const projectStatusMap = useMemo(() => {
    const map = new Map();
    for (const p of projects) {
      for (const iss of p.issues) {
        map.set(iss.id, iss.project_status);
      }
    }
    return map;
  }, [projects]);

  const allIssuesWithStatus = useMemo(
    () => allIssues.map(i => ({ ...i, project_status: projectStatusMap.get(i.id) || null })),
    [allIssues, projectStatusMap]
  );

  const stats = useMemo(() => {
    const open = allIssuesWithStatus.filter(i => i.state === "OPEN").length;
    const closed = allIssuesWithStatus.filter(i => i.state === "CLOSED").length;
    const backlog = allIssuesWithStatus.filter(i => i.project_status === "Backlog").length;
    const thisSprint = allIssuesWithStatus.filter(i => ["Ready", "In progress", "In review"].includes(i.project_status)).length;
    return { open, closed, backlog, thisSprint };
  }, [allIssuesWithStatus]);

  const topFixers = useMemo(() => {
    const map = new Map();
    for (const iss of allIssues) {
      if (iss.state !== "CLOSED") continue;
      const assignees = iss.assignees.length ? iss.assignees : [{ login: "(unassigned)", avatarUrl: "", url: "#" }];
      for (const a of assignees) {
        const key = a.login;
        if (!map.has(key)) map.set(key, { assignee: a, count: 0, issues: [] });
        const row = map.get(key);
        row.count++;
        row.issues.push(iss);
      }
    }
    return Array.from(map.values()).sort((a,b) => b.count - a.count).slice(0,10);
  }, [allIssues]);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [collapsedCols, setCollapsedCols] = useState({});
  const handleDrop = (issueId, newStatus) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== selectedProjectId) return p;
      return {
        ...p,
        issues: p.issues.map(i => i.id === issueId ? { ...i, project_status: newStatus } : i)
      };
    }));
  };
  const toggleCollapse = status => setCollapsedCols(prev => ({ ...prev, [status]: !prev[status] }));
  const projectBoardByStatus = useMemo(() => {
    if (!selectedProjectId) return [];
    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj) return [];
    const order = ["Backlog", "Ready", "In progress", "In review", "Done"];
    const colMap = new Map(order.map(st => [st, []]));
    for (const iss of proj.issues) {
      const statusVal = iss.project_status || "Backlog";
      if (!colMap.has(statusVal)) colMap.set(statusVal, []);
      colMap.get(statusVal).push({ ...iss, project: proj.title });
    }
    return order.map(st => [st, colMap.get(st) || []]);
  }, [selectedProjectId, projects]);

  // Search and filters
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterProjectStatus, setFilterProjectStatus] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterMilestone, setFilterMilestone] = useState("");

  const [activeTab, setActiveTab] = useState("dashboard");

  const projectStatusOptions = useMemo(() => {
    const set = new Set();
    allIssuesWithStatus.forEach(i => { if (i.project_status) set.add(i.project_status); });
    return Array.from(set).sort();
  }, [allIssuesWithStatus]);

  const assigneeOptions = useMemo(() => {
    const set = new Set();
    let hasUnassigned = false;
    allIssuesWithStatus.forEach(i => {
      if (!i.assignees.length) hasUnassigned = true;
      i.assignees.forEach(a => set.add(a.login));
    });
    const arr = Array.from(set).sort();
    if (hasUnassigned) arr.unshift("(unassigned)");
    return arr;
  }, [allIssuesWithStatus]);

  const tagOptions = useMemo(() => {
    const set = new Set();
    allIssuesWithStatus.forEach(i => i.labels.forEach(l => set.add(l.name)));
    return Array.from(set).sort();
  }, [allIssuesWithStatus]);

  const milestoneOptions = useMemo(() => {
    const set = new Set();
    let hasNone = false;
    allIssuesWithStatus.forEach(i => {
      if (i.milestone) {
        set.add(i.milestone.title);
      } else {
        hasNone = true;
      }
    });
    const arr = Array.from(set).sort();
    if (hasNone) arr.unshift("(none)");
    return arr;
  }, [allIssuesWithStatus]);

  const filteredAllIssues = useMemo(() => {
    const q = query.toLowerCase();
    return allIssuesWithStatus.filter(i =>
      (!filterState || i.state === filterState) &&
      (!filterProjectStatus || i.project_status === filterProjectStatus) &&
      (!filterAssignee ||
        (filterAssignee === "(unassigned)"
          ? i.assignees.length === 0
          : i.assignees.some(a => a.login === filterAssignee))) &&
      (!filterTag || i.labels.some(l => l.name === filterTag)) &&
      (!filterMilestone ||
        (filterMilestone === "(none)"
          ? !i.milestone
          : i.milestone?.title === filterMilestone)) &&
      (!q ||
        i.title.toLowerCase().includes(q) ||
        i.repository?.nameWithOwner?.toLowerCase().includes(q) ||
        i.assignees.some(a => a.login.toLowerCase().includes(q)) ||
        i.labels.some(l => l.name.toLowerCase().includes(q))
      )
    );
  }, [allIssuesWithStatus, filterState, filterProjectStatus, filterAssignee, filterTag, filterMilestone, query]);


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Github className="w-6 h-6" />
          <h1 className="text-xl font-semibold">GitHub Issues Manager</h1>
          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
            <Input placeholder="Organization (e.g. vercel)" value={org} onChange={e=>setOrg(e.target.value)} className="w-44" />
            <Input placeholder="Personal Access Token" type="password" value={token} onChange={e=>setToken(e.target.value)} className="w-64" />
            <Button className="bg-black text-white" onClick={loadData} disabled={loading || !org || !token}>
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin"/><span>Loading</span></>) : (<><RefreshCcw className="w-4 h-4"/><span>Load</span></>)}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <Card className="mb-4 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="dashboard">
          <TabsList className="grid grid-cols-6 w-full sm:w-auto">

            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="by-assignee">By Assignee</TabsTrigger>
            <TabsTrigger value="by-tags">By Tags</TabsTrigger>
            <TabsTrigger value="project-board">Project Board</TabsTrigger>
            <TabsTrigger value="sprints">Sprints</TabsTrigger>
            <TabsTrigger value="all-issues">All Issues</TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              {orgMeta && (
                <a href={orgMeta.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 inline-flex items-center gap-1">
                  {orgMeta.name} <ExternalLink className="w-3 h-3"/>
                </a>
              )}
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
                  <Input placeholder="Search issues..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-60"/>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader><CardTitle>Open</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{stats.open}</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Closed</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{stats.closed}</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Backlog</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{stats.backlog}</div></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>This Sprint</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{stats.thisSprint}</div></CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Opened vs Closed</CardTitle>
                    <div className="flex gap-2">
                        <Button className={range === "week" ? "bg-black text-white" : "bg-white text-black border"} onClick={()=>setRange("week")}>Week</Button>
                        <Button className={range === "month" ? "bg-black text-white" : "bg-white text-black border"} onClick={()=>setRange("month")}>Month</Button>
                        <Button className={range === "year" ? "bg-black text-white" : "bg-white text-black border"} onClick={()=>setRange("year")}>Year</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={openedClosedSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatXAxis} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="opened" name="Opened" stroke="#22c55e" />
                        <Line type="monotone" dataKey="closed" name="Closed" stroke="#ef4444" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top 7 Assignees</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {top7Assignees.map((row) => (
                      <div key={row.assignee.login} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={row.assignee.avatarUrl} />
                            <AvatarFallback>{initials(row.assignee.login)}</AvatarFallback>
                          </Avatar>
                          <a href={row.assignee.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                            {row.assignee.login}
                          </a>
                        </div>
                        <Badge variant="secondary">{row.issues.length}</Badge>
                      </div>
                    ))}
                    {!top7Assignees.length && <p className="text-sm text-gray-500">No assignees found.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Latest 5 Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {latest5.map(iss => (
                      <li key={iss.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <a href={iss.url} target="_blank" rel="noreferrer" className="font-medium hover:underline truncate block">#{iss.number} {iss.title}</a>
                          <div className="text-xs text-gray-500">{iss.repository?.nameWithOwner} • {fmtDate(iss.createdAt)}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {iss.labels.map(l => (
                              <span
                                key={l.id}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `#${l.color}`,
                                  color: getContrastColor(l.color)
                                }}
                              >
                                {l.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <Badge>{iss.state}</Badge>
                      </li>
                    ))}
                    {!latest5.length && <EmptyState />}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Issue Fixers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topFixers.map(row => (
                      <div key={row.assignee.login} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={row.assignee.avatarUrl} />
                            <AvatarFallback>{initials(row.assignee.login)}</AvatarFallback>
                          </Avatar>
                          <a href={row.assignee.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                            {row.assignee.login}
                          </a>
                        </div>
                        <Badge variant="secondary">{row.count}</Badge>
                      </div>
                    ))}
                    {!topFixers.length && <p className="text-sm text-gray-500">No fixers found.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Sprint Burn Chart</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      className={burnRange === "week" ? "bg-black text-white" : "bg-white text-black border"}
                      onClick={() => setBurnRange("week")}
                    >
                      Week
                    </Button>
                    <Button
                      className={burnRange === "month" ? "bg-black text-white" : "bg-white text-black border"}
                      onClick={() => setBurnRange("month")}
                    >
                      Month
                    </Button>
                    <Button
                      className={burnRange === "year" ? "bg-black text-white" : "bg-white text-black border"}
                      onClick={() => setBurnRange("year")}
                    >
                      Year
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={burnDownSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={formatBurnXAxis} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="open" name="Open Issues" stroke="#3b82f6" />
                      <Line type="monotone" dataKey="closed" name="Closed Issues" stroke="#ef4444" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BY ASSIGNEE */}
          <TabsContent value="by-assignee" className="mt-6">
            <FilterBar query={query} setQuery={setQuery} />
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Open</TableHead>
                      <TableHead>Closed</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byAssignee.map(row => {
                      const open = row.issues.filter(i => i.state === "OPEN").length;
                      const closed = row.issues.filter(i => i.state === "CLOSED").length;
                      return (
                        <TableRow key={row.assignee.login}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-7 h-7">
                                <AvatarImage src={row.assignee.avatarUrl} />
                                <AvatarFallback>{initials(row.assignee.login)}</AvatarFallback>
                              </Avatar>
                              <a href={row.assignee.url} target="_blank" rel="noreferrer" className="hover:underline">
                                {row.assignee.login}
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>
                            <a
                              href="#"
                              className="text-blue-600 underline"
                              onClick={e => {
                                e.preventDefault();
                                setFilterAssignee(row.assignee.login);
                                setFilterState("OPEN");
                                setFilterProjectStatus("");
                                setFilterTag("");
                                setQuery("");
                                setActiveTab("all-issues");
                              }}
                            >
                              {open}
                            </a>
                          </TableCell>
                          <TableCell>
                            <a
                              href="#"
                              className="text-blue-600 underline"
                              onClick={e => {
                                e.preventDefault();
                                setFilterAssignee(row.assignee.login);
                                setFilterState("CLOSED");
                                setFilterProjectStatus("");
                                setFilterTag("");
                                setQuery("");
                                setActiveTab("all-issues");
                              }}
                            >
                              {closed}
                            </a>
                          </TableCell>
                          <TableCell>
                            <a
                              href="#"
                              className="text-blue-600 underline"
                              onClick={e => {
                                e.preventDefault();
                                setFilterAssignee(row.assignee.login);
                                setFilterState("");
                                setFilterProjectStatus("");
                                setFilterTag("");
                                setQuery("");
                                setActiveTab("all-issues");
                              }}
                            >
                              {row.issues.length}
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!byAssignee.length && (
                      <TableRow><TableCell colSpan={4}><EmptyState /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BY TAGS */}
          <TabsContent value="by-tags" className="mt-6">
            <FilterBar query={query} setQuery={setQuery} />
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Open</TableHead>
                      <TableHead>Closed</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byLabel.map(([label, list]) => {
                      const open = list.filter(i => i.state === "OPEN").length;
                      const closed = list.filter(i => i.state === "CLOSED").length;
                      return (
                        <TableRow key={label}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <a
                              href="#"
                              className="text-blue-600 underline"
                              onClick={e => {
                                e.preventDefault();
                                setFilterTag(label);
                                setFilterState("OPEN");
                                setFilterProjectStatus("");
                                setFilterAssignee("");
                                setQuery("");
                                setActiveTab("all-issues");
                              }}
                            >
                              {open}
                            </a>
                          </TableCell>
                          <TableCell>
                            <a
                              href="#"
                              className="text-blue-600 underline"
                              onClick={e => {
                                e.preventDefault();
                                setFilterTag(label);
                                setFilterState("CLOSED");
                                setFilterProjectStatus("");
                                setFilterAssignee("");
                                setQuery("");
                                setActiveTab("all-issues");
                              }}
                            >
                              {closed}
                            </a>
                          </TableCell>
                          <TableCell>
                            <a
                              href="#"
                              className="text-blue-600 underline"
                              onClick={e => {
                                e.preventDefault();
                                setFilterTag(label);
                                setFilterState("");
                                setFilterProjectStatus("");
                                setFilterAssignee("");
                                setQuery("");
                                setActiveTab("all-issues");
                              }}
                            >
                              {list.length}
                            </a>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!byLabel.length && (
                      <TableRow><TableCell colSpan={4}><EmptyState /></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROJECT BOARD */}
          <TabsContent value="project-board" className="mt-6">
            <div className="mb-4 flex items-center gap-2 flex-wrap text-sm text-gray-600">
              <FolderKanban className="w-4 h-4"/>
              Columns use the project field named <code className="px-1 bg-gray-100 rounded">Status</code>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="border rounded-md text-sm px-2 py-1 ml-auto"
              >
                <option value="">Select project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="grid lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2 gap-4">
              {projectBoardByStatus.map(([status, list]) => (
                <Card key={status} className="rounded-2xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{status}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary">{list.length}</Badge>
                        <Download className="w-4 h-4 cursor-pointer" onClick={() => downloadCSV(list, `${status}.csv`)} />
                        <ChevronDown onClick={() => toggleCollapse(status)} className={`w-4 h-4 cursor-pointer transition-transform ${collapsedCols[status] ? '-rotate-90' : ''}`} />
                      </div>
                    </div>
                  </CardHeader>
                  {!collapsedCols[status] && (
                  <CardContent>
                    <ul className="space-y-3 max-h-[70vh] overflow-auto pr-1" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const data = JSON.parse(e.dataTransfer.getData('text/plain')); handleDrop(data.issueId, status);}}>
                      {list.map(iss => (
                        <li key={iss.id} className="p-3 border rounded-xl bg-white shadow-sm" draggable onDragStart={e=>e.dataTransfer.setData('text/plain', JSON.stringify({ issueId: iss.id }))}>
                          <a href={iss.url} target="_blank" rel="noreferrer" className="font-medium hover:underline block">#{iss.number} {iss.title}</a>
                          <div className="text-xs text-gray-500">{iss.repository} • {fmtDate(iss.createdAt)}</div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  )}
                </Card>
              ))}
              {!projectBoardByStatus.length && (
                <Card><CardContent className="py-10"><EmptyState /></CardContent></Card>
              )}
            </div>
          </TabsContent>

          {/* SPRINTS */}
          <TabsContent value="sprints" className="mt-6">
            <div className="grid md:grid-cols-2 gap-4">
              {sprints.map(sp => (
                <Card key={sp.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="truncate">
                        <a href={sp.url} target="_blank" rel="noreferrer" className="hover:underline">{sp.title}</a>
                      </CardTitle>
                      <Badge variant="secondary">{sp.closed}/{sp.open + sp.closed}</Badge>
                    </div>
                  {sp.dueOn && <div className="text-xs text-gray-500 mt-1">Due {fmtDate(sp.dueOn)}</div>}
                  </CardHeader>
                  <CardContent>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${((sp.closed/(sp.open+sp.closed))*100 || 0)}%` }} />
                    </div>
                    <div className="space-y-2 max-h-60 overflow-auto pr-1">
                      {sp.issues.map(iss => (
                        <IssueCard key={iss.id} issue={iss} showMilestone={false} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!sprints.length && <Card><CardContent className="py-10"><EmptyState /></CardContent></Card>}
            </div>
          </TabsContent>

          {/* ALL ISSUES */}
          <TabsContent value="all-issues" className="mt-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
                <Input placeholder="Search issues..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-60"/>
              </div>
              <select value={filterState} onChange={e=>setFilterState(e.target.value)} className="border rounded-md text-sm px-2 py-1">
                <option value="">All States</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
              </select>
              <select value={filterProjectStatus} onChange={e=>setFilterProjectStatus(e.target.value)} className="border rounded-md text-sm px-2 py-1">
                <option value="">All Project Statuses</option>
                {projectStatusOptions.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
              <select value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)} className="border rounded-md text-sm px-2 py-1">
                <option value="">All Assignees</option>
                {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filterTag} onChange={e=>setFilterTag(e.target.value)} className="border rounded-md text-sm px-2 py-1">
                <option value="">All Tags</option>
                {tagOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterMilestone} onChange={e=>setFilterMilestone(e.target.value)} className="border rounded-md text-sm px-2 py-1">
                <option value="">All Milestones</option>
                {milestoneOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <Button onClick={() => downloadCSV(filteredAllIssues, "all-issues.csv")} className="ml-auto text-sm">
                <Download className="w-4 h-4"/> Download
              </Button>
            </div>
            <div className="mb-3 text-sm text-gray-500">Showing {filteredAllIssues.length} issues</div>
            <div className="grid md:grid-cols-2 gap-4">
              {filteredAllIssues.map(iss => (
                <IssueCard key={iss.id} issue={iss} />
              ))}
              {!filteredAllIssues.length && <Card><CardContent className="py-10"><EmptyState /></CardContent></Card>}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {!allIssues.length && !loading && !error && (
        <div className="max-w-7xl mx-auto px-4 pb-12">
          <Card>
            <CardContent className="py-10 text-center text-gray-600">
              <ShieldQuestion className="w-6 h-6 mx-auto mb-2"/>
              Enter your organization and token above, then click <span className="font-medium">Load</span>.
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

  function IssueCard({ issue, showMilestone = true }) {
    return (
      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="truncate">
            <a href={issue.url} target="_blank" rel="noreferrer" className="hover:underline">
              #{issue.number} {issue.title}
            </a>
          </CardTitle>
          <Badge variant="secondary">{issue.state}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-gray-500 mb-1">{issue.repository?.nameWithOwner}</div>
        {showMilestone && issue.milestone && (
          <div className="text-xs text-gray-500 mb-1">Milestone: {issue.milestone.title}</div>
        )}
          {issue.project_status && (
            <div className="text-xs text-gray-500 mb-1">Status: {issue.project_status}</div>
          )}
          {issue.issueType && (
            <div className="mt-1">
              <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: `#${issue.issueType.color}`, color: getContrastColor(issue.issueType.color) }}
              >
                {issue.issueType.name}
              </span>
            </div>
          )}
          {issue.labels.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {issue.labels.map(l => (
                <span
                  key={l.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `#${l.color}`, color: getContrastColor(l.color) }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1">
            {issue.assignees.length ? (
              issue.assignees.map(a => (
                <Avatar key={a.login} className="w-6 h-6" title={a.login}>
                <AvatarImage src={a.avatarUrl} />
                <AvatarFallback>{initials(a.login)}</AvatarFallback>
              </Avatar>
            ))
          ) : (
            <span className="text-xs text-gray-500">(unassigned)</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return <div className="text-sm text-gray-500">No data available.</div>;
}

function FilterBar({ query, setQuery }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
        <Input placeholder="Search issues..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-72"/>
      </div>
    </div>
  );
}
