import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import ReactMarkdown from "react-markdown";
import TimeAgo from "./TimeAgo";

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

const HEX_COLOR_REGEX = /^#?(?:[0-9a-fA-F]{3}){1,2}$/;
const SAFE_COLOR = "6b7280";

function normalizeHex(color) {
  if (!color || !HEX_COLOR_REGEX.test(color)) {
    return SAFE_COLOR;
  }
  let hex = color.replace(/^#/, "");
  return hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex;
}

function convertImgTagsToMarkdown(text = "") {
  return text.replace(/<img\s+[^>]*>/gi, tag => {
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1] : "";
    const alt = altMatch ? altMatch[1] : "";
    return src ? `![${alt}](${src})` : "";
  });
}

// Expanded Issue Card for Tooltip
export function ExpandedIssueCard({ issue }) {
  const otherLabels = (issue.labels || []).filter(l => !/^type:\s*/i.test(l.name));
  const typeColor = normalizeHex(issue.issueType?.color);
  const processedBody = convertImgTagsToMarkdown(issue.body || "");
  const displayBody =
    processedBody.length > 500 ? `${processedBody.substring(0, 500)}...` : processedBody;

  const renderTimelineItem = (item, idx) => {
    const time = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";
    switch (item.__typename) {
      case "IssueComment":
        return (
          <li key={idx}>
            <div className="text-gray-700"><span className="font-medium">{item.author?.login}</span> commented {time}</div>
            {item.body && <div className="ml-4 text-gray-600">{item.body.length > 200 ? item.body.substring(0,200) + "..." : item.body}</div>}
          </li>
        );
      case "ClosedEvent":
        return (
          <li key={idx} className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> closed this issue {time}</li>
        );
      case "ReopenedEvent":
        return (
          <li key={idx} className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> reopened this issue {time}</li>
        );
      case "LabeledEvent":
        return (
          <li key={idx} className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> added label {item.label?.name} {time}</li>
        );
      case "UnlabeledEvent":
        return (
          <li key={idx} className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> removed label {item.label?.name} {time}</li>
        );
      case "AssignedEvent":
        return (
          <li key={idx} className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> assigned {item.assignee?.login} {time}</li>
        );
      case "UnassignedEvent":
        return (
          <li key={idx} className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> unassigned {item.assignee?.login} {time}</li>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="bg-white border rounded-lg shadow-xl p-5 max-w-md">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-base leading-tight mb-1">
            <a href={issue.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              #{issue.number} {issue.title}
            </a>
          </h3>
          <div className="text-sm text-gray-500">{issue.repository?.nameWithOwner}</div>
        </div>
        <Badge variant="secondary" className="ml-3 flex-shrink-0">
          {issue.state}
        </Badge>
      </div>
      
      {/* Issue Type and Labels */}
      <div className="mb-4">
        {issue.issueType && (
          <div className="mb-2">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
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
          <div className="flex flex-wrap gap-1">
            {otherLabels.slice(0, 6).map(l => {
              const labelColor = normalizeHex(l.color);
              return (
                <span
                  key={l.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `#${labelColor}`, color: getContrastColor(labelColor) }}
                >
                  {l.name}
                </span>
              );
            })}
            {otherLabels.length > 6 && (
              <span className="text-xs text-gray-500">+{otherLabels.length - 6} more</span>
            )}
          </div>
        )}
      </div>
      
      {/* Issue Details */}
      <div className="space-y-2 mb-4 text-sm">
        {issue.milestone && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Milestone:</span>
            <span className="text-gray-700">{issue.milestone.title}</span>
          </div>
        )}
        
        {issue.project_status && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Status:</span>
            <span className="text-gray-700">{issue.project_status}</span>
          </div>
        )}
        
        {issue.createdAt && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Created:</span>
            <span className="text-gray-700">{new Date(issue.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}</span>
          </div>
        )}
        
        {issue.closedAt && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Closed:</span>
            <span className="text-gray-700">{new Date(issue.closedAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}</span>
          </div>
        )}
      </div>
      
      {/* Assignees */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-500 font-medium">Assignees:</span>
        </div>
        {issue.assignees.length ? (
          <div className="flex items-center gap-2">
            {issue.assignees.map(a => (
              <div key={a.login} className="flex items-center gap-1">
                <Avatar className="w-6 h-6" title={a.login}>
                  <AvatarImage src={a.avatarUrl} />
                  <AvatarFallback className="text-xs">{initials(a.login)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-gray-700">{a.login}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-500">(unassigned)</span>
        )}
      </div>
      
      {/* Issue Description/Text */}
      {processedBody && (
        <div className="border-t pt-3">
          <div className="text-sm text-gray-500 font-medium mb-2">Description:</div>
          <div className="text-sm text-gray-700 leading-relaxed max-h-32 overflow-y-auto prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Customize markdown components for better styling
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                pre: ({ children }) => <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto mb-2">{children}</pre>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-3 italic mb-2">{children}</blockquote>,
                a: ({ href, children }) => <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
              }}
            >
              {displayBody}
            </ReactMarkdown>
          </div>
        </div>
      )}
      {issue.timelineItems && issue.timelineItems.length > 0 && (
        <div className="border-t pt-3 mt-3">
          <div className="text-sm text-gray-500 font-medium mb-2">History:</div>
          <ul className="space-y-2 text-sm max-h-40 overflow-y-auto">
            {issue.timelineItems.map((t, i) => renderTimelineItem(t, i))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function IssueCard({ issue, showMilestone = true }) {
  const otherLabels = (issue.labels || []).filter(l => !/^type:\s*/i.test(l.name));
  const typeColor = normalizeHex(issue.issueType?.color);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="truncate">
            <a href={issue.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              #{issue.number} {issue.title}
            </a>
          </CardTitle>
          <Badge variant="secondary">{issue.state}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-gray-500 mb-1">
          {issue.repository?.nameWithOwner} • <TimeAgo iso={issue.createdAt} />
        </div>
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
            {otherLabels.map(l => {
              const labelColor = normalizeHex(l.color);
              return (
                <span
                  key={l.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `#${labelColor}`, color: getContrastColor(labelColor) }}
                >
                  {l.name}
                </span>
              );
            })}
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
