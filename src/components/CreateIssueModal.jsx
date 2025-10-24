import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import MultiSelect from "./ui/MultiSelect";

function buildProjectLabel(project) {
  if (!project) return "";
  const base = project.name || project.title || "Project";
  return `${base} (#${project.number})`;
}

export default function CreateIssueModal({
  open,
  onClose,
  repos,
  issueTypes,
  onSubmit,
  submitting = false,
  error = "",
}) {
  const [repositoryId, setRepositoryId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [labels, setLabels] = useState([]);
  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedProjectsV2, setSelectedProjectsV2] = useState([]);
  const [selectedIssueType, setSelectedIssueType] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setBody("");
      setAssignees([]);
      setLabels([]);
      setSelectedMilestone("");
      setSelectedProjects([]);
      setSelectedProjectsV2([]);
      setSelectedIssueType("");
      return;
    }
    if (repos?.length) {
      setRepositoryId((prev) => {
        if (prev && repos.some((r) => r.id === prev)) {
          return prev;
        }
        return repos[0].id;
      });
    } else {
      setRepositoryId("");
    }
  }, [open, repos]);

  useEffect(() => {
    if (!open) return;
    // Reset repository specific selections when repository changes
    setAssignees([]);
    setLabels([]);
    setSelectedMilestone("");
    setSelectedProjects([]);
    setSelectedProjectsV2([]);
  }, [repositoryId, open]);

  const selectedRepo = useMemo(
    () => repos.find((r) => r.id === repositoryId) || null,
    [repos, repositoryId]
  );

  const assigneeOptions = useMemo(
    () => (selectedRepo?.assignableUsers || []).map((u) => u.login).sort(),
    [selectedRepo]
  );

  const labelOptions = useMemo(
    () => (selectedRepo?.availableLabels || []).map((l) => l.name).sort(),
    [selectedRepo]
  );

  const milestoneOptions = useMemo(() => {
    const titles = (selectedRepo?.availableMilestones || []).map((m) => m.title);
    return titles.sort((a, b) => a.localeCompare(b));
  }, [selectedRepo]);

  const projectOptions = useMemo(() => {
    const labels = (selectedRepo?.availableProjects || []).map((p) => buildProjectLabel(p));
    return labels.sort((a, b) => a.localeCompare(b));
  }, [selectedRepo]);

  const projectV2Options = useMemo(() => {
    const labels = (selectedRepo?.availableProjectsV2 || []).map((p) => buildProjectLabel(p));
    return labels.sort((a, b) => a.localeCompare(b));
  }, [selectedRepo]);

  const repoOptions = useMemo(
    () => repos.map((r) => ({ id: r.id, label: r.nameWithOwner || r.name })),
    [repos]
  );

  const issueTypeOptions = useMemo(() => {
    const mapped = (issueTypes || []).map((t) => ({ id: t.id, name: t.name }));
    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  }, [issueTypes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!repositoryId || !title.trim()) return;
    const repo = selectedRepo;
    const assigneeIds = repo
      ? repo.assignableUsers
          .filter((u) => assignees.includes(u.login))
          .map((u) => u.id)
      : [];
    const labelIds = repo
      ? repo.availableLabels
          .filter((l) => labels.includes(l.name))
          .map((l) => l.id)
      : [];
    const milestoneId = repo
      ? repo.availableMilestones?.find((m) => m.title === selectedMilestone)?.id
      : null;
    const projectIds = repo
      ? repo.availableProjects
          .filter((p) => selectedProjects.includes(buildProjectLabel(p)))
          .map((p) => p.id)
      : [];
    const projectV2Ids = repo
      ? repo.availableProjectsV2
          .filter((p) => selectedProjectsV2.includes(buildProjectLabel(p)))
          .map((p) => p.id)
      : [];
    const issueTypeId = selectedIssueType
      ? issueTypeOptions.find((t) => t.name === selectedIssueType)?.id
      : undefined;

    try {
      await onSubmit({
        repositoryId,
        title: title.trim(),
        body,
        assigneeIds,
        labelIds,
        milestoneId: milestoneId || undefined,
        projectIds,
        projectV2Ids,
        issueTypeId,
      });
    } catch (err) {
      // Parent component handles error messaging; swallow to keep modal open
    }
  };

  if (!open) return null;

  const disableSubmit = submitting || !repositoryId || !title.trim();

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">New Issue</h2>
          <button
            type="button"
            className="p-2 rounded hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm font-medium flex flex-col gap-2">
              Repository
              <select
                value={repositoryId}
                onChange={(e) => setRepositoryId(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
                required
                disabled={!repoOptions.length}
              >
                {!repoOptions.length ? (
                  <option value="" disabled>
                    No repositories available
                  </option>
                ) : (
                  repoOptions.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="text-sm font-medium flex flex-col gap-2">
              Issue type
              <select
                value={selectedIssueType}
                onChange={(e) => setSelectedIssueType(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">Select type</option>
                {issueTypeOptions.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm font-medium flex flex-col gap-2">
            Title
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Provide a concise title"
              required
            />
          </label>

          <label className="text-sm font-medium flex flex-col gap-2">
            Description
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write in Markdown"
              rows={8}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Assignees</span>
              <MultiSelect
                options={assigneeOptions}
                value={assignees}
                onChange={setAssignees}
                placeholder="Select assignees"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Labels</span>
              <MultiSelect
                options={labelOptions}
                value={labels}
                onChange={setLabels}
                placeholder="Select labels"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm font-medium flex flex-col gap-2">
              Milestone
              <select
                value={selectedMilestone}
                onChange={(e) => setSelectedMilestone(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">No milestone</option>
                {milestoneOptions.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Projects</span>
              <MultiSelect
                options={projectOptions}
                value={selectedProjects}
                onChange={setSelectedProjects}
                placeholder="Select classic projects"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Projects (Beta)</span>
            <MultiSelect
              options={projectV2Options}
              value={selectedProjectsV2}
              onChange={setSelectedProjectsV2}
              placeholder="Select projects"
            />
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={disableSubmit}>
              {submitting ? "Creating..." : "Create issue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
