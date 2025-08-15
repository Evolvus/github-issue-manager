import React, { useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import IssueCard from "./IssueCard";

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB");
}

export default function Sprints({ allIssues }) {
  const sprints = useMemo(() => {
    const map = {};
    for (const iss of allIssues) {
      if (!iss.milestone) continue;
      const m = iss.milestone;
      if (!map[m.id]) {
        map[m.id] = {
          id: m.id,
          title: m.title,
          url: m.url,
          dueOn: m.dueOn,
          description: m.description,
          issues: [],
        };
      }
      map[m.id].issues.push(iss);
    }
    return Object.values(map).map(m => ({
      ...m,
      open: m.issues.filter(i => i.state === "OPEN").length,
      closed: m.issues.filter(i => i.state === "CLOSED").length,
    }));
  }, [allIssues]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        {sprints.map(sp => (
          <Card key={sp.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="truncate">
                  <a href={sp.url} target="_blank" rel="noreferrer" className="hover:underline">{sp.title}</a>
                </CardTitle>
                <Badge variant="secondary">{sp.closed}/{sp.open + sp.closed}</Badge>
              </div>
              {sp.dueOn && <div className="text-xs text-gray-500 mt-1">Due {fmtDate(sp.dueOn)}</div>}
            </CardHeader>
            <CardContent>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${((sp.closed/(sp.open+sp.closed))*100 || 0)}%` }} />
              </div>
              <div className="space-y-2 max-h-60 overflow-auto pr-1">
                {sp.issues.map(iss => (
                  <IssueCard key={iss.id} issue={iss} showMilestone={false} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {!sprints.length && <Card><CardContent className="py-10"><div className="text-sm text-gray-500">No data available.</div></CardContent></Card>}
      </div>
    </div>
  );
}
