import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

function initials(str = "?") {
  const parts = str.split(/\s+|\//g).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts[1]?.[0] || "";
  return (first + last).toUpperCase();
}

function getContrastColor(hexColor) {
  let hex = hexColor.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map(ch => ch + ch).join("");
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  if ([r, g, b].some(isNaN)) return "#000000";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export default function IssueCard({ issue, showMilestone = true }) {
  const otherLabels = issue.labels.filter(l => !/^type:\s*/i.test(l.name));
  const typeColorRaw = (issue.issueType?.color || "6b7280").replace(/^#/, "");
  const typeColor = typeColorRaw.length === 3 ? typeColorRaw.split("").map(c => c + c).join("") : typeColorRaw;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="truncate">
            <a href={issue.url} target="_blank" rel="noreferrer" className="hover:underline">
              #{issue.number} {issue.title}
            </a>
          </CardTitle>
          <Badge variant="secondary">{issue.state}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-gray-500 mb-1">{issue.repository?.nameWithOwner}</div>
        {showMilestone && issue.milestone && (
          <div className="text-xs text-gray-500 mb-1">Milestone: {issue.milestone.title}</div>
        )}
        {issue.project_status && (
          <div className="text-xs text-gray-500 mb-1">Status: {issue.project_status}</div>
        )}
        {issue.issueType && (
          <div className="mt-1">
            <span
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `#${typeColor}`,
                color: getContrastColor(typeColor),
              }}
            >
              {issue.issueType.name}
            </span>
          </div>
        )}
        {otherLabels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {otherLabels.map(l => (
              <span
                key={l.id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: `#${l.color}`, color: getContrastColor(l.color) }}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1">
          {issue.assignees.length ? (
            issue.assignees.map(a => (
              <Avatar key={a.login} className="w-6 h-6" title={a.login}>
                <AvatarImage src={a.avatarUrl} />
                <AvatarFallback>{initials(a.login)}</AvatarFallback>
              </Avatar>
            ))
          ) : (
            <span className="text-xs text-gray-500">(unassigned)</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
