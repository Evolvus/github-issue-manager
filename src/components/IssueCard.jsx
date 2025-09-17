import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import ReactMarkdown from "react-markdown";
import TimeAgo from "./TimeAgo";
import { Maximize2, Minimize2 } from "lucide-react";

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
  const displayBody = processedBody;

  const renderTimelineItem = (item, idx) => {
    switch (item.__typename) {
      case "IssueComment":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.author?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.author?.login)}</AvatarFallback>
              </Avatar>
              <div className="text-gray-700">
                <span className="font-medium">{item.author?.login}</span> commented <TimeAgo iso={item.createdAt} />
              </div>
            </div>
            {item.body && <div className="ml-7 text-gray-600">{item.body}</div>}
          </li>
        );
      case "ClosedEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> closed this issue <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "ReopenedEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> reopened this issue <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "LabeledEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span><span className="font-medium">{item.actor?.login}</span> added label</span>
                {item.label && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `#${normalizeHex(item.label.color)}`, color: getContrastColor(normalizeHex(item.label.color)) }}
                  >
                    {item.label.name}
                  </span>
                )}
                <span><TimeAgo iso={item.createdAt} /></span>
              </div>
            </div>
          </li>
        );
      case "UnlabeledEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span><span className="font-medium">{item.actor?.login}</span> removed label</span>
                {item.label && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `#${normalizeHex(item.label.color)}`, color: getContrastColor(normalizeHex(item.label.color)) }}
                  >
                    {item.label.name}
                  </span>
                )}
                <span><TimeAgo iso={item.createdAt} /></span>
              </div>
            </div>
          </li>
        );
      case "AssignedEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.actor?.login}</span>
                <span>assigned</span>
                {item.assignee && (
                  <>
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={item.assignee?.avatarUrl} />
                      <AvatarFallback className="text-[10px]">{initials(item.assignee?.login)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{item.assignee?.login}</span>
                  </>
                )}
                <span><TimeAgo iso={item.createdAt} /></span>
              </div>
            </div>
          </li>
        );
      case "UnassignedEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.actor?.login}</span>
                <span>unassigned</span>
                {item.assignee && (
                  <>
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={item.assignee?.avatarUrl} />
                      <AvatarFallback className="text-[10px]">{initials(item.assignee?.login)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{item.assignee?.login}</span>
                  </>
                )}
                <span><TimeAgo iso={item.createdAt} /></span>
              </div>
            </div>
          </li>
        );
      case "MilestonedEvent": {
        const who = item.actor?.login || "System";
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              {item.actor?.avatarUrl ? (
                <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(who)}</AvatarFallback></Avatar>
              ) : null}
              <div><span className="font-medium">{who}</span> added this to the <span className="font-medium">{item.milestoneTitle}</span> milestone <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      }
      case "DemilestonedEvent": {
        const who = item.actor?.login || "System";
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              {item.actor?.avatarUrl ? (
                <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(who)}</AvatarFallback></Avatar>
              ) : null}
              <div><span className="font-medium">{who}</span> removed this from the <span className="font-medium">{item.milestoneTitle}</span> milestone <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      }
      case "AddedToProjectEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> added to project <span className="font-medium">{item.project?.name}</span> <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "RemovedFromProjectEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> removed from project <span className="font-medium">{item.project?.name}</span> <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "MovedColumnsInProjectEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> moved in project <span className="font-medium">{item.project?.name}</span> from <span className="font-medium">{item.previousProjectColumnName}</span> to <span className="font-medium">{item.projectColumnName}</span> <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "RenamedTitleEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> renamed title from <span className="italic">{item.previousTitle}</span> to <span className="italic">{item.currentTitle}</span> <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "ConvertedNoteToIssueEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> converted a note to this issue <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "MarkedAsDuplicateEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> marked as duplicate <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "UnmarkedAsDuplicateEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> unmarked as duplicate <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "CrossReferencedEvent": {
        const src = item.source;
        if (src?.__typename === 'PullRequest') {
          return (
            <li key={idx} className="relative pl-6">
              <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
              <div className="flex items-start gap-2 text-gray-700">
                <Avatar className="w-5 h-5 mt-0.5">
                  <AvatarImage src={item.actor?.avatarUrl} />
                  <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div>
                    <span className="font-medium">{item.actor?.login}</span> linked pull request{' '}
                    <a className="text-blue-600 underline" href={src.url} target="_blank" rel="noreferrer">
                      {src.repository?.nameWithOwner}#{src.number}
                    </a>{' '}— {src.title} {src.merged ? <span className="ml-1 text-purple-700">(merged)</span> : null}
                  </div>
                  <div className="text-xs text-gray-500"><TimeAgo iso={item.createdAt} /></div>
                </div>
              </div>
            </li>
          );
        }
        return null;
      }
      case "CrossReferencedEvent": {
        const src = item.source;
        if (src?.__typename === 'PullRequest') {
          return (
            <li key={idx} className="relative pl-6">
              <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
              <div className="flex items-start gap-2 text-gray-700">
                <Avatar className="w-5 h-5 mt-0.5">
                  <AvatarImage src={item.actor?.avatarUrl} />
                  <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div>
                    <span className="font-medium">{item.actor?.login}</span> linked pull request{' '}
                    <a className="text-blue-600 underline" href={src.url} target="_blank" rel="noreferrer">
                      {src.repository?.nameWithOwner}#{src.number}
                    </a>{' '}— {src.title} {src.merged ? <span className="ml-1 text-purple-700">(merged)</span> : null}
                  </div>
                  <div className="text-xs text-gray-500"><TimeAgo iso={item.createdAt} /></div>
                </div>
              </div>
            </li>
          );
        }
        return null;
      }
      default:
        return null;
    }
  };
  
  return (
    <div className="bg-white border rounded-lg shadow-xl p-6 w-full max-w-2xl">
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
          <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none">
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
          <ul className="space-y-4 text-sm relative ml-2 pl-3 border-l border-gray-200">
            {issue.timelineItems.map((t, i) => renderTimelineItem(t, i))}
          </ul>
        </div>
      )}
    </div>
  );
}

// New: Overlay Issue Card with summary + expand toggle
export function IssueOverlayCard({ issue }) {
  const [expanded, setExpanded] = useState(false);
  const otherLabels = (issue.labels || []).filter(l => !/^type:\s*/i.test(l.name));
  const typeColor = normalizeHex(issue.issueType?.color);
  const processedBody = convertImgTagsToMarkdown(issue.body || "");

  const renderTimelineItem = (item, idx) => {
    switch (item.__typename) {
      case "IssueComment":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.author?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.author?.login)}</AvatarFallback>
              </Avatar>
              <div className="text-gray-700">
                <span className="font-medium">{item.author?.login}</span> commented <TimeAgo iso={item.createdAt} />
              </div>
            </div>
            {item.body && <div className="ml-7 text-gray-600">{item.body}</div>}
          </li>
        );
      case "ClosedEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> closed this issue <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "ReopenedEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> reopened this issue <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "LabeledEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span><span className="font-medium">{item.actor?.login}</span> added label</span>
                {item.label && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `#${normalizeHex(item.label.color)}`, color: getContrastColor(normalizeHex(item.label.color)) }}
                  >
                    {item.label.name}
                  </span>
                )}
                <span><TimeAgo iso={item.createdAt} /></span>
              </div>
            </div>
          </li>
        );
      case "UnlabeledEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span><span className="font-medium">{item.actor?.login}</span> removed label</span>
                {item.label && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `#${normalizeHex(item.label.color)}`, color: getContrastColor(normalizeHex(item.label.color)) }}
                  >
                    {item.label.name}
                  </span>
                )}
                <span><TimeAgo iso={item.createdAt} /></span>
              </div>
            </div>
          </li>
        );
      case "AssignedEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.actor?.login}</span>
                <span>assigned</span>
                {item.assignee && (
                  <>
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={item.assignee?.avatarUrl} />
                      <AvatarFallback className="text-[10px]">{initials(item.assignee?.login)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{item.assignee?.login}</span>
                  </>
                )}
                <span><TimeAgo iso={item.createdAt} /></span>
              </div>
            </div>
          </li>
        );
      case "UnassignedEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5">
                <AvatarImage src={item.actor?.avatarUrl} />
                <AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.actor?.login}</span>
                <span>unassigned</span>
                {item.assignee && (
                  <>
                    <Avatar className="w-5 h-5">
                      <AvatarImage src={item.assignee?.avatarUrl} />
                      <AvatarFallback className="text-[10px]">{initials(item.assignee?.login)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{item.assignee?.login}</span>
                  </>
                )}
                <span>{time}</span>
              </div>
            </div>
          </li>
        );
      case "MilestonedEvent": {
        const who = item.actor?.login || "System";
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              {item.actor?.avatarUrl ? (
                <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(who)}</AvatarFallback></Avatar>
              ) : null}
              <div><span className="font-medium">{who}</span> added this to the <span className="font-medium">{item.milestoneTitle}</span> milestone <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      }
      case "DemilestonedEvent": {
        const who = item.actor?.login || "System";
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              {item.actor?.avatarUrl ? (
                <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(who)}</AvatarFallback></Avatar>
              ) : null}
              <div><span className="font-medium">{who}</span> removed this from the <span className="font-medium">{item.milestoneTitle}</span> milestone <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      }
      case "AddedToProjectEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> added to project <span className="font-medium">{item.project?.name}</span> <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "RemovedFromProjectEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> removed from project <span className="font-medium">{item.project?.name}</span> <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "MovedColumnsInProjectEvent":
        return (
          <li key={idx} className="relative pl-6">
            <span className="absolute rounded-full bg-blue-500 border-2 border-white" style={{ left: -6, top: 10, width: 12, height: 12 }} />
            <div className="flex items-start gap-2 text-gray-700">
              <Avatar className="w-5 h-5 mt-0.5"><AvatarImage src={item.actor?.avatarUrl} /><AvatarFallback className="text-[10px]">{initials(item.actor?.login)}</AvatarFallback></Avatar>
              <div><span className="font-medium">{item.actor?.login}</span> moved in project <span className="font-medium">{item.project?.name}</span> from <span className="font-medium">{item.previousProjectColumnName}</span> to <span className="font-medium">{item.projectColumnName}</span> <TimeAgo iso={item.createdAt} /></div>
            </div>
          </li>
        );
      case "RenamedTitleEvent":
        return (
          <li key={idx}>
            <div className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> renamed title from <span className="italic">{item.previousTitle}</span> to <span className="italic">{item.currentTitle}</span> <TimeAgo iso={item.createdAt} /></div>
          </li>
        );
      case "ConvertedNoteToIssueEvent":
        return (
          <li key={idx}>
            <div className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> converted a note to this issue <TimeAgo iso={item.createdAt} /></div>
          </li>
        );
      case "MarkedAsDuplicateEvent":
        return (
          <li key={idx}>
            <div className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> marked as duplicate <TimeAgo iso={item.createdAt} /></div>
          </li>
        );
      case "UnmarkedAsDuplicateEvent":
        return (
          <li key={idx}>
            <div className="text-gray-700"><span className="font-medium">{item.actor?.login}</span> unmarked as duplicate <TimeAgo iso={item.createdAt} /></div>
          </li>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white border rounded-lg shadow-2xl ${expanded ? 'p-6 max-w-3xl' : 'p-5 max-w-md'} w-full`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 pr-3">
          <h3 className="font-bold text-gray-900 text-base leading-tight mb-1">
            <a href={issue.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              #{issue.number} {issue.title}
            </a>
          </h3>
          <div className="text-sm text-gray-500">{issue.repository?.nameWithOwner}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex-shrink-0">
            {issue.state}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            title={expanded ? 'Collapse' : 'Expand'}
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-4 h-4"/>}
          </Button>
        </div>
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
            <span className="text-gray-700">{new Date(issue.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>
        )}
        {issue.closedAt && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Closed:</span>
            <span className="text-gray-700">{new Date(issue.closedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>

      {/* Assignees */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-500 font-medium">Assignees:</span>
        </div>
        {issue.assignees?.length ? (
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

      {/* Expanded content only when expanded */}
      {expanded && processedBody && (
        <div className="border-t pt-3">
          <div className="text-sm text-gray-500 font-medium mb-2">Description:</div>
          <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
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
              {processedBody}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {expanded && issue.timelineItems && issue.timelineItems.length > 0 && (
        <div className="border-t pt-3 mt-3">
          <div className="text-sm text-gray-500 font-medium mb-2">History:</div>
          <ul className="space-y-4 text-sm relative ml-2 pl-3 border-l border-gray-200">
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
