import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Search } from "lucide-react";
import useAppStore from "../store";

function getContrastColor(hex = "808080") {
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export default function ByTags({
  allIssues,
}) {
  const {
    query,
    setQuery,
    setFilterAssignee,
    setFilterState,
    setFilterProjectStatus,
    setFilterTag,
    setFilterIssueType,
  } = useAppStore();
  const byLabel = useMemo(() => {
    const out = new Map();
    for (const iss of allIssues) {
      if (!iss.labels.length) {
        const key = "(no label)";
        if (!out.has(key)) out.set(key, { label: { name: key, color: "808080" }, issues: [] });
        out.get(key).issues.push(iss);
      } else {
        for (const l of iss.labels) {
          if (!out.has(l.name)) out.set(l.name, { label: l, issues: [] });
          out.get(l.name).issues.push(iss);
        }
      }
    }
    return Array.from(out.values()).sort((a, b) => b.issues.length - a.issues.length);
  }, [allIssues]);

  const filteredLabels = useMemo(() => {
    const q = query.toLowerCase();
    return byLabel.filter(row => row.label.name.toLowerCase().includes(q));
  }, [byLabel, query]);

  const navigate = useNavigate();

  const handleFilterClick = (tag, state = "", projectStatus = "", assignee = "") => {
    setFilterTag(tag ? [tag] : []);
    setFilterState(state ? [state] : []);
    setFilterProjectStatus(projectStatus ? [projectStatus] : []);
    setFilterAssignee(assignee ? [assignee] : []);
    setFilterIssueType([]);
    setQuery("");
    navigate("/all-issues");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
            <Input data-quick-open placeholder="Search tags..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-72"/>
          </div>
      </div>
      
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
              {filteredLabels.map(row => {
                const open = row.issues.filter(i => i.state === "OPEN").length;
                const closed = row.issues.filter(i => i.state === "CLOSED").length;
                const color = row.label.color || "808080";
                return (
                  <TableRow key={row.label.name}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          style={{ backgroundColor: `#${color}`, color: getContrastColor(color) }}
                        >
                          {row.label.name}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href="#"
                        className="text-blue-600 underline"
                        onClick={e => {
                          e.preventDefault();
                          handleFilterClick(row.label.name, "OPEN");
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
                          handleFilterClick(row.label.name, "CLOSED");
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
                          handleFilterClick(row.label.name);
                        }}
                      >
                        {row.issues.length}
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filteredLabels.length && (
                <TableRow><TableCell colSpan={4}><div className="text-sm text-gray-500">No data available.</div></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
