import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ExternalLink, Search } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import TimeAgo from "./TimeAgo";
import useAppStore from "../store";

// Helper functions
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB");
}

function initials(str = "?") {
  const parts = str.split(/\s+|\//g).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts[1]?.[0] || "";
  return (first + last).toUpperCase();
}

function getContrastColor(hexColor) {
  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function daysRange(n = 30) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function monthsRange(n = 12) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export default function Dashboard({
  allIssues,
  allIssuesWithStatus,
  orgMeta,
}) {
  const {
    query,
    setQuery,
    range,
    setRange,
    burnRange,
    setBurnRange,
    setFilterAssignee,
    setFilterState,
    setFilterProjectStatus,
    setFilterTag,
    setFilterIssueType,
  } = useAppStore();
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

  // Determine issues for the currently active milestone (latest by due date)
  const activeMilestoneIssues = useMemo(() => {
    const map = {};
    for (const iss of allIssues) {
      if (!iss.milestone) continue;
      const m = iss.milestone;
      if (!map[m.id]) {
        map[m.id] = { milestone: m, issues: [] };
      }
      map[m.id].issues.push(iss);
    }
    const arr = Object.values(map);
    if (!arr.length) return [];
    arr.sort((a, b) => new Date(b.milestone.dueOn || 0) - new Date(a.milestone.dueOn || 0));
    return arr[0].issues;
  }, [allIssues]);

  const burnDownSeries = useMemo(() => {
    let data;
    if (burnRange === "year") {
      const months = monthsRange(12);
      data = months.map(m => {
        const start = new Date(m + "-01");
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        const open = activeMilestoneIssues.filter(i => {
          const created = new Date(i.createdAt);
          const closed = i.closedAt ? new Date(i.closedAt) : null;
          return created < end && (!closed || closed >= end);
        }).length;
        return { date: m, open };
      });
    } else {
      const days = burnRange === "week" ? daysRange(7) : daysRange(30);
      data = days.map(d => {
        const end = new Date(d);
        end.setDate(end.getDate() + 1);
        const open = activeMilestoneIssues.filter(i => {
          const created = new Date(i.createdAt);
          const closed = i.closedAt ? new Date(i.closedAt) : null;
          return created < end && (!closed || closed >= end);
        }).length;
        return { date: d, open };
      });
    }

    const startOpen = data[0]?.open || 0;
    const total = data.length - 1 || 1;
    return data.map((row, idx) => ({
      ...row,
      ideal: Math.max(0, Math.round(startOpen - (startOpen * idx) / total)),
    }));
  }, [activeMilestoneIssues, burnRange]);

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
    const topAssignees = useMemo(() => byAssignee.slice(0, 10), [byAssignee]);

    const agingBuckets = useMemo(() => {
      const buckets = {
        "<7": 0,
        "7-30": 0,
        "31-90": 0,
        ">90": 0,
      };
      const now = new Date();
      for (const iss of allIssues) {
        if (iss.state !== "OPEN") continue;
        const ageDays = (now - new Date(iss.createdAt)) / 86400000;
        if (ageDays < 7) buckets["<7"]++;
        else if (ageDays < 30) buckets["7-30"]++;
        else if (ageDays < 90) buckets["31-90"]++;
        else buckets[">90"]++;
      }
      return Object.entries(buckets).map(([range, value]) => ({ range, value }));
    }, [allIssues]);

    const avgCycle = useMemo(() => {
      const closed = allIssues.filter(i => i.closedAt);
      if (!closed.length) return 0;
      const total = closed.reduce(
        (sum, i) => sum + (new Date(i.closedAt) - new Date(i.createdAt)),
        0
      );
      return total / closed.length / 86400000;
    }, [allIssues]);

    const assigneeThroughput = useMemo(() => {
      const map = new Map();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      for (const iss of allIssues) {
        if (!iss.closedAt) continue;
        const closedDate = new Date(iss.closedAt);
        if (closedDate < cutoff) continue;
        const assignees = iss.assignees.length
          ? iss.assignees
          : [{ login: "(unassigned)" }];
        for (const a of assignees) {
          map.set(a.login, (map.get(a.login) || 0) + 1);
        }
      }
      return Array.from(map.entries())
        .map(([login, count]) => ({ login, count }))
        .sort((a, b) => b.count - a.count);
    }, [allIssues]);

  const issueTypeData = useMemo(() => {
    const map = new Map();
    for (const iss of allIssues) {
      if (iss.state !== "OPEN") continue;
      const name = iss.issueType?.name || "(none)";
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { name, value: 0 });
      map.get(key).value++;
    }
    const colorMap = {
      bug: "ef4444",
      feature: "22c55e",
      task: "3b82f6",
      "(none)": "a52a2a",
    };
    return Array.from(map.values()).map(row => ({
      ...row,
      color: colorMap[row.name.toLowerCase()] || "6b7280",
    }));
  }, [allIssues]);

  const closedIssueTypeData = useMemo(() => {
    const map = new Map();
    for (const iss of allIssues) {
      if (iss.state !== "CLOSED") continue;
      const name = iss.issueType?.name || "(none)";
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { name, value: 0 });
      map.get(key).value++;
    }
    const colorMap = {
      bug: "ef4444",
      feature: "22c55e",
      task: "3b82f6",
      "(none)": "a52a2a",
    };
    return Array.from(map.values()).map(row => ({
      ...row,
      color: colorMap[row.name.toLowerCase()] || "6b7280",
    }));
  }, [allIssues]);

  const stats = useMemo(() => {
    const open = allIssuesWithStatus.filter(i => i.state === "OPEN").length;
    const closed = allIssuesWithStatus.filter(i => i.state === "CLOSED").length;
    const backlog = allIssuesWithStatus.filter(i => i.project_status === "Backlog").length;
    const thisSprint = allIssuesWithStatus.filter(i => ["Ready", "In progress", "In review"].includes(i.project_status)).length;
    return { open, closed, backlog, thisSprint };
  }, [allIssuesWithStatus]);

  const navigate = useNavigate();

  const handleFilterClick = (assignee, state = "", projectStatus = "", tag = "") => {
    setFilterAssignee(assignee ? [assignee] : []);
    setFilterState(state ? [state] : []);
    setFilterProjectStatus(projectStatus ? [projectStatus] : []);
    setFilterTag(tag ? [tag] : []);
    setFilterIssueType([]);
    setQuery("");
    navigate("/all-issues");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {orgMeta && (
          <a href={orgMeta.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 inline-flex items-center gap-1">
            {orgMeta.name} <ExternalLink className="w-3 h-3"/>
          </a>
        )}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
              <Input data-quick-open placeholder="Search issues..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-60"/>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sprint Burndown Chart</CardTitle>
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
                <Line type="monotone" dataKey="open" name="Remaining Issues" stroke="#3b82f6" />
                <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#a3a3a3" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
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
            <CardTitle>Issue Types</CardTitle>
          </CardHeader>
          <CardContent>
            {issueTypeData.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={issueTypeData} dataKey="value" nameKey="name" label>
                      {issueTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`#${entry.color}`} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No issue types found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Closed Issues by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {closedIssueTypeData.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={closedIssueTypeData} dataKey="value" nameKey="name" label>
                      {closedIssueTypeData.map((entry, index) => (
                        <Cell key={`closed-cell-${index}`} fill={`#${entry.color}`} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No issue types found.</p>
            )}
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
                    <a href={iss.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline truncate block">#{iss.number} {iss.title}</a>
                      <div className="text-xs text-gray-500">{iss.repository?.nameWithOwner} • <TimeAgo iso={iss.createdAt} /></div>
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
              {!latest5.length && <div className="text-sm text-gray-500">No data available.</div>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Assignees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topAssignees.map(row => (
                <div key={row.assignee.login} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={row.assignee.avatarUrl} />
                      <AvatarFallback>{initials(row.assignee.login)}</AvatarFallback>
                    </Avatar>
                    <a href={row.assignee.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                      {row.assignee.login}
                    </a>
                  </div>
                  <Badge variant="secondary">{row.issues.length}</Badge>
                </div>
              ))}
              {!topAssignees.length && <p className="text-sm text-gray-500">No assignees found.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Issue Aging</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingBuckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avg Cycle Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgCycle.toFixed(1)}d</div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Assignee Throughput (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {assigneeThroughput.map(row => (
                  <li key={row.login} className="flex items-center justify-between">
                    <span>{row.login}</span>
                    <Badge variant="secondary">{row.count}</Badge>
                  </li>
                ))}
                {!assigneeThroughput.length && (
                  <div className="text-sm text-gray-500">No data.</div>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>


    </div>
  );
}
