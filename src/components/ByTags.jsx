import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Search } from "lucide-react";

export default function ByTags({ 
  allIssues, 
  query, 
  setQuery, 
  setFilterAssignee,
  setFilterState,
  setFilterProjectStatus,
  setFilterTag
}) {
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

  const navigate = useNavigate();

  const handleFilterClick = (tag, state = "", projectStatus = "", assignee = "") => {
    setFilterTag(tag);
    setFilterState(state);
    setFilterProjectStatus(projectStatus);
    setFilterAssignee(assignee);
    setQuery("");
    navigate("/all-issues");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2"/>
          <Input placeholder="Search issues..." value={query} onChange={e=>setQuery(e.target.value)} className="pl-7 w-72"/>
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
                    <TableCell>
                      <a
                        href="#"
                        className="text-blue-600 underline"
                        onClick={e => {
                          e.preventDefault();
                          handleFilterClick(label, "OPEN");
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
                          handleFilterClick(label, "CLOSED");
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
                          handleFilterClick(label);
                        }}
                      >
                        {list.length}
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!byLabel.length && (
                <TableRow><TableCell colSpan={4}><div className="text-sm text-gray-500">No data available.</div></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
