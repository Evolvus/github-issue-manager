import React, { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Download, Maximize2, Minimize2, LineChart as LineChartIcon, AreaChart as AreaChartIcon, Clock3 } from "lucide-react";
import IssueCard, { IssueOverlayCard } from "./IssueCard";
import jsPDF from "jspdf";
import { downloadIssuesExcel } from "../utils/exportExcel";
import { fetchIssueWithTimeline } from "../api/github";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ReferenceArea, AreaChart, Area, BarChart, Bar } from "recharts";

function formatDateForHeader(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function splitIssues(issues) {
  const isFeature = (issue) => {
    const labels = issue.labels.map((l) => l.name.toLowerCase());
    const title = issue.title.toLowerCase();
    const featureLabels = ["feature", "enhancement", "improvement", "new", "add", "implement"];
    if (labels.some((l) => featureLabels.some((fl) => l.includes(fl)))) return true;
    const featureKeywords = [
      "add",
      "implement",
      "create",
      "new",
      "enhance",
      "improve",
      "feature",
      "support",
      "enable",
      "introduce",
    ];
    if (featureKeywords.some((keyword) => title.includes(keyword))) return true;
    if (title.includes("ui") || title.includes("interface") || title.includes("user experience")) return true;
    return false;
  };

  const isBug = (issue) => {
    const labels = issue.labels.map((l) => l.name.toLowerCase());
    const title = issue.title.toLowerCase();
    const bugLabels = ["bug", "fix", "defect", "issue", "error", "broken"];
    if (labels.some((l) => bugLabels.some((bl) => l.includes(bl)))) return true;
    const bugKeywords = [
      "fix",
      "bug",
      "error",
      "issue",
      "problem",
      "crash",
      "broken",
      "defect",
      "fail",
      "not working",
      "doesn't work",
    ];
    if (bugKeywords.some((keyword) => title.includes(keyword))) return true;
    if (title.includes("error") || title.includes("exception") || title.includes("fails")) return true;
    return false;
  };

  return {
    features: issues.filter(isFeature),
    bugs: issues.filter(isBug),
    other: issues.filter((i) => !isFeature(i) && !isBug(i)),
  };
}

async function generateReleaseSummary(issues, orgName, versionName) {
  const { features, bugs, other } = splitIssues(issues);
  const openIssues = issues.filter((i) => i.state === "OPEN");
  const closedIssues = issues.filter((i) => i.state === "CLOSED");

  const featureTitles = features.map((f) => f.title.toLowerCase());
  const bugTitles = bugs.map((b) => b.title.toLowerCase());

  const getFeatureInsights = () => {
    if (features.length === 0) return "";
    const commonThemes = [];
    if (featureTitles.some((t) => t.includes("ui") || t.includes("interface")))
      commonThemes.push("user interface improvements");
    if (featureTitles.some((t) => t.includes("api") || t.includes("endpoint")))
      commonThemes.push("API enhancements");
    if (featureTitles.some((t) => t.includes("performance") || t.includes("speed")))
      commonThemes.push("performance optimizations");
    if (featureTitles.some((t) => t.includes("security") || t.includes("auth")))
      commonThemes.push("security enhancements");
    if (featureTitles.some((t) => t.includes("mobile") || t.includes("responsive")))
      commonThemes.push("mobile experience improvements");
    if (featureTitles.some((t) => t.includes("dashboard") || t.includes("report")))
      commonThemes.push("dashboard and reporting features");
    if (featureTitles.some((t) => t.includes("integration") || t.includes("connect")))
      commonThemes.push("third-party integrations");
    if (commonThemes.length > 0) {
      return `This release introduces ${commonThemes.join(", ")} to enhance the overall user experience and workflow efficiency.`;
    }
    return `This release adds ${features.length} new features to expand functionality and improve user workflows across the platform.`;
  };

  const getBugInsights = () => {
    if (bugs.length === 0) return "";
    const criticalBugs = bugs.filter((b) =>
      b.title.toLowerCase().includes("critical") ||
      b.title.toLowerCase().includes("crash") ||
      b.title.toLowerCase().includes("error") ||
      b.title.toLowerCase().includes("security")
    ).length;
    const uiBugs = bugs.filter((b) =>
      b.title.toLowerCase().includes("ui") ||
      b.title.toLowerCase().includes("display") ||
      b.title.toLowerCase().includes("visual")
    ).length;
    if (criticalBugs > 0) {
      return `Critical stability and security issues have been resolved, including ${criticalBugs} high-priority fixes that address system crashes, errors, and security vulnerabilities.`;
    } else if (uiBugs > 0) {
      return `This release includes ${bugs.length} bug fixes with focus on UI/UX improvements (${uiBugs} visual/display fixes) to enhance user experience and interface reliability.`;
    }
    return `This release includes ${bugs.length} bug fixes to improve system stability, reliability, and overall performance across all modules.`;
  };

  const getProgressInsights = () => {
    const completionRate = Math.round((closedIssues.length / issues.length) * 100);
    if (completionRate >= 90) {
      return "This release is nearly complete with excellent progress across all planned features and improvements. The development team has achieved outstanding delivery milestones.";
    } else if (completionRate >= 70) {
      return "Good progress has been made on this release with most features nearing completion. The development team is on track to deliver a solid release with comprehensive improvements.";
    } else if (completionRate >= 50) {
      return "Moderate progress on this release with ongoing development across multiple features. The team is actively working on delivering key improvements and enhancements.";
    } else {
      return "This release is in active development with significant work remaining across planned features. The development team is focused on delivering quality improvements and new functionality.";
    }
  };

  const getDetailedBreakdown = () => {
    const closedFeatures = features.filter((f) => f.state === "CLOSED").length;
    const closedBugs = bugs.filter((b) => b.state === "CLOSED").length;
    const closedOther = other.filter((o) => o.state === "CLOSED").length;

    return `Detailed Breakdown:
• Features: ${closedFeatures}/${features.length} completed (${features.length > 0 ? Math.round((closedFeatures / features.length) * 100) : 0}%)
• Bug Fixes: ${closedBugs}/${bugs.length} completed (${bugs.length > 0 ? Math.round((closedBugs / bugs.length) * 100) : 0}%)
• Other Updates: ${closedOther}/${other.length} completed (${other.length > 0 ? Math.round((closedOther / other.length) * 100) : 0}%)`;
  };

  return `Release Summary for ${versionName}

${getProgressInsights()}

Progress Status:
• ${closedIssues.length} issues completed (${Math.round((closedIssues.length / issues.length) * 100)}%)
• ${openIssues.length} issues still in progress (${Math.round((openIssues.length / issues.length) * 100)}%)

${getDetailedBreakdown()}

Key Highlights:
${features.length > 0 ? getFeatureInsights() : ""}
${bugs.length > 0 ? getBugInsights() : ""}
${other.length > 0 ? `• ${other.length} additional improvements and optimizations for better system performance, documentation updates, and infrastructure enhancements` : ""}

${
    features.length > 0 || bugs.length > 0
      ? "This release represents a significant step forward in our development roadmap, focusing on both feature enhancements and system stability improvements to deliver a more robust and user-friendly platform."
      : "This release focuses on ongoing improvements and optimizations to maintain system quality, performance, and reliability while preparing for future enhancements."
  }`;
}

async function downloadReleaseNotes(sp, orgName) {
  const { features, bugs, other } = splitIssues(sp.issues);
  const openIssues = sp.issues.filter((i) => i.state === "OPEN");
  const closedIssues = sp.issues.filter((i) => i.state === "CLOSED");
  const summary = await generateReleaseSummary(sp.issues, orgName, sp.title);
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(orgName || "GitHub Organization", 20, 25);

  doc.setFontSize(16);
  doc.text("Release Notes", 20, 35);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Version: ${sp.title}`, 20, 45);
  doc.text(`Release Date: ${sp.dueOn ? formatDateForHeader(sp.dueOn) : 'TBD'}`, 20, 55);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Release Progress", 20, 70);
  // Release Progress (compact with progress bar)
  doc.setFont("helvetica", "normal");
  const totalIssues = sp.issues.length || 0;
  const completed = closedIssues.length || 0;
  const percent = totalIssues ? Math.round((completed / totalIssues) * 100) : 0;
  const barX = 20, barY = 78, barW = 170, barH = 8;
  // background
  doc.setFillColor(230, 230, 230);
  doc.rect(barX, barY, barW, barH, 'F');
  // completed portion
  doc.setFillColor(34, 197, 94); // green-500
  const filledW = Math.round((barW * percent) / 100);
  if (filledW > 0) doc.rect(barX, barY, filledW, barH, 'F');
  // label
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Completed ${completed}/${totalIssues} (${percent}%)`, barX, barY + 14);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Issue Categories", 20, 108);
  // Issue Categories (compact pie chart + legend)
  doc.setFont("helvetica", "normal");
  const pieSize = 40;
  const pieX = 28; // top-left for image placement
  const pieY = 110;
  const counts = [features.length, bugs.length, other.length];
  const colors = [
    [59, 130, 246],  // features - blue-500
    [239, 68, 68],   // bugs - red-500
    [156, 163, 175], // other - gray-500
  ];
  const pieDataUrl = renderPieDataURL(counts, colors, pieSize);
  if (pieDataUrl) {
    doc.addImage(pieDataUrl, 'PNG', pieX, pieY, pieSize, pieSize);
  }
  // Legend
  const legendX = pieX + pieSize + 8;
  const legendY = pieY + 4;
  const legend = [
    { name: 'Features & Enhancements', count: features.length, color: colors[0] },
    { name: 'Bug Fixes', count: bugs.length, color: colors[1] },
    { name: 'Other Updates', count: other.length, color: colors[2] },
  ];
  doc.setFontSize(10);
  legend.forEach((row, idx) => {
    const y = legendY + idx * 12;
    const [r, g, b] = row.color;
    doc.setFillColor(r, g, b);
    doc.rect(legendX, y - 4, 6, 6, 'F');
    doc.setTextColor(0, 0, 0);
    doc.text(`${row.name}: ${row.count}`, legendX + 10, y + 1);
  });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  // Ensure Release Summary starts below the pie chart area
  const afterCategoriesY = Math.max(146, 110 + 40 + 12); // pieY + pieSize + margin
  doc.text("Release Summary", 20, afterCategoriesY);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(summary, 170);
  // Write summary safely within page bounds (avoid overlapping footer)
  const topY = afterCategoriesY + 8;
  const maxBottom = 270; // leave a thinner margin before footer (~280)
  const lineGap = 4; // tighter line height to reduce spacing
  const maxLines = Math.max(0, Math.floor((maxBottom - topY) / lineGap));
  const linesToRender = summaryLines.length > maxLines && maxLines > 0
    ? [...summaryLines.slice(0, maxLines - 1), "..."]
    : summaryLines;
  let cursorY = topY;
  for (const ln of linesToRender) {
    doc.text(ln, 20, cursorY);
    cursorY += lineGap;
  }
  let yPosition = 154 + summaryLines.length * 5 + 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Page 1 of ${Math.max(2, features.length > 0 ? 3 : 2)}`, 20, 280);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 120, 280);

  if (features.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("New Features & Enhancements", 20, 25);
    const sortedFeatures = [...features].sort((a, b) => {
      if (a.state === "CLOSED" && b.state !== "CLOSED") return -1;
      if (a.state !== "CLOSED" && b.state === "CLOSED") return 1;
      return 0;
    });
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Issue #", 25, 40);
    doc.text("Title", 50, 40);
    doc.text("Status", 150, 40);
    let tableY = 45;
    doc.setFont("helvetica", "normal");
    sortedFeatures.forEach((feature) => {
      const status = feature.state === "CLOSED" ? "Completed" : "In Progress";
      const issueUrl = `https://github.com/${orgName?.toLowerCase() || 'evolvus'}/github-issue-manager/issues/${feature.number}`;
      doc.setTextColor(0, 0, 255);
      doc.text(`#${feature.number}`, 25, tableY);
      doc.link(25, tableY - 3, 20, 4, { url: issueUrl });
      doc.setTextColor(0, 0, 0);
      const titleLines = doc.splitTextToSize(feature.title, 90);
      doc.text(titleLines, 50, tableY);
      doc.text(status, 150, tableY);
      const maxLines = Math.max(1, titleLines.length);
      tableY += maxLines * 4 + 2;
      if (tableY > 250) {
        doc.addPage();
        tableY = 20;
      }
    });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page 2 of ${Math.max(2, bugs.length > 0 ? 3 : 2)}`, 20, 280);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 120, 280);
  }

  if (bugs.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Bug Fixes & Improvements", 20, 25);
    const sortedBugs = [...bugs].sort((a, b) => {
      if (a.state === "CLOSED" && b.state !== "CLOSED") return -1;
      if (a.state !== "CLOSED" && b.state === "CLOSED") return 1;
      return 0;
    });
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Issue #", 25, 40);
    doc.text("Title", 50, 40);
    doc.text("Status", 150, 40);
    let tableY = 45;
    doc.setFont("helvetica", "normal");
    sortedBugs.forEach((bug) => {
      const status = bug.state === "CLOSED" ? "Fixed" : "In Progress";
      const issueUrl = `https://github.com/${orgName?.toLowerCase() || 'evolvus'}/github-issue-manager/issues/${bug.number}`;
      doc.setTextColor(0, 0, 255);
      doc.text(`#${bug.number}`, 25, tableY);
      doc.link(25, tableY - 3, 20, 4, { url: issueUrl });
      doc.setTextColor(0, 0, 0);
      const titleLines = doc.splitTextToSize(bug.title, 90);
      doc.text(titleLines, 50, tableY);
      doc.text(status, 150, tableY);
      const maxLines = Math.max(1, titleLines.length);
      tableY += maxLines * 4 + 2;
      if (tableY > 250) {
        doc.addPage();
        tableY = 20;
      }
    });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page 3 of ${Math.max(3, other.length > 0 ? 4 : 3)}`, 20, 280);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 120, 280);
  }

  if (other.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Other Updates", 20, 25);
    const sortedOther = [...other].sort((a, b) => {
      if (a.state === "CLOSED" && b.state !== "CLOSED") return -1;
      if (a.state !== "CLOSED" && b.state === "CLOSED") return 1;
      return 0;
    });
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Issue #", 25, 40);
    doc.text("Title", 50, 40);
    doc.text("Status", 150, 40);
    let tableY = 45;
    doc.setFont("helvetica", "normal");
    sortedOther.forEach((issue) => {
      const status = issue.state === "CLOSED" ? "Completed" : "In Progress";
      const issueUrl = `https://github.com/${orgName?.toLowerCase() || 'evolvus'}/github-issue-manager/issues/${issue.number}`;
      doc.setTextColor(0, 0, 255);
      doc.text(`#${issue.number}`, 25, tableY);
      doc.link(25, tableY - 3, 20, 4, { url: issueUrl });
      doc.setTextColor(0, 0, 0);
      const titleLines = doc.splitTextToSize(issue.title, 90);
      doc.text(titleLines, 50, tableY);
      doc.text(status, 150, tableY);
      const maxLines = Math.max(1, titleLines.length);
      tableY += maxLines * 4 + 2;
      if (tableY > 250) {
        doc.addPage();
        tableY = 20;
      }
    });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page 4 of 4`, 20, 280);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 120, 280);
  }

  doc.save(`${sp.title}-release-notes.pdf`);
}

function renderPieDataURL(values = [], colors = [], size = 40) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;
    let start = -Math.PI / 2; // start at top
    values.forEach((v, i) => {
      const frac = v / total;
      const end = start + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      const col = colors[i] || [200, 200, 200];
      ctx.fillStyle = `rgb(${col[0]}, ${col[1]}, ${col[2]})`;
      ctx.fill();
      start = end;
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Pie render failed', e);
    return null;
  }
}


export default function SprintBoard({ sprint, isFullScreen, toggleFullScreen, handleDrop, orgName, token }) {
  const [clickedIssue, setClickedIssue] = useState(null);
  const [clickedIssueData, setClickedIssueData] = useState(null);
  const [showBurndown, setShowBurndown] = useState(false);
  const [showCFD, setShowCFD] = useState(false);
  const [showCycleLead, setShowCycleLead] = useState(false);
  const [showNotInBacklog, setShowNotInBacklog] = useState(false);

  if (!sprint) return null;

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

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl border shadow-sm mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                <a href={sprint.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {sprint.title}
                </a>
              </h1>
              <Button
                className="text-xs border px-3 py-1"
                onClick={() => downloadReleaseNotes(sprint, orgName)}
                title="Download Release Notes"
              >
                <Download className="w-4 h-4 mr-1" />
                Release Notes
              </Button>
              <Button
                className="text-xs border px-3 py-1"
                onClick={() => setShowBurndown(true)}
                title="Show Sprint Burndown"
              >
                <LineChartIcon className="w-4 h-4 mr-1" />
                Burndown
              </Button>
              <Button
                className="text-xs border px-3 py-1"
                onClick={() => setShowCFD(true)}
                title="Show Cumulative Flow Diagram"
              >
                <AreaChartIcon className="w-4 h-4 mr-1" />
                CFD
              </Button>
              <Button
                className="text-xs border px-3 py-1"
                onClick={() => setShowCycleLead(true)}
                title="Show Cycle/Lead Time"
              >
                <Clock3 className="w-4 h-4 mr-1" />
                Cycle/Lead
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {sprint.closed}/{sprint.open + sprint.closed} completed
              </Badge>
              <label className="flex items-center gap-1 text-xs text-gray-700 border rounded px-2 py-1 bg-white">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={showNotInBacklog}
                  onChange={(e) => setShowNotInBacklog(e.target.checked)}
                />
                Show "Not in backlog"
              </label>
              <Button
                className="text-xs border px-3 py-1"
                onClick={() => downloadIssuesExcel(sprint.issues || [], `${sprint.title}.xlsx`, sprint.title)}
                title="Export Sprint to Excel"
              >
                <Download className="w-4 h-4 mr-1" />
                Export Excel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullScreen}
                className="p-2"
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${((sprint.closed / (sprint.open + sprint.closed)) * 100 || 0)}%` }}
            />
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-600">
            {sprint.dueOn && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Due:</span>
                <span>{formatDateForHeader(sprint.dueOn)}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="font-medium">Progress:</span>
              <span>{Math.round((sprint.closed / (sprint.open + sprint.closed)) * 100 || 0)}%</span>
            </div>
            {sprint.description && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Description:</span>
                <span className="truncate max-w-md">{sprint.description}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`grid ${showNotInBacklog ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} md:grid-cols-3 sm:grid-cols-2 gap-6`}>
        {(showNotInBacklog ? sprint.grouped : sprint.grouped.filter(([s]) => s !== 'Not in backlog')).map(([status, list]) => (
          <div key={status} className="bg-white border rounded-xl shadow-sm">
            <div className="p-4 border-b bg-gray-50 rounded-t-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{status}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {list.length}
                  </Badge>
                  <Download
                    className="w-4 h-4 cursor-pointer"
                    onClick={() => downloadIssuesExcel(list, `${sprint.title}-${status}.xlsx`, status)}
                    title="Export this column to Excel"
                  />
                </div>
              </div>
            </div>
            <div className="p-2">
              <ul
                className={`space-y-3 pr-1 ${
                  isFullScreen ? "overflow-auto max-h-[calc(100vh-200px)]" : "overflow-visible max-h-none"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                  handleDrop(data.issueId, status);
                }}
              >
                {list.map((iss) => (
                  <div
                    key={iss.id}
                    className="relative cursor-pointer"
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "text/plain",
                        JSON.stringify({ issueId: iss.id })
                      )
                    }
                    onClick={() => handleIssueClick(iss)}
                  >
                    <IssueCard issue={iss} showMilestone={false} />
                  </div>
                ))}
              </ul>
            </div>
          </div>
        ))}
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
      {showBurndown && (
        <BurndownPopup sprint={sprint} onClose={() => setShowBurndown(false)} />
      )}
      {showCFD && (
        <CFDPopup sprint={sprint} onClose={() => setShowCFD(false)} />
      )}
      {showCycleLead && (
        <CycleLeadPopup sprint={sprint} token={token} onClose={() => setShowCycleLead(false)} />
      )}
    </div>
  );
}

function daysBetween(start, end) {
  const out = [];
  const d = new Date(start);
  while (d <= end) {
    out.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function getSprintWindow(sp) {
  // Prefer milestone due date's month; else infer from issues; else use current month
  let base = sp?.dueOn ? new Date(sp.dueOn) : null;
  if (!base) {
    const firstIssue = (sp?.issues || []).slice().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))[0];
    if (firstIssue) base = new Date(firstIssue.createdAt);
  }
  if (!base) base = new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { start, end };
}

function BurndownPopup({ sprint, onClose }) {
  if (!sprint) return null;
  const { start, end } = getSprintWindow(sprint);
  const days = (start && end) ? daysBetween(start, end) : [];
  const now = new Date();
  const isCurrentSprint = start && end && now >= start && now <= end;
  const todayKey = now.toISOString().slice(0,10);
  const startKey = start ? start.toISOString().slice(0,10) : null;

  let data = days.map((d) => {
    const endOfDay = new Date(d);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const open = sprint.issues.filter((i) => {
      const created = new Date(i.createdAt);
      const closed = i.closedAt ? new Date(i.closedAt) : null;
      return created < endOfDay && (!closed || closed >= endOfDay);
    }).length;
    return { date: d, open };
  });
  // Fallback: if everything is zero but there are issues, estimate from scope-completed
  if (data.every(r => r.open === 0) && (sprint.issues?.length || 0) > 0) {
    data = days.map((d) => {
      const endOfDay = new Date(d);
      endOfDay.setDate(endOfDay.getDate() + 1);
      const scope = sprint.issues.filter(i => new Date(i.createdAt) < endOfDay).length;
      const completed = sprint.issues.filter(i => i.closedAt && new Date(i.closedAt) < endOfDay).length;
      return { date: d, open: Math.max(0, scope - completed) };
    });
  }
  const startOpen = data[0]?.open || 0;
  const total = Math.max(1, data.length - 1);
  const series = data.map((row, idx) => ({
    ...row,
    ideal: Math.max(0, Math.round(startOpen - (startOpen * idx) / total)),
  }));

  const formatTick = (d) => {
    const day = d.slice(8, 10);
    const month = d.slice(5, 7);
    return `${day}/${month}`;
  };

  // Traffic-light status for current sprint vs ideal
  let rag = null;
  if (isCurrentSprint) {
    const todayRow = series.find(r => r.date === todayKey);
    if (todayRow) {
      const actual = todayRow.open;
      const ideal = todayRow.ideal;
      const tolerance = ideal * 0.1; // 10%
      rag = actual <= ideal ? 'GREEN' : (actual <= ideal + tolerance ? 'AMBER' : 'RED');
    }
  }
  const bandFill = rag==='RED' ? '#fecaca' : rag==='AMBER' ? '#fde68a' : rag==='GREEN' ? '#bbf7d0' : '#e5e7eb';

  return (
    <div className="fixed z-[9999] inset-0 bg-black bg-opacity-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white border rounded-lg shadow-2xl w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">Sprint Burndown — {sprint.title}</div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-4">
          {(!start || !end) ? (
            <div className="text-sm text-gray-500">No milestone due date found.</div>
          ) : (
            <div className="relative h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatTick} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {isCurrentSprint && startKey && (
                    <ReferenceArea x1={startKey} x2={todayKey} fill={bandFill} fillOpacity={0.25} />
                  )}
                  <Line type="monotone" dataKey="open" name="Remaining Issues" stroke="#3b82f6" />
                  <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#a3a3a3" strokeDasharray="5 5" />
                  {isCurrentSprint && (
                    <ReferenceLine x={todayKey} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Today', position: 'top', fill: '#ef4444', fontSize: 12 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
              {rag && (
                <div className="absolute top-2 right-2 bg-white/90 border rounded-md px-3 py-2 text-xs shadow-sm">
                  <div className="font-medium mb-1">Status: {rag}</div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${rag==='RED'?'bg-red-500 ring-2 ring-red-300':'bg-red-200'}`}></span>
                    <span className={`w-2.5 h-2.5 rounded-full ${rag==='AMBER'?'bg-amber-500 ring-2 ring-amber-300':'bg-amber-200'}`}></span>
                    <span className={`w-2.5 h-2.5 rounded-full ${rag==='GREEN'?'bg-green-500 ring-2 ring-green-300':'bg-green-200'}`}></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CFDPopup({ sprint, onClose }) {
  if (!sprint) return null;
  const { start, end } = getSprintWindow(sprint);
  const days = (start && end) ? daysBetween(start, end) : [];

  const classify = (issue) => {
    const st = (issue.project_status || '').toLowerCase();
    if (["ready", "in progress", "in review"].includes(st)) return 'inprogress';
    if (st === 'done' || issue.state === 'CLOSED') return 'done';
    return 'backlog';
  };

  const data = days.map(d => {
    const endOfDay = new Date(d);
    endOfDay.setDate(endOfDay.getDate() + 1);
    let backlog = 0, inprogress = 0, done = 0;
    for (const i of sprint.issues) {
      const created = new Date(i.createdAt);
      const closed = i.closedAt ? new Date(i.closedAt) : null;
      if (created >= endOfDay) continue; // not yet created
      if (closed && closed < endOfDay) { done++; continue; }
      const cls = classify(i);
      if (cls === 'inprogress') inprogress++; else backlog++;
    }
    return { date: d, backlog, inprogress, done };
  });

  const formatTick = (d) => {
    const day = d.slice(8,10);
    const mo = d.slice(5,7);
    return `${day}/${mo}`;
  };

  return (
    <div className="fixed z-[9999] inset-0 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">Cumulative Flow — {sprint.title}</div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-4">
          {(!start || !end) ? (
            <div className="text-sm text-gray-500">No milestone due date found.</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} stackOffset="expand">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatTick} />
                  <YAxis tickFormatter={(v)=>`${Math.round(v*100)}%`} />
                  <Tooltip formatter={(v)=>Array.isArray(v)?v[0]:v} />
                  <Legend />
                  <Area type="monotone" dataKey="backlog" name="Backlog" stackId="1" stroke="#9ca3af" fill="#e5e7eb" />
                  <Area type="monotone" dataKey="inprogress" name="In progress" stackId="1" stroke="#3b82f6" fill="#bfdbfe" />
                  <Area type="monotone" dataKey="done" name="Done" stackId="1" stroke="#22c55e" fill="#bbf7d0" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function daysBetweenNumbers(min, max, bins = 8) {
  const step = Math.max(1, Math.ceil((max - min) / bins));
  const edges = [];
  for (let v = min; v <= max; v += step) edges.push(v);
  return { edges, step };
}

function CycleLeadPopup({ sprint, token, onClose }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const closed = (sprint.issues || []).filter(i => i.closedAt);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = [];
        for (const iss of closed) {
          let assignedAt = null;
          try {
            const [owner, repo] = (iss.repository?.nameWithOwner || "").split("/");
            const full = token ? await fetchIssueWithTimeline(token, owner, repo, iss.number, { swr: true }) : null;
            const tl = full?.timelineItems || [];
            const assignEvt = tl.find(t => t.__typename === 'AssignedEvent');
            assignedAt = assignEvt?.createdAt || null;
          } catch {}
          const created = new Date(iss.createdAt);
          const closedAt = new Date(iss.closedAt);
          const leadDays = Math.max(0, Math.round((closedAt - created) / 86400000));
          const cycleStart = assignedAt ? new Date(assignedAt) : created;
          const cycleDays = Math.max(0, Math.round((closedAt - cycleStart) / 86400000));
          data.push({
            number: iss.number,
            title: iss.title,
            url: iss.url,
            leadDays,
            cycleDays,
          });
        }
        if (!cancelled) setRows(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [closed, token]);

  const leadVals = rows.map(r => r.leadDays);
  const cycleVals = rows.map(r => r.cycleDays);
  const leadAvg = leadVals.length ? Math.round(leadVals.reduce((a,b)=>a+b,0)/leadVals.length) : 0;
  const cycleAvg = cycleVals.length ? Math.round(cycleVals.reduce((a,b)=>a+b,0)/cycleVals.length) : 0;
  const leadMed = leadVals.length ? [...leadVals].sort((a,b)=>a-b)[Math.floor(leadVals.length/2)] : 0;
  const cycleMed = cycleVals.length ? [...cycleVals].sort((a,b)=>a-b)[Math.floor(cycleVals.length/2)] : 0;

  const histo = (vals) => {
    if (!vals.length) return [];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const { edges, step } = daysBetweenNumbers(min, max, 8);
    const out = edges.map((e,i)=>({
      bucket: i===edges.length-1 ? `${e}+` : `${e}-${e+step-1}`,
      count: vals.filter(v => v>=e && v<(e+step)).length,
    }));
    return out;
  };
  const leadHist = histo(leadVals);
  const cycleHist = histo(cycleVals);

  return (
    <div className="fixed z-[9999] inset-0 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">Cycle/Lead Time — {sprint.title}</div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-gray-500">Computing metrics…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="font-medium mb-2">Lead Time (days)</div>
                  <div className="text-sm text-gray-600 mb-2">Avg {leadAvg} • Median {leadMed} • n={leadVals.length}</div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={leadHist}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bucket" angle={-30} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium mb-2">Cycle Time (days)</div>
                  <div className="text-sm text-gray-600 mb-2">Avg {cycleAvg} • Median {cycleMed} • n={cycleVals.length}</div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cycleHist}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="bucket" angle={-30} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="font-medium mb-2">Closed Issues</div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-1 pr-2">Issue</th>
                        <th className="py-1 pr-2">Lead</th>
                        <th className="py-1 pr-2">Cycle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.number} className="border-t">
                          <td className="py-1 pr-2">
                            <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">#{r.number}</a> {r.title}
                          </td>
                          <td className="py-1 pr-2">{r.leadDays}d</td>
                          <td className="py-1 pr-2">{r.cycleDays}d</td>
                        </tr>
                      ))}
                      {!rows.length && (
                        <tr><td colSpan={3} className="py-2 text-gray-500">No closed issues in this sprint.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function BurnupPopup({ sprint, onClose }) {
  if (!sprint) return null;
  const { start, end } = getSprintWindow(sprint);
  const days = (start && end) ? daysBetween(start, end) : [];

  const inScope = (i) => {
    const st = (i.project_status || '').toLowerCase();
    return ['backlog','ready','in progress','in review','done'].includes(st);
  };

  const data = days.map(d => {
    const endOfDay = new Date(d);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const scope = sprint.issues.filter(i => new Date(i.createdAt) < endOfDay && inScope(i)).length;
    const completed = sprint.issues.filter(i => i.closedAt && new Date(i.closedAt) < endOfDay && inScope(i)).length;
    return { date: d, scope, completed };
  });

  const totalDays = Math.max(1, data.length - 1);
  const finalScope = data[data.length - 1]?.scope || 0;
  const ideal = data.map((row, idx) => ({ date: row.date, ideal: Math.round((finalScope * idx) / totalDays) }));
  const series = data.map((row, idx) => ({ ...row, ideal: ideal[idx].ideal }));

  const formatTick = (d) => {
    const day = d.slice(8,10);
    const mo = d.slice(5,7);
    return `${day}/${mo}`;
  };

  const now = new Date();
  const isCurrentSprint = start && end && now >= start && now <= end;
  const todayKey = now.toISOString().slice(0,10);

  return (
    <div className="fixed z-[9999] inset-0 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">Burnup — {sprint.title}</div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="p-4">
          {(!start || !end) ? (
            <div className="text-sm text-gray-500">No milestone due date found.</div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatTick} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="scope" name="Scope" stroke="#9ca3af" />
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" />
                  <Line type="monotone" dataKey="ideal" name="Ideal" stroke="#a3a3a3" strokeDasharray="5 5" />
                  {isCurrentSprint && (
                    <ReferenceLine x={todayKey} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Today', position: 'top', fill: '#ef4444', fontSize: 12 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
