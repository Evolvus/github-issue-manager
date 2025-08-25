import React, { useMemo, useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Download, Maximize2, Minimize2 } from "lucide-react";
import IssueCard, { ExpandedIssueCard } from "./IssueCard";
import jsPDF from "jspdf";

async function githubGraphQL(token, query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok || data.errors) {
    const msg = data.errors?.map(e => e.message).join("; ") || res.statusText;
    throw new Error(msg);
  }
  return data.data;
}

const ADD_TO_PROJECT = `
  mutation($projectId: ID!, $issueId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $issueId }) {
      item { id }
    }
  }
`;

const UPDATE_STATUS = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }
    ) {
      projectV2Item { id }
    }
  }
`;

const REMOVE_FROM_PROJECT = `
  mutation($projectId: ID!, $itemId: ID!) {
    deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
      deletedItemId
    }
  }
`;

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB");
}

function formatDateForHeader(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function splitIssues(issues) {
  const isFeature = (issue) => {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    const title = issue.title.toLowerCase();
    
    // Check labels for feature indicators
    const featureLabels = ['feature', 'enhancement', 'improvement', 'new', 'add', 'implement'];
    if (labels.some(l => featureLabels.some(fl => l.includes(fl)))) {
      return true;
    }
    
    // Check title for feature indicators
    const featureKeywords = ['add', 'implement', 'create', 'new', 'enhance', 'improve', 'feature', 'support', 'enable', 'introduce'];
    if (featureKeywords.some(keyword => title.includes(keyword))) {
      return true;
    }
    
    // Check for UI/UX improvements
    if (title.includes('ui') || title.includes('interface') || title.includes('user experience')) {
      return true;
    }
    
    return false;
  };
  
  const isBug = (issue) => {
    const labels = issue.labels.map(l => l.name.toLowerCase());
    const title = issue.title.toLowerCase();
    
    // Check labels for bug indicators
    const bugLabels = ['bug', 'fix', 'defect', 'issue', 'error', 'broken'];
    if (labels.some(l => bugLabels.some(bl => l.includes(bl)))) {
      return true;
    }
    
    // Check title for bug indicators
    const bugKeywords = ['fix', 'bug', 'error', 'issue', 'problem', 'crash', 'broken', 'defect', 'fail', 'not working', 'doesn\'t work'];
    if (bugKeywords.some(keyword => title.includes(keyword))) {
      return true;
    }
    
    // Check for specific error patterns
    if (title.includes('error') || title.includes('exception') || title.includes('fails')) {
      return true;
    }
    
    return false;
  };

  // Debug: Log categorization results
  if (import.meta.env.DEV) {
    console.log('Issue Categorization Debug:');
    issues.forEach(issue => {
      const feature = isFeature(issue);
      const bug = isBug(issue);
      console.log(`#${issue.number}: "${issue.title}" - Feature: ${feature}, Bug: ${bug}, Labels: [${issue.labels.map(l => l.name).join(', ')}]`);
    });
  }

  return {
    features: issues.filter(isFeature),
    bugs: issues.filter(isBug),
    other: issues.filter(i => !isFeature(i) && !isBug(i)),
  };
}

async function generateReleaseSummary(issues, orgName, versionName) {
  const { features, bugs, other } = splitIssues(issues);
  
  const openIssues = issues.filter(i => i.state === "OPEN");
  const closedIssues = issues.filter(i => i.state === "CLOSED");
  
  // Analyze issue titles to generate contextual summary
  const featureTitles = features.map(f => f.title.toLowerCase());
  const bugTitles = bugs.map(b => b.title.toLowerCase());
  
  // Generate contextual insights
  const getFeatureInsights = () => {
    if (features.length === 0) return "";
    
    const commonThemes = [];
    if (featureTitles.some(t => t.includes('ui') || t.includes('interface'))) commonThemes.push('user interface improvements');
    if (featureTitles.some(t => t.includes('api') || t.includes('endpoint'))) commonThemes.push('API enhancements');
    if (featureTitles.some(t => t.includes('performance') || t.includes('speed'))) commonThemes.push('performance optimizations');
    if (featureTitles.some(t => t.includes('security') || t.includes('auth'))) commonThemes.push('security enhancements');
    if (featureTitles.some(t => t.includes('mobile') || t.includes('responsive'))) commonThemes.push('mobile experience improvements');
    if (featureTitles.some(t => t.includes('dashboard') || t.includes('report'))) commonThemes.push('dashboard and reporting features');
    if (featureTitles.some(t => t.includes('integration') || t.includes('connect'))) commonThemes.push('third-party integrations');
    
    if (commonThemes.length > 0) {
      return `This release introduces ${commonThemes.join(', ')} to enhance the overall user experience and workflow efficiency.`;
    }
    return `This release adds ${features.length} new features to expand functionality and improve user workflows across the platform.`;
  };
  
  const getBugInsights = () => {
    if (bugs.length === 0) return "";
    
    const criticalBugs = bugs.filter(b => 
      b.title.toLowerCase().includes('critical') || 
      b.title.toLowerCase().includes('crash') ||
      b.title.toLowerCase().includes('error') ||
      b.title.toLowerCase().includes('security')
    ).length;
    
    const uiBugs = bugs.filter(b => 
      b.title.toLowerCase().includes('ui') || 
      b.title.toLowerCase().includes('display') ||
      b.title.toLowerCase().includes('visual')
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
    const closedFeatures = features.filter(f => f.state === "CLOSED").length;
    const closedBugs = bugs.filter(b => b.state === "CLOSED").length;
    const closedOther = other.filter(o => o.state === "CLOSED").length;
    
    return `Detailed Breakdown:
• Features: ${closedFeatures}/${features.length} completed (${features.length > 0 ? Math.round((closedFeatures / features.length) * 100) : 0}%)
• Bug Fixes: ${closedBugs}/${bugs.length} completed (${bugs.length > 0 ? Math.round((closedBugs / bugs.length) * 100) : 0}%)
• Other Updates: ${closedOther}/${other.length} completed (${other.length > 0 ? Math.round((closedOther / other.length) * 100) : 0}%)`;
  };
  
  const summary = `Release Summary for ${versionName}

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
${features.length > 0 ? getFeatureInsights() : ''}
${bugs.length > 0 ? getBugInsights() : ''}
${other.length > 0 ? `• ${other.length} additional improvements and optimizations for better system performance, documentation updates, and infrastructure enhancements` : ''}

${features.length > 0 || bugs.length > 0 ? 'This release represents a significant step forward in our development roadmap, focusing on both feature enhancements and system stability improvements to deliver a more robust and user-friendly platform.' : 'This release focuses on ongoing improvements and optimizations to maintain system quality, performance, and reliability while preparing for future enhancements.'}`;

  return summary;
}

async function downloadReleaseNotes(sp, orgName) {
  const { features, bugs, other } = splitIssues(sp.issues);
  const openIssues = sp.issues.filter(i => i.state === "OPEN");
  const closedIssues = sp.issues.filter(i => i.state === "CLOSED");
  
  const summary = await generateReleaseSummary(sp.issues, orgName, sp.title);

  const doc = new jsPDF();
  
  // Set up fonts and styles
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(orgName || "GitHub Organization", 20, 25);
  
  doc.setFontSize(16);
  doc.text("Release Notes", 20, 35);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Version: ${sp.title}`, 20, 45);
  doc.text(`Release Date: ${sp.dueOn ? formatDateForHeader(sp.dueOn) : 'TBD'}`, 20, 55);
  
  // Progress summary
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Release Progress", 20, 70);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Issues: ${sp.issues.length}`, 20, 78);
  doc.text(`Completed: ${closedIssues.length} (${Math.round((closedIssues.length / sp.issues.length) * 100)}%)`, 20, 86);
  doc.text(`In Progress: ${openIssues.length} (${Math.round((openIssues.length / sp.issues.length) * 100)}%)`, 20, 94);
  
  // Issue Categories Summary
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Issue Categories", 20, 108);
  doc.setFont("helvetica", "normal");
  doc.text(`Features & Enhancements: ${features.length}`, 20, 116);
  doc.text(`Bug Fixes: ${bugs.length}`, 20, 124);
  doc.text(`Other Updates: ${other.length}`, 20, 132);
  
  // Release Summary - Detailed version
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Release Summary", 20, 146);
  doc.setFont("helvetica", "normal");
  
  const summaryLines = doc.splitTextToSize(summary, 170);
  doc.text(summaryLines, 20, 154);
  
  let yPosition = 154 + (summaryLines.length * 5) + 10;
  
  // Footer for first page
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Page 1 of ${Math.max(2, features.length > 0 ? 3 : 2)}`, 20, 280);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 120, 280);
  
  // Start page 2 with Features Table
  if (features.length > 0) {
    doc.addPage();
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("New Features & Enhancements", 20, 25);
    
    // Sort features: completed first, then in progress
    const sortedFeatures = [...features].sort((a, b) => {
      if (a.state === "CLOSED" && b.state !== "CLOSED") return -1;
      if (a.state !== "CLOSED" && b.state === "CLOSED") return 1;
      return 0;
    });
    
    // Table header
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Issue #", 25, 40);
    doc.text("Title", 50, 40);
    doc.text("Status", 150, 40);
    let tableY = 45;
    
    // Table content
    doc.setFont("helvetica", "normal");
    sortedFeatures.forEach((feature, index) => {
      const status = feature.state === "CLOSED" ? "Completed" : "In Progress";
      
      // Add hyperlink to GitHub issue
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
    
    // Footer for features page
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page 2 of ${Math.max(2, bugs.length > 0 ? 3 : 2)}`, 20, 280);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 120, 280);
  }
  
  // Start page 3 with Bugs Table
  if (bugs.length > 0) {
    doc.addPage();
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Bug Fixes & Improvements", 20, 25);
    
    // Sort bugs: completed first, then in progress
    const sortedBugs = [...bugs].sort((a, b) => {
      if (a.state === "CLOSED" && b.state !== "CLOSED") return -1;
      if (a.state !== "CLOSED" && b.state === "CLOSED") return 1;
      return 0;
    });
    
    // Table header
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Issue #", 25, 40);
    doc.text("Title", 50, 40);
    doc.text("Status", 150, 40);
    let tableY = 45;
    
    // Table content
    doc.setFont("helvetica", "normal");
    sortedBugs.forEach((bug, index) => {
      const status = bug.state === "CLOSED" ? "Fixed" : "In Progress";
      
      // Add hyperlink to GitHub issue
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
    
    // Footer for bugs page
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page 3 of ${Math.max(3, other.length > 0 ? 4 : 3)}`, 20, 280);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 120, 280);
  }
  
  // Other Issues Table (if any)
  if (other.length > 0) {
    doc.addPage();
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Other Updates", 20, 25);
    
    // Sort other issues: completed first, then in progress
    const sortedOther = [...other].sort((a, b) => {
      if (a.state === "CLOSED" && b.state !== "CLOSED") return -1;
      if (a.state !== "CLOSED" && b.state === "CLOSED") return 1;
      return 0;
    });
    
    // Table header
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Issue #", 25, 40);
    doc.text("Title", 50, 40);
    doc.text("Status", 150, 40);
    let tableY = 45;
    
    // Table content
    doc.setFont("helvetica", "normal");
    sortedOther.forEach((issue, index) => {
      const status = issue.state === "CLOSED" ? "Completed" : "In Progress";
      
      // Add hyperlink to GitHub issue
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
    
    // Footer for other page
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Page 4 of 4`, 20, 280);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 120, 280);
  }
  
  doc.save(`${sp.title}-release-notes.pdf`);
}

export default function Sprints({ allIssues, orgMeta, projects, token }) {
  const [statusMap, setStatusMap] = useState(new Map());

  useEffect(() => {
    const map = new Map();
    projects?.forEach(project => {
      project.issues.forEach(i => {
        map.set(i.id, { status: i.project_status, itemId: i.project_item_id });
      });
    });
    setStatusMap(map);
  }, [projects]);

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
    const arr = Object.values(map).map(m => ({
      ...m,
      open: m.issues.filter(i => i.state === "OPEN").length,
      closed: m.issues.filter(i => i.state === "CLOSED").length,
    }));
    arr.sort((a, b) => new Date(b.dueOn || 0) - new Date(a.dueOn || 0));
    return arr;
  }, [allIssues]);

  const sprintData = useMemo(() => {
    const order = ["Not in backlog", "Backlog", "Ready", "In progress", "In review", "Done"];
    return sprints.map(sp => {
      const colMap = new Map(order.map(s => [s, []]));
      sp.issues.forEach(iss => {
        const entry = statusMap.get(iss.id);
        const status = entry?.status;
        const itemId = entry?.itemId;
        const issue = { ...iss, project_status: status || null, project_item_id: itemId || null };
        const key = status && order.includes(status) ? status : "Not in backlog";
        colMap.get(key).push(issue);
      });
      return { ...sp, grouped: order.map(s => [s, colMap.get(s)]) };
    });
  }, [sprints, statusMap]);

  const [activeTab, setActiveTab] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [clickedIssue, setClickedIssue] = useState(null);
  const [clickedIssueData, setClickedIssueData] = useState(null);

  const project = projects?.[0];
  const projectId = project?.id;
  const statusFieldId = project?.statusFieldId;
  const statusOptions = project?.statusOptions || {};
  
  useEffect(() => {
    if (sprintData.length) {
      setActiveTab(sprintData[0].id);
    }
  }, [sprintData]);

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleIssueClick = (issue) => {
    setClickedIssue(issue.id);
    setClickedIssueData(issue);
  };

  const handleClosePopup = () => {
    setClickedIssue(null);
    setClickedIssueData(null);
  };

  const handleDrop = async (issueId, newStatus) => {
    if (!token || !projectId) return;
    const current = statusMap.get(issueId);
    const currentItemId = current?.itemId;
    try {
      if (newStatus === "Not in backlog") {
        if (currentItemId) {
          await githubGraphQL(token, REMOVE_FROM_PROJECT, { projectId, itemId: currentItemId });
          const map = new Map(statusMap);
          map.delete(issueId);
          setStatusMap(map);
        }
      } else {
        let itemId = currentItemId;
        if (!itemId) {
          const res = await githubGraphQL(token, ADD_TO_PROJECT, { projectId, issueId });
          itemId = res.addProjectV2ItemById.item.id;
        }
        const optionId = statusOptions[newStatus];
        if (itemId && optionId && statusFieldId) {
          await githubGraphQL(token, UPDATE_STATUS, { projectId, itemId, fieldId: statusFieldId, optionId });
          const map = new Map(statusMap);
          map.set(issueId, { status: newStatus, itemId });
          setStatusMap(map);
        }
      }
    } catch (e) {
      console.error("Failed to move issue", e);
    }
  };

  if (!sprintData.length) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="text-sm text-gray-500">No data available.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`${isFullScreen ? 'fixed inset-0 z-50 bg-white p-6' : ''}`}>
      {/* Horizontal Milestone Tabs */}
      <div className="mb-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Milestones</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sprintData.map(sp => (
            <button
              key={sp.id}
              onClick={() => setActiveTab(sp.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-all duration-200 ${
                activeTab === sp.id
                  ? 'bg-blue-50 border-blue-200 shadow-sm text-blue-700'
                  : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700'
              }`}
            >
              <span className="text-sm font-medium whitespace-nowrap">
                {sp.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full">
        {sprintData.map(sp => (
          <div key={sp.id} className={activeTab === sp.id ? 'block' : 'hidden'}>
            {/* Enhanced Header with Milestone Details */}
            <div className="bg-white rounded-2xl border shadow-sm mb-6">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">
                      <a href={sp.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {sp.title}
                      </a>
                    </h1>
                    <Button
                      className="text-xs border px-3 py-1"
                      onClick={() => downloadReleaseNotes(sp, orgMeta?.name)}
                      title="Download Release Notes"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Release Notes
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      {sp.closed}/{sp.open + sp.closed} completed
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
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${((sp.closed / (sp.open + sp.closed)) * 100 || 0)}%` }}
                  />
                </div>
                
                {/* Milestone Details */}
                <div className="flex items-center gap-6 text-sm text-gray-600">
                  {sp.dueOn && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Due:</span>
                      <span>{formatDateForHeader(sp.dueOn)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Progress:</span>
                    <span>{Math.round((sp.closed / (sp.open + sp.closed)) * 100 || 0)}%</span>
                  </div>
                  {sp.description && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Description:</span>
                      <span className="truncate max-w-md">{sp.description}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Kanban Board */}
            <div className="grid lg:grid-cols-6 md:grid-cols-3 sm:grid-cols-2 gap-6">
              {sp.grouped.map(([status, list]) => (
                <div key={status} className="bg-white border rounded-xl shadow-sm">
                  <div className="p-4 border-b bg-gray-50 rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{status}</span>
                      <Badge variant="secondary" className="text-xs">{list.length}</Badge>
                    </div>
                  </div>
                  <div className="p-2">
                    <ul
                      className={`space-y-3 overflow-auto pr-1 ${
                        isFullScreen
                          ? 'max-h-[calc(100vh-200px)]'
                          : 'max-h-[calc(100vh-250px)]'
                      }`}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                        handleDrop(data.issueId, status);
                      }}
                    >
                      {list.map(iss => (
                        <div
                          key={iss.id}
                          className="relative cursor-pointer"
                          draggable
                          onDragStart={e =>
                            e.dataTransfer.setData(
                              'text/plain',
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
            
            {/* Floating Popup */}
            {clickedIssue && clickedIssueData && (
              <div 
                className="fixed z-[9999] inset-0 bg-black bg-opacity-50 flex items-center justify-center"
                onClick={handleClosePopup}
              >
                <div 
                  className="bg-white border rounded-lg shadow-2xl max-w-2xl max-h-[80vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExpandedIssueCard issue={clickedIssueData} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
