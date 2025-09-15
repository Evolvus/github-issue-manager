
import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Card, CardHeader, CardContent, CardTitle } from "./components/ui/card";
import { Loader2, ShieldQuestion } from "lucide-react";
import { githubGraphQL, ORG_REPOS_ISSUES, fetchProjectsWithStatus, fetchIssueTypes, fetchOrgReposIssues } from "./api/github";
import useAppStore from "./store";
import AppHeader from "./components/AppHeader";

// Import components
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

  const {
    query,
    setQuery,
    filterState,
    setFilterState,
    filterProjectStatus,
    setFilterProjectStatus,
    filterAssignee,
    setFilterAssignee,
    filterTag,
    setFilterTag,
    filterMilestone,
    setFilterMilestone,
    filterIssueType,
    setFilterIssueType,
    range,
    setRange,
    burnRange,
    setBurnRange,
    theme,
    setTheme,
    density,
    setDensity,
    sidebarOpen,
    setSidebarOpen,
  } = useAppStore();

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
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("density-compact", "density-comfy");
    root.classList.add(density === "compact" ? "density-compact" : "density-comfy");
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
        setSidebarOpen(!sidebarOpen);
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
  }, [sidebarOpen, setSidebarOpen]);

  const cycleTheme = () =>
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "auto" : "light");
  const toggleDensity = () =>
    setDensity(density === "comfy" ? "compact" : "comfy");

  // Temporary function to force reset theme to light mode
  const forceLightMode = () => {
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
      // SWR: show cached immediately (even if stale) and refresh in background
      const typesPromise = fetchIssueTypes(token, org, { swr: true, onUpdate: setIssueTypes });
      const allRepos = await fetchOrgReposIssues(token, org, { swr: true, onUpdate: setRepos });
      // Fetch org meta from a quick one-shot query to avoid redesign; reuse existing call
      const metaData = await githubGraphQL(token, ORG_REPOS_ISSUES, { org, after: null });
      const orgNode = metaData.organization;
      if (!orgNode) throw new Error("Organization not found or access denied.");
      setOrgMeta({ name: orgNode.name, url: orgNode.url });
      setRepos(allRepos);
      const boards = await fetchProjectsWithStatus(token, org, { swr: true, onUpdate: setProjects });
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
        <AppHeader
          org={org}
          setOrg={setOrg}
          token={token}
          setToken={setToken}
          loadData={loadData}
          loading={loading}
          cycleTheme={cycleTheme}
          toggleDensity={toggleDensity}
          theme={theme}
          density={density}
          sidebarOpen={sidebarOpen}
        />

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
              />
            } />
            <Route path="/by-assignee" element={
              <ByAssignee
                allIssues={allIssues}
              />
            } />
            <Route path="/by-tags" element={
              <ByTags
                allIssues={allIssues}
              />
            } />
            <Route path="/project-board" element={
              <ProjectBoard 
                projects={projects}
                token={token}
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
                projectStatusOptions={projectStatusOptions}
                assigneeOptions={assigneeOptions}
                tagOptions={tagOptions}
                milestoneOptions={milestoneOptions}
                issueTypeOptions={issueTypeOptions}
                token={token}
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
