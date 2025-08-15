
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Loader2, Github, RefreshCcw, Search, ShieldQuestion, ExternalLink, FolderKanban } from "lucide-react";
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
              assignees(first: 10) { nodes { login avatarUrl url } }
              labels(first: 20) { nodes { id name color } }
            }
          }
        }
      }
    }
  }
`;

const ORG_PROJECTS_ISSUES = `
  query OrgProjects($org: String!) {
    organization(login: $org) {
      projectsV2(first: 30) {
        nodes {
          id
          title
          items(first: 100) {
            nodes {
              id
              status: fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
              content {
                ... on Issue {
                  id
                  number
                  title
                  url
                  state
                  createdAt
                  closedAt
                  repository { nameWithOwner url }
                  assignees(first: 10) { nodes { login avatarUrl url } }
                  labels(first: 20) { nodes { id name color } }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// --- Main App -------------------------------------------------------------
export default function App() {
  const [org, setOrg] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repos, setRepos] = useState([]); // [{id, name, url, issues: [...] }]
  const [projects, setProjects] = useState([]); // [{id, title, issues:[...]}]
  const [orgMeta, setOrgMeta] = useState(null);

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
            assignees: i.assignees?.nodes || [],
            labels: i.labels?.nodes || [],
          }))
        })));
        if (!orgNode.repositories.pageInfo.hasNextPage) break;
        cursor = orgNode.repositories.pageInfo.endCursor;
      }
      setRepos(allRepos);

      const projData = await githubGraphQL(token, ORG_PROJECTS_ISSUES, { org });
      const projNodes = projData.organization?.projectsV2?.nodes || [];
      const projList = projNodes.map(p => ({
        id: p.id,
        title: p.title,
        issues: (p.items?.nodes || [])
          .filter(n => n.content?.__typename === "Issue")
          .map(n => {
            const i = n.content;
            return {
              id: i.id,
              number: i.number,
              title: i.title,
              url: i.url,
              state: i.state,
              createdAt: i.createdAt,
              closedAt: i.closedAt,
              repository: i.repository,
              assignees: i.assignees?.nodes || [],
              labels: i.labels?.nodes || [],
              status: n.status?.name || "Backlog",
            };
          }),
      }));
      setProjects(projList);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // --- Derived Data -------------------------------------------------------
  const allIssues = useMemo(() => repos.flatMap(r => r.issues.map(i => ({...i, repo: r.name, repoUrl: r.url}))), [repos]);

  const [range, setRange] = useState("month"); // week | month | year

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

  const formatXAxis = (d) => {
    if (range === "year") {
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

  // Infer Project Status from labels like "Status: Backlog/In Progress/Done"; fallback to "Backlog"
  const allByStatus = useMemo(() => {
    const colMap = new Map();
    function col(name) { if (!colMap.has(name)) colMap.set(name, []); return colMap.get(name); }
    for (const iss of allIssues) {
      const statusLabel = iss.labels.find(l => /^status\s*:/i.test(l.name));
      const statusVal = statusLabel ? statusLabel.name.split(":")[1].trim() : "Backlog";
      col(statusVal).push(iss);
    }
    const entries = Array.from(colMap.entries()).sort((a,b) => a[0].localeCompare(b[0]));
    return entries;
  }, [allIssues]);

  const byRepo = useMemo(() => {
    const out = new Map();
    for (const iss of allIssues) {
      const key = iss.repository?.nameWithOwner || iss.repo;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(iss);
    }
    return Array.from(out.entries()).sort((a,b) => b[1].length - a[1].length);
  }, [allIssues]);

  const [selectedProject, setSelectedProject] = useState("");
  const projectByStatus = useMemo(() => {
    if (!selectedProject) return [];
    const proj = projects.find(p => p.id === selectedProject);
    if (!proj) return [];
    const colMap = new Map();
    function col(name) { if (!colMap.has(name)) colMap.set(name, []); return colMap.get(name); }
    for (const iss of proj.issues) {
      col(iss.status || "Backlog").push(iss);
    }
    return Array.from(colMap.entries()).sort((a,b) => a[0].localeCompare(b[0]));
  }, [selectedProject, projects]);

  // Search filter for tables
  const [query, setQuery] = useState("");
  const filteredIssues = useMemo(() => {
    if (!query) return allIssues;
    const q = query.toLowerCase();
    return allIssues.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.repository?.nameWithOwner?.toLowerCase().includes(q) ||
      i.assignees.some(a => a.login.toLowerCase().includes(q)) ||
      i.labels.some(l => l.name.toLowerCase().includes(q))
    );
  }, [query, allIssues]);

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

        <Tabs defaultValue="dashboard">
          <TabsList className="grid grid-cols-5 w-full sm:w-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="by-assignee">By Assignee</TabsTrigger>
            <TabsTrigger value="by-tags">By Tags</TabsTrigger>
            <TabsTrigger value="project-board">Project Board</TabsTrigger>
            <TabsTrigger value="by-projects">By Projects</TabsTrigger>
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
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle>Project Issues (by Status)</CardTitle>
                    <select
                      value={selectedProject}
                      onChange={e => setSelectedProject(e.target.value)}
                      className="border rounded-md text-sm px-2 py-1"
                    >
                      <option value="">Select project</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {projectByStatus.map(([status, list]) => (
                      <div key={status} className="border rounded-2xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{status}</div>
                          <Badge variant="secondary">{list.length}</Badge>
                        </div>
                        <ul className="space-y-2 max-h-56 overflow-auto">
                          {list.slice(0,6).map(iss => (
                            <li key={iss.id} className="text-sm">
                              <a href={iss.url} target="_blank" rel="noreferrer" className="hover:underline">#{iss.number} {iss.title}</a>
                              <div className="text-xs text-gray-500">{iss.repository?.nameWithOwner}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {!projectByStatus.length && <EmptyState />}
                  </div>
                </CardContent>
              </Card>
            </div>
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
                          <TableCell>{open}</TableCell>
                          <TableCell>{closed}</TableCell>
                          <TableCell>{row.issues.length}</TableCell>
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
                          <TableCell>{open}</TableCell>
                          <TableCell>{closed}</TableCell>
                          <TableCell>{list.length}</TableCell>
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
            <div className="mb-4 text-sm text-gray-600 flex items-center gap-2">
              <FolderKanban className="w-4 h-4"/> Columns are inferred from labels like <code className="px-1 bg-gray-100 rounded">Status: Backlog/In Progress/Done</code>.
            </div>
            <div className="grid lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 gap-4">
              {allByStatus.map(([status, list]) => (
                <Card key={status} className="rounded-2xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{status}</CardTitle>
                      <Badge variant="secondary">{list.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 max-h-[70vh] overflow-auto pr-1">
                      {list.map(iss => (
                        <li key={iss.id} className="p-3 border rounded-xl bg-white shadow-sm">
                          <a href={iss.url} target="_blank" rel="noreferrer" className="font-medium hover:underline block">#{iss.number} {iss.title}</a>
                          <div className="text-xs text-gray-500 mb-1">{iss.repository?.nameWithOwner} • {fmtDate(iss.createdAt)}</div>
                          <div className="flex flex-wrap gap-1">
                            {iss.labels.map(l => <Badge key={l.id} variant="outline">{l.name}</Badge>)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
              {!allByStatus.length && (
                <Card><CardContent className="py-10"><EmptyState /></CardContent></Card>
              )}
            </div>
          </TabsContent>

          {/* BY PROJECTS (REPOSITORIES) */}
          <TabsContent value="by-projects" className="mt-6">
            <FilterBar query={query} setQuery={setQuery} />
            <div className="grid md:grid-cols-2 gap-4">
              {byRepo.map(([repoName, list]) => (
                <Card key={repoName}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="truncate">{repoName}</CardTitle>
                      <Badge variant="secondary">{list.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 max-h-96 overflow-auto">
                      {list.map(iss => (
                        <li key={iss.id} className="border rounded-xl p-3">
                          <a href={iss.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">#{iss.number} {iss.title}</a>
                          <div className="text-xs text-gray-500">{fmtDate(iss.createdAt)} • {iss.state}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {iss.labels.map(l => <Badge key={l.id} variant="outline">{l.name}</Badge>)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
              {!byRepo.length && <Card><CardContent className="py-10"><EmptyState /></CardContent></Card>}
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
