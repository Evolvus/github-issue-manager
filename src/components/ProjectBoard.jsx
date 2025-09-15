import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { FolderKanban, Download, ChevronDown, Search } from "lucide-react";
import TimeAgo from "./TimeAgo";
import { IssueOverlayCard } from "./IssueCard";
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

export default function ProjectBoard({ projects, token }) {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [collapsedCols, setCollapsedCols] = useState({});
  const [searchTerms, setSearchTerms] = useState({});
  const [clickedIssue, setClickedIssue] = useState(null);
  const [clickedIssueData, setClickedIssueData] = useState(null);

  const handleDrop = (issueId, newStatus) => {
    // This would typically update the project status via API
    console.log(`Moving issue ${issueId} to status ${newStatus}`);
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
      // Ensure minimal fields exist for card/overlay rendering
      colMap.get(statusVal).push({
        ...iss,
        project: proj.title,
        assignees: iss.assignees || [],
        labels: iss.labels || [],
        milestone: iss.milestone || null,
        repository: typeof iss.repository === "string" ? { nameWithOwner: iss.repository } : iss.repository,
      });
    }
    return order.map(st => [st, colMap.get(st) || []]);
  }, [selectedProjectId, projects]);

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
        {projectBoardByStatus.map(([status, list]) => {
          const search = searchTerms[status] || "";
          const filteredList = list.filter(iss => {
            const q = search.toLowerCase();
            if (!q) return true;
            return (
              (iss.title && iss.title.toLowerCase().includes(q)) ||
              iss.number.toString().includes(q) ||
              (iss.assignees || []).some(a => a.login.toLowerCase().includes(q))
            );
          });
          return (
            <Card key={status} className="rounded-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{status}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary">{filteredList.length}</Badge>
                    <Download className="w-4 h-4 cursor-pointer" onClick={() => downloadCSV(filteredList, `${status}.csv`)} />
                    <ChevronDown onClick={() => toggleCollapse(status)} className={`w-4 h-4 cursor-pointer transition-transform ${collapsedCols[status] ? '-rotate-90' : ''}`} />
                  </div>
                </div>
                <div className="relative mt-2">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearchTerms(prev => ({ ...prev, [status]: e.target.value }))}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
              </CardHeader>
              {!collapsedCols[status] && (
              <CardContent>
                <ul className="space-y-3 max-h-[70vh] overflow-auto pr-1" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); const data = JSON.parse(e.dataTransfer.getData('text/plain')); handleDrop(data.issueId, status);}}>
                  {filteredList.map(iss => (
                    <li
                      key={iss.id}
                      className="p-3 border rounded-xl bg-white shadow-sm cursor-pointer"
                      draggable
                      onDragStart={e=>e.dataTransfer.setData('text/plain', JSON.stringify({ issueId: iss.id }))}
                      onClick={() => handleIssueClick(iss)}
                    >
                      <a href={iss.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline block" onClick={e => e.stopPropagation()}>#{iss.number} {iss.title}</a>
                        <div className="text-xs text-gray-500">{(iss.repository?.nameWithOwner || iss.repository)} • <TimeAgo iso={iss.createdAt} /></div>
                    </li>
                  ))}
                </ul>
              </CardContent>
              )}
            </Card>
          );
        })}
        {!projectBoardByStatus.length && (
          <Card><CardContent className="py-10"><div className="text-sm text-gray-500">No data available.</div></CardContent></Card>
        )}
      </div>

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
    </div>
  );
}
