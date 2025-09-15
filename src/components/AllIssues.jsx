import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import MultiSelect from "./ui/MultiSelect";
import { Download, Search, X } from "lucide-react";
import { downloadIssuesExcel } from "../utils/exportExcel";
import IssueCard, { IssueOverlayCard } from "./IssueCard";
import useAppStore from "../store";
import { fetchIssueWithTimeline } from "../api/github";

// Excel export handled via utils/exportExcel

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
      (!filterState.length || filterState.includes(i.state)) &&
      (!filterProjectStatus.length || (i.project_status && filterProjectStatus.includes(i.project_status))) &&
      (!filterAssignee.length || (
        (filterAssignee.includes("(unassigned)") && i.assignees.length === 0) ||
        i.assignees.some(a => filterAssignee.includes(a.login))
      )) &&
      (!filterIssueType.length || (i.issueType?.name && filterIssueType.includes(i.issueType.name))) &&
      (!filterTag.length || i.labels.some(l => filterTag.includes(l.name))) &&
      (!filterMilestone.length || (
        (filterMilestone.includes("(none)") && !i.milestone) ||
        (i.milestone?.title && filterMilestone.includes(i.milestone.title))
      )) &&
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
      const full = await fetchIssueWithTimeline(token, owner, repo, issue.number, { swr: true, onUpdate: setClickedIssueData });
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

  const hasAnyFilter =
    (filterState?.length || 0) +
    (filterProjectStatus?.length || 0) +
    (filterAssignee?.length || 0) +
    (filterIssueType?.length || 0) +
    (filterTag?.length || 0) +
    (filterMilestone?.length || 0) > 0;

  const removeState = (v) => setFilterState(filterState.filter(x => x !== v));
  const removeProjectStatus = (v) => setFilterProjectStatus(filterProjectStatus.filter(x => x !== v));
  const removeAssignee = (v) => setFilterAssignee(filterAssignee.filter(x => x !== v));
  const removeIssueType = (v) => setFilterIssueType(filterIssueType.filter(x => x !== v));
  const removeTag = (v) => setFilterTag(filterTag.filter(x => x !== v));
  const removeMilestone = (v) => setFilterMilestone(filterMilestone.filter(x => x !== v));

  return (
    <div className="space-y-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
            <Input data-quick-open placeholder="Search issues..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-60"/>
          </div>
        <MultiSelect options={["OPEN","CLOSED"]} value={filterState} onChange={setFilterState} placeholder="States" />
        <MultiSelect options={projectStatusOptions} value={filterProjectStatus} onChange={setFilterProjectStatus} placeholder="Project statuses" />
        <MultiSelect options={assigneeOptions} value={filterAssignee} onChange={setFilterAssignee} placeholder="Assignees" />
        <MultiSelect options={issueTypeOptions} value={filterIssueType} onChange={setFilterIssueType} placeholder="Types" />
        <MultiSelect options={tagOptions} value={filterTag} onChange={setFilterTag} placeholder="Tags" />
        <MultiSelect options={milestoneOptions} value={filterMilestone} onChange={setFilterMilestone} placeholder="Milestones" />
        <Button onClick={() => downloadIssuesExcel(filteredAllIssues, "all-issues.xlsx")} className="ml-auto text-sm">
          <Download className="w-4 h-4"/> Download
        </Button>
      </div>
      {hasAnyFilter ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {filterState.map(v => (
            <div key={"st-"+v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <span>State: {v}</span>
              <button aria-label={`Remove state ${v}`} className="hover:bg-blue-100 rounded-full p-0.5" onClick={() => removeState(v)}>
                <X className="w-3 h-3"/>
              </button>
            </div>
          ))}
          {filterProjectStatus.map(v => (
            <div key={"ps-"+v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              <span>Status: {v}</span>
              <button aria-label={`Remove status ${v}`} className="hover:bg-purple-100 rounded-full p-0.5" onClick={() => removeProjectStatus(v)}>
                <X className="w-3 h-3"/>
              </button>
            </div>
          ))}
          {filterAssignee.map(v => (
            <div key={"as-"+v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span>Assignee: {v}</span>
              <button aria-label={`Remove assignee ${v}`} className="hover:bg-emerald-100 rounded-full p-0.5" onClick={() => removeAssignee(v)}>
                <X className="w-3 h-3"/>
              </button>
            </div>
          ))}
          {filterIssueType.map(v => (
            <div key={"it-"+v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span>Type: {v}</span>
              <button aria-label={`Remove type ${v}`} className="hover:bg-amber-100 rounded-full p-0.5" onClick={() => removeIssueType(v)}>
                <X className="w-3 h-3"/>
              </button>
            </div>
          ))}
          {filterTag.map(v => (
            <div key={"tg-"+v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 border">
              <span>Tag: {v}</span>
              <button aria-label={`Remove tag ${v}`} className="hover:bg-gray-200 rounded-full p-0.5" onClick={() => removeTag(v)}>
                <X className="w-3 h-3"/>
              </button>
            </div>
          ))}
          {filterMilestone.map(v => (
            <div key={"ms-"+v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
              <span>Milestone: {v}</span>
              <button aria-label={`Remove milestone ${v}`} className="hover:bg-pink-100 rounded-full p-0.5" onClick={() => removeMilestone(v)}>
                <X className="w-3 h-3"/>
              </button>
            </div>
          ))}
          <button className="ml-2 underline text-gray-500" onClick={() => { setFilterState([]); setFilterProjectStatus([]); setFilterAssignee([]); setFilterIssueType([]); setFilterTag([]); setFilterMilestone([]); }}>Clear all</button>
        </div>
      ) : null}
      
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
