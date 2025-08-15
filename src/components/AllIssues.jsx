import React, { useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Download, Search } from "lucide-react";
import IssueCard from "./IssueCard";

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

export default function AllIssues({ 
  allIssuesWithStatus, 
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
  projectStatusOptions,
  assigneeOptions,
  tagOptions,
  milestoneOptions
}) {
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
    <div className="space-y-6">
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
        {!filteredAllIssues.length && <Card><CardContent className="py-10"><div className="text-sm text-gray-500">No data available.</div></CardContent></Card>}
      </div>
    </div>
  );
}
