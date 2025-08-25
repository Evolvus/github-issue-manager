import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Input } from "./ui/input";
import { Search } from "lucide-react";

function initials(str = "?") {
  const parts = str.split(/\s+|\//g).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts[1]?.[0] || "";
  return (first + last).toUpperCase();
}

export default function ByAssignee({
  allIssues,
  query,
  setQuery,
  setFilterAssignee,
  setFilterState,
  setFilterProjectStatus,
  setFilterTag,
  setFilterIssueType,
}) {
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

  const filteredAssignees = useMemo(() => {
    const q = query.toLowerCase();
    return byAssignee.filter(row => row.assignee.login.toLowerCase().includes(q));
  }, [byAssignee, query]);

  const navigate = useNavigate();

  const handleFilterClick = (assignee, state = "", projectStatus = "", tag = "") => {
    setFilterAssignee(assignee);
    setFilterState(state);
    setFilterProjectStatus(projectStatus);
    setFilterTag(tag);
    setFilterIssueType("");
    setQuery("");
    navigate("/all-issues");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
            <Input data-quick-open placeholder="Search assignees..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-72"/>
          </div>
      </div>
      
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
              {filteredAssignees.map(row => {
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
                        <a href={row.assignee.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
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
                          handleFilterClick(row.assignee.login, "OPEN");
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
                          handleFilterClick(row.assignee.login, "CLOSED");
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
                          handleFilterClick(row.assignee.login);
                        }}
                      >
                        {row.issues.length}
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filteredAssignees.length && (
                <TableRow><TableCell colSpan={4}><div className="text-sm text-gray-500">No data available.</div></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
