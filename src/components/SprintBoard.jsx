import React, { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import IssueCard, { IssueOverlayCard } from "./IssueCard";
import jsPDF from "jspdf";
import { fetchIssueWithTimeline } from "../api/github";

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

This comprehensive release includes ${issues.length} total issues across multiple categories:
• ${features.length} new features and enhancements
• ${bugs.length} bug fixes and improvements
• ${other.length} other updates and optimizations

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
  doc.setFont("helvetica", "normal");
  doc.text(`Total Issues: ${sp.issues.length}`, 20, 78);
  doc.text(`Completed: ${closedIssues.length} (${Math.round((closedIssues.length / sp.issues.length) * 100)}%)`, 20, 86);
  doc.text(`In Progress: ${openIssues.length} (${Math.round((openIssues.length / sp.issues.length) * 100)}%)`, 20, 94);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Issue Categories", 20, 108);
  doc.setFont("helvetica", "normal");
  doc.text(`Features & Enhancements: ${features.length}`, 20, 116);
  doc.text(`Bug Fixes: ${bugs.length}`, 20, 124);
  doc.text(`Other Updates: ${other.length}`, 20, 132);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Release Summary", 20, 146);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(summary, 170);
  doc.text(summaryLines, 20, 154);
  let yPosition = 154 + summaryLines.length * 5 + 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Page 1 of ${Math.max(2, features.length > 0 ? 3 : 2)}`, 20, 280);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 120, 280);

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
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 120, 280);
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
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 120, 280);
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
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 120, 280);
  }

  doc.save(`${sp.title}-release-notes.pdf`);
}


export default function SprintBoard({ sprint, isFullScreen, toggleFullScreen, handleDrop, orgName, token }) {
  const [clickedIssue, setClickedIssue] = useState(null);
  const [clickedIssueData, setClickedIssueData] = useState(null);

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
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {sprint.closed}/{sprint.open + sprint.closed} completed
              </Badge>
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

      <div className="grid lg:grid-cols-6 md:grid-cols-3 sm:grid-cols-2 gap-6">
        {sprint.grouped.map(([status, list]) => (
          <div key={status} className="bg-white border rounded-xl shadow-sm">
            <div className="p-4 border-b bg-gray-50 rounded-t-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{status}</span>
                <Badge variant="secondary" className="text-xs">
                  {list.length}
                </Badge>
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
    </div>
  );
}
