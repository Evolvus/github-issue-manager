import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Download, Search } from "lucide-react";
import IssueCard, { IssueOverlayCard } from "./IssueCard";
import useAppStore from "../store";
import { fetchIssueWithTimeline } from "../api/github";

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
  projectStatusOptions,
  assigneeOptions,
  issueTypeOptions,
  tagOptions,
  milestoneOptions,
  token,
}) {
  const {
    query,
    setQuery,
    filterState,
    setFilterState,
    filterProjectStatus,
    setFilterProjectStatus,
    filterAssignee,
    setFilterAssignee,
    filterIssueType,
    setFilterIssueType,
    filterTag,
    setFilterTag,
    filterMilestone,
    setFilterMilestone,
  } = useAppStore();
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [clickedIssue, setClickedIssue] = useState(null);
  const [clickedIssueData, setClickedIssueData] = useState(null);
  const filteredAllIssues = useMemo(() => {
    const q = query.toLowerCase();
    return allIssuesWithStatus.filter(i =>
      (!filterState || i.state === filterState) &&
      (!filterProjectStatus || i.project_status === filterProjectStatus) &&
      (!filterAssignee ||
        (filterAssignee === "(unassigned)"
          ? i.assignees.length === 0
          : i.assignees.some(a => a.login === filterAssignee))) &&
      (!filterIssueType || i.issueType?.name === filterIssueType) &&
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
  }, [allIssuesWithStatus, filterState, filterProjectStatus, filterAssignee, filterIssueType, filterTag, filterMilestone, query]);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filteredAllIssues]);
  
  const paginatedIssues = useMemo(
    () => filteredAllIssues.slice(0, visibleCount),
    [filteredAllIssues, visibleCount]
  );

  const handleIssueClick = async (issue) => {
    setClickedIssue(issue.id);
    try {
      const [owner, repo] = (issue.repository?.nameWithOwner || "").split("/");
      const full = await fetchIssueWithTimeline(token, owner, repo, issue.number);
      setClickedIssueData(full || issue);
    } catch (e) {
      console.error(e);
      setClickedIssueData(issue);
    }
  };

  const handleClosePopup = () => {
    setClickedIssue(null);
    setClickedIssueData(null);
  };

  return (
    <div className="space-y-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
            <Input data-quick-open placeholder="Search issues..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-60"/>
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
        <select value={filterIssueType} onChange={e=>setFilterIssueType(e.target.value)} className="border rounded-md text-sm px-2 py-1">
          <option value="">All Types</option>
          {issueTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
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
        {paginatedIssues.map(iss => (
          <div 
            key={iss.id} 
            className="cursor-pointer"
            onClick={() => handleIssueClick(iss)}
          >
            <IssueCard issue={iss} />
          </div>
        ))}
        {!paginatedIssues.length && <Card><CardContent className="py-10"><div className="text-sm text-gray-500">No data available.</div></CardContent></Card>}
      </div>
      
      {/* Floating Popup */}
      {clickedIssue && clickedIssueData && (
        <div 
          className="fixed z-[9999] inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          onClick={handleClosePopup}
        >
          <div 
            className="inline-block max-w-3xl max-h-[80vh] overflow-y-auto bg-transparent border-0 shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <IssueOverlayCard issue={clickedIssueData} />
          </div>
        </div>
      )}
      {visibleCount < filteredAllIssues.length && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
