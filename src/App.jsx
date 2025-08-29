
import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Card, CardHeader, CardContent, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Loader2, Github, RefreshCcw, ShieldQuestion, Sun, Moon, Monitor, Maximize2, Minimize2, ExternalLink } from "lucide-react";
import { githubGraphQL, ORG_REPOS_ISSUES, fetchProjectsWithStatus, fetchIssueTypes } from "./api/github";

// Import components
const Navigation = lazy(() => import("./components/Navigation"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const ByAssignee = lazy(() => import("./components/ByAssignee"));
const ByTags = lazy(() => import("./components/ByTags"));
const ProjectBoard = lazy(() => import("./components/ProjectBoard"));
const Sprints = lazy(() => import("./components/Sprints"));
const AllIssues = lazy(() => import("./components/AllIssues"));

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

// --- Main App -------------------------------------------------------------
export default function App() {
  const [org, setOrg] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repos, setRepos] = useState([]); // [{id, name, url, issues: [...] }]
  const [orgMeta, setOrgMeta] = useState(null);
  const [projects, setProjects] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);

  // Chart state
  const [range, setRange] = useState("month"); // week | month | year
  const [burnRange, setBurnRange] = useState("month"); // for burn chart

  // Search and filters
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterProjectStatus, setFilterProjectStatus] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterMilestone, setFilterMilestone] = useState("");
  const [filterIssueType, setFilterIssueType] = useState("");

  // Default theme is light mode - force reset if needed
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    // If no theme is stored or if it's auto (which might default to dark), use light
    if (!storedTheme || storedTheme === "auto") {
      localStorage.setItem("theme", "light");
      return "light";
    }
    return storedTheme;
  });
  const [density, setDensity] = useState(() => localStorage.getItem("density") || "comfy");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (dark) => root.classList.toggle("dark", dark);
    if (theme === "auto") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      apply(media.matches);
      const listener = (e) => apply(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    } else {
      apply(theme === "dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("density-compact", "density-comfy");
    root.classList.add(density === "compact" ? "density-compact" : "density-comfy");
    localStorage.setItem("density", density);
  }, [density]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.querySelector("input[data-quick-open]");
        el && el.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((s) => !s);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        alert("Assign shortcut pressed (not implemented)");
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        alert("Label shortcut pressed (not implemented)");
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        alert("Close shortcut pressed (not implemented)");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const cycleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : t === "dark" ? "auto" : "light"));
  const toggleDensity = () =>
    setDensity((d) => (d === "comfy" ? "compact" : "comfy"));

  // Temporary function to force reset theme to light mode
  const forceLightMode = () => {
    localStorage.setItem("theme", "light");
    setTheme("light");
  };

  // Expose the function globally for debugging
  if (typeof window !== 'undefined') {
    window.forceLightMode = forceLightMode;
  }

  const loadData = async () => {
    setLoading(true);
    setError("");
    setRepos([]);
    setProjects([]);
    setIssueTypes([]);
    try {
      let allRepos = [];
      let cursor = null;
      const typesPromise = fetchIssueTypes(token, org);
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
      setRepos(allRepos);
      const boards = await fetchProjectsWithStatus(token, org);
      setProjects(boards);
      const types = await typesPromise;
      setIssueTypes(types);
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
            issueType: i.issueType || null,
          });
        }
      });
    });
    return [...repoIssues, ...extra];
  }, [repos, projects]);

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

  const issueTypeOptions = useMemo(() => {
    return issueTypes.map(t => t.name).sort();
  }, [issueTypes]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Github className="w-6 h-6" />
            <h1 className="text-xl font-semibold">GitHub Issues Manager</h1>
            <a
              href="https://github.com/evolvus/github-issue-manager"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              title="View Source Code"
            >
              <Github className="w-4 h-4" />
            </a>
            <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
              <Input placeholder="Organization (e.g. vercel)" value={org} onChange={e=>setOrg(e.target.value)} className="w-44" />
              <Input placeholder="Personal Access Token" type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} className="w-64" />
              <Button className="bg-black text-white" onClick={loadData} disabled={loading || !org || !token}>
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin"/><span>Loading</span></>) : (<><RefreshCcw className="w-4 h-4"/><span>Load</span></>)}
              </Button>
              <button onClick={cycleTheme} title={`Theme: ${theme}`} className="p-2 border rounded">
                {theme === "dark" ? <Moon className="w-4 h-4"/> : theme === "light" ? <Sun className="w-4 h-4"/> : <Monitor className="w-4 h-4"/>}
              </button>
              <button onClick={toggleDensity} title={`Density: ${density}`} className="p-2 border rounded">
                {density === "compact" ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-4 h-4"/>}
              </button>
            </div>
          </div>
          {sidebarOpen && (
            <Suspense fallback={<Loader2 className="w-4 h-4 animate-spin" />}>
              <Navigation />
            </Suspense>
          )}
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

        {!allIssues.length && !loading && !error ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">
              <ShieldQuestion className="w-6 h-6 mx-auto mb-2"/>
              Enter your organization and token above, then click <span className="font-medium">Load</span>.
            </CardContent>
          </Card>
        ) : (
          <Suspense fallback={<div className="py-10 text-center"><Loader2 className="w-4 h-4 animate-spin"/></div>}>
          <Routes>
            <Route path="/" element={
              <Dashboard 
                allIssues={allIssues}
                allIssuesWithStatus={allIssuesWithStatus}
                orgMeta={orgMeta}
                query={query}
                setQuery={setQuery}
                range={range}
                setRange={setRange}
                burnRange={burnRange}
                setBurnRange={setBurnRange}
                setFilterAssignee={setFilterAssignee}
                setFilterState={setFilterState}
                setFilterProjectStatus={setFilterProjectStatus}
                setFilterTag={setFilterTag}
                setFilterIssueType={setFilterIssueType}
              />
            } />
            <Route path="/by-assignee" element={
              <ByAssignee
                allIssues={allIssues}
                query={query}
                setQuery={setQuery}
                setFilterAssignee={setFilterAssignee}
                setFilterState={setFilterState}
                setFilterProjectStatus={setFilterProjectStatus}
                setFilterTag={setFilterTag}
                setFilterIssueType={setFilterIssueType}
              />
            } />
            <Route path="/by-tags" element={
              <ByTags
                allIssues={allIssues}
                query={query}
                setQuery={setQuery}
                setFilterAssignee={setFilterAssignee}
                setFilterState={setFilterState}
                setFilterProjectStatus={setFilterProjectStatus}
                setFilterTag={setFilterTag}
                setFilterIssueType={setFilterIssueType}
              />
            } />
            <Route path="/project-board" element={
              <ProjectBoard 
                projects={projects}
              />
            } />
            <Route path="/sprints" element={
              <Sprints
                allIssues={allIssues}
                orgMeta={orgMeta}
                projects={projects}
                token={token}
              />
            } />
            <Route path="/all-issues" element={
              <AllIssues
                allIssuesWithStatus={allIssuesWithStatus}
                query={query}
                setQuery={setQuery}
                filterState={filterState}
                setFilterState={setFilterState}
                filterProjectStatus={filterProjectStatus}
                setFilterProjectStatus={setFilterProjectStatus}
                filterAssignee={filterAssignee}
                setFilterAssignee={setFilterAssignee}
                filterTag={filterTag}
                setFilterTag={setFilterTag}
                filterMilestone={filterMilestone}
                setFilterMilestone={setFilterMilestone}
                filterIssueType={filterIssueType}
                setFilterIssueType={setFilterIssueType}
                projectStatusOptions={projectStatusOptions}
                assigneeOptions={assigneeOptions}
                tagOptions={tagOptions}
                milestoneOptions={milestoneOptions}
                issueTypeOptions={issueTypeOptions}
              />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        )}
      </main>
    </div>
  );
}
