import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import MilestoneTabs from "./MilestoneTabs";
import SprintBoard from "./SprintBoard";

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

  const activeSprint = sprintData.find(sp => sp.id === activeTab);

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
      <MilestoneTabs sprints={sprintData} activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeSprint && (
        <SprintBoard
          sprint={activeSprint}
          isFullScreen={isFullScreen}
          toggleFullScreen={toggleFullScreen}
          handleDrop={handleDrop}
          orgName={orgMeta?.name}
          token={token}
        />
      )}
    </div>
  );
}
