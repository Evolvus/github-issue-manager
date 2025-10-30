import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, GitBranch, ArrowLeft, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { createIssue, fetchRepoIssueMetadata } from "../api/github";

function SidebarSection({ title, summary, onToggle, open, children, error }) {
  let summaryNode = null;
  if (summary) {
    summaryNode =
      typeof summary === "string" ? (
        <p className="text-xs text-gray-500 leading-5">{summary}</p>
      ) : (
        summary
      );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <div className="mt-1 space-y-1">
            {summaryNode}
            {error ? <p className="text-xs text-red-600 leading-5">{error}</p> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-medium text-blue-600 hover:text-blue-500"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open && <div className="border-t border-gray-200 px-4 py-3 text-sm">{children}</div>}
    </div>
  );
}

function SelectionList({
  items,
  selectedIds,
  onToggle,
  multiple = true,
  loading,
  emptyText,
  name,
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }
  if (!items.length) {
    return <div className="text-sm text-gray-500">{emptyText}</div>;
  }
  return (
    <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {items.map((item) => {
        const checked = selectedIds.includes(item.id);
        return (
          <li key={item.id}>
            <label className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-gray-50">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={multiple ? undefined : name || "selection"}
                className="mt-1 h-4 w-4 text-blue-600"
                checked={checked}
                onChange={() => onToggle(item.id)}
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {item.name || item.login || item.title}
                </p>
                {item.secondary ? (
                  <p className="text-xs text-gray-500">{item.secondary}</p>
                ) : null}
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function WritePreviewToggle({ active, onChange }) {
  const options = [
    { key: "write", label: "Write" },
    { key: "preview", label: "Preview" },
  ];
  const index = options.findIndex((option) => option.key === active);
  return (
    <div className="relative inline-flex rounded-full bg-gray-200 p-1 text-sm font-medium">
      <span
        className="absolute inset-y-1 w-1/2 rounded-full bg-white shadow transition-transform"
        style={{ transform: `translateX(${Math.max(0, index) * 100}%)` }}
      />
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`relative z-10 px-4 py-1.5 transition-colors ${
            active === option.key ? "text-gray-900" : "text-gray-600"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TemplateOption({ option, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      className={`relative flex w-full flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">{option.name}</span>
        {isSelected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
            <Check className="h-3 w-3" />
            Selected
          </span>
        ) : null}
      </div>
      {option.description ? (
        <p className="text-xs text-gray-500">{option.description}</p>
      ) : null}
    </button>
  );
}

const getFieldLabel = (field) =>
  field?.label || field?.name || (field?.type && field.type !== "markdown" ? "Field" : "");

const getOptionLabel = (field, value) => {
  if (!field?.options?.length) return value;
  const match = field.options.find(
    (opt) => opt.value === value || opt.label === value
  );
  return match ? match.label : value;
};

const toOptionValue = (field, value) => {
  if (!field?.options?.length) return value;
  const match = field.options.find(
    (opt) => opt.value === value || opt.label === value
  );
  return match ? match.value : value;
};

const toOptionArray = (field, values) => {
  if (!Array.isArray(values)) return [];
  const resolved = values
    .map((value) => toOptionValue(field, value))
    .filter(Boolean);
  return Array.from(new Set(resolved));
};

const buildInitialResponsesFromTemplate = (template) => {
  if (!template?.formFields?.length) return {};
  const responses = {};
  template.formFields.forEach((field) => {
    switch (field.type) {
      case "markdown":
      case "attachments":
      case "contributors":
        break;
      case "checkboxes":
      case "multiselect": {
        responses[field.id] = toOptionArray(field, field.defaultValue || []);
        break;
      }
      case "dropdown": {
        if (field.multiple) {
          responses[field.id] = toOptionArray(field, field.defaultValue || []);
        } else {
          const value =
            typeof field.defaultValue === "string"
              ? toOptionValue(field, field.defaultValue)
              : "";
          responses[field.id] = value || "";
        }
        break;
      }
      default: {
        responses[field.id] =
          field.defaultValue != null ? String(field.defaultValue) : "";
      }
    }
  });
  return responses;
};

const formatSection = (label, content) => {
  const sanitizedLabel = label && label !== "Field" ? label : "";
  const sanitizedContent =
    content && String(content).trim().length ? String(content).trim() : "_No response_";
  if (sanitizedLabel) {
    return `### ${sanitizedLabel}\n\n${sanitizedContent}`;
  }
  return sanitizedContent;
};

const generateFormMarkdown = (fields = [], responses = {}) => {
  if (!Array.isArray(fields) || !fields.length) return "";
  const sections = [];
  fields.forEach((field) => {
    const label = getFieldLabel(field);
    switch (field.type) {
      case "markdown":
      case "attachments":
      case "contributors": {
        // Instructions or GitHub-only fields; omit from final issue body
        break;
      }
      case "checkboxes":
      case "multiselect": {
        const selected = toOptionArray(field, responses[field.id] || []);
        const content = selected.length
          ? selected.map((value) => `- ${getOptionLabel(field, value)}`).join("\n")
          : "_No response_";
        sections.push(formatSection(label, content));
        break;
      }
      case "dropdown": {
        if (field.multiple) {
          const selected = toOptionArray(field, responses[field.id] || []);
          const content = selected.length
            ? selected.map((value) => `- ${getOptionLabel(field, value)}`).join("\n")
            : "_No response_";
          sections.push(formatSection(label, content));
        } else {
          const value = responses[field.id];
          const formatted = value ? getOptionLabel(field, value) : "_No response_";
          sections.push(formatSection(label, formatted));
        }
        break;
      }
      case "textarea":
      case "input":
      case "number": {
        sections.push(formatSection(label, responses[field.id] || ""));
        break;
      }
      default: {
        sections.push(formatSection(label, responses[field.id] || ""));
      }
    }
  });
  return sections.join("\n\n").trim();
};

const validateFormResponses = (fields = [], responses = {}) => {
  const errors = {};
  fields.forEach((field) => {
    const value = responses[field.id];
    switch (field.type) {
      case "markdown":
      case "attachments":
      case "contributors":
        break;
      case "checkboxes":
      case "multiselect": {
        const selected = toOptionArray(field, value || []);
        if (field.required && !selected.length) {
          errors[field.id] = "Select at least one option.";
          return;
        }
        if (field.options?.length) {
          const missingRequired = field.options.filter(
            (option) =>
              option.required &&
              !selected.some(
                (val) => option.value === val || option.label === val
              )
          );
          if (missingRequired.length) {
            const labels = missingRequired.map((opt) => opt.label).join(", ");
            errors[field.id] = `Include required option: ${labels}.`;
          }
        }
        break;
      }
      case "dropdown": {
        if (field.multiple) {
          const selected = toOptionArray(field, value || []);
          if (field.required && !selected.length) {
            errors[field.id] = "Select at least one option.";
          }
        } else if (field.required) {
          const selected = value ? String(value).trim() : "";
          if (!selected) {
            errors[field.id] = "Select an option.";
          }
        }
        break;
      }
      case "number": {
        const stringValue = value != null ? String(value).trim() : "";
        if (!stringValue) {
          if (field.required) {
            errors[field.id] = "This field is required.";
          }
          return;
        }
        const asNumber = Number(stringValue);
        if (Number.isNaN(asNumber)) {
          errors[field.id] = "Enter a valid number.";
          return;
        }
        if (
          field.validations?.min != null &&
          asNumber < Number(field.validations.min)
        ) {
          errors[field.id] = `Value must be at least ${field.validations.min}.`;
          return;
        }
        if (
          field.validations?.max != null &&
          asNumber > Number(field.validations.max)
        ) {
          errors[field.id] = `Value must be at most ${field.validations.max}.`;
        }
        break;
      }
      default: {
        const stringValue = value != null ? String(value).trim() : "";
        if (field.required && !stringValue) {
          errors[field.id] = "This field is required.";
        } else if (field.validations?.pattern && stringValue) {
          try {
            const pattern = new RegExp(field.validations.pattern);
            if (!pattern.test(stringValue)) {
              errors[field.id] = "Value does not match required format.";
            }
          } catch {
            // ignore invalid patterns
          }
        }
      }
    }
  });
  return errors;
};

function FormFieldRenderer({ field, value, onChange }) {
  switch (field.type) {
    case "markdown":
      return (
        <div className="prose prose-sm max-w-none text-gray-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {field.content || ""}
          </ReactMarkdown>
        </div>
      );
    case "attachments":
    case "contributors":
      return (
        <div className="text-sm text-gray-600 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
          {field.description ||
            (field.type === "attachments"
              ? "Attach relevant files to your issue before submitting."
              : "Mention any contributors directly in the issue description.")}
        </div>
      );
    case "checkboxes":
    case "multiselect":
      return (
        <div className="space-y-2">
          {field.options.map((option) => {
            const selected = Array.isArray(value) ? value : [];
            const isChecked = selected.some(
              (val) => val === option.value || val === option.label
            );
            const handleToggle = () => {
              const optionValue = toOptionValue(field, option.value);
              const next = isChecked
                ? selected.filter(
                    (val) => val !== optionValue && val !== option.label
                  )
                : [...selected, optionValue];
              onChange(toOptionArray(field, next));
            };
            return (
              <label
                key={option.id || option.value}
                className="flex items-start gap-2 rounded-md border border-transparent px-2 py-2 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-blue-600"
                  checked={isChecked}
                  onChange={handleToggle}
                />
                <div className="text-sm text-gray-800">
                  <p className="font-medium">
                    {option.label}
                    {option.required ? (
                      <span className="ml-1 text-xs font-medium text-red-500">
                        (required)
                      </span>
                    ) : null}
                  </p>
                  {option.description ? (
                    <p className="text-xs text-gray-500">{option.description}</p>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      );
    case "dropdown": {
      if (field.multiple) {
        return (
          <FormFieldRenderer
            field={{ ...field, type: "multiselect" }}
            value={value}
            onChange={onChange}
          />
        );
      }
      return (
        <select
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-200"
          value={value || ""}
          onChange={(e) => onChange(toOptionValue(field, e.target.value))}
        >
          <option value="">Select an option</option>
          {field.options.map((option) => (
            <option key={option.id || option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    case "textarea":
      return (
        <textarea
          className="min-h-[160px] w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-200"
          placeholder={field.placeholder || "Enter details"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          placeholder={field.placeholder || "Enter a number"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "input":
    default:
      return (
        <Input
          placeholder={field.placeholder || "Enter text"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export default function CreateIssue({ org, token, repos, loadData }) {
  const navigate = useNavigate();
  const metadataCache = useRef(new Map());
  const lastReposRef = useRef(repos);
  const [selectedRepoId, setSelectedRepoId] = useState(repos?.[0]?.id || "");
  const [metadata, setMetadata] = useState(null);
  const [metaError, setMetaError] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [activeTab, setActiveTab] = useState("write");
  const [labelIds, setLabelIds] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [projectIds, setProjectIds] = useState([]);
  const [milestoneId, setMilestoneId] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [formResponses, setFormResponses] = useState({});
  const [formFieldErrors, setFormFieldErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdIssue, setCreatedIssue] = useState(null);

  const [assigneesOpen, setAssigneesOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);

  useEffect(() => {
    if (repos.length) {
      lastReposRef.current = repos;
    }
  }, [repos]);

  const repoOptions = repos.length ? repos : lastReposRef.current || [];

  const repo = useMemo(
    () => repoOptions.find((r) => r.id === selectedRepoId),
    [repoOptions, selectedRepoId]
  );

  useEffect(() => {
    if (!repoOptions.length) return;
    const exists = repoOptions.some((r) => r.id === selectedRepoId);
    if (!exists) {
      setSelectedRepoId(repoOptions[0].id);
    }
  }, [repoOptions, selectedRepoId]);

  useEffect(() => {
    if (!repo || !token) {
      setMetadata(null);
      return;
    }
    const cacheKey = repo.nameWithOwner;
    if (metadataCache.current.has(cacheKey)) {
      setMetadata(metadataCache.current.get(cacheKey));
      setMetaError("");
      return;
    }
    setLoadingMeta(true);
    setMetaError("");
    setMetadata(null);
    const [owner, name] = repo.nameWithOwner.split("/");
    fetchRepoIssueMetadata(token, owner, name)
      .then((data) => {
        metadataCache.current.set(cacheKey, data);
        setMetadata(data);
      })
      .catch((err) => {
        setMetaError(err.message || "Unable to load repository metadata.");
      })
      .finally(() => {
        setLoadingMeta(false);
      });
  }, [repo, token]);

  useEffect(() => {
    setTitle("");
    setBody("");
    setActiveTab("write");
    setLabelIds([]);
    setAssigneeIds([]);
    setProjectIds([]);
    setMilestoneId("");
    setSelectedTemplateKey("");
    setSelectedTemplate(null);
    setValidationErrors({});
    setAssigneesOpen(false);
    setLabelsOpen(false);
    setProjectsOpen(false);
    setMilestonesOpen(false);
    setCreatedIssue(null);
    setSubmitError("");
    setFormResponses({});
    setFormFieldErrors({});
  }, [selectedRepoId]);

  const clearValidationError = (field) => {
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const templateOptions = useMemo(() => {
    const templates = metadata?.issueTemplates || [];
    const items = templates.map((template, index) => ({
      key: template.name || template.title || `template-${index}`,
      name: template.name || template.title || `Template ${index + 1}`,
      description: template.description || "",
      body: template.body || "",
      title: template.title || "",
      formFields: template.formFields || [],
      isForm: !!(template.formFields && template.formFields.length),
      isBlank: false,
    }));
    items.push({
      key: "__blank__",
      name: "Blank issue",
      description: "Start with an empty issue.",
      body: "",
      title: "",
      formFields: [],
      isForm: false,
      isBlank: true,
    });
    return items;
  }, [metadata]);

  useEffect(() => {
    if (!templateOptions.length) return;
    const hasSelection = templateOptions.some((option) => option.key === selectedTemplateKey);
    if (hasSelection) return;
    const defaultOption = templateOptions.find((option) => !option.isBlank) || templateOptions[0];
    if (!defaultOption) return;
    setSelectedTemplateKey(defaultOption.key);
    setSelectedTemplate(defaultOption);
    setActiveTab("write");
    setBody(defaultOption.body || "");
    if (defaultOption.title && !title.trim()) {
      setTitle(defaultOption.title);
    }
    setValidationErrors((prev) => {
      if (!prev.template) return prev;
      const { template: _removed, ...rest } = prev;
      return rest;
    });
  }, [templateOptions, selectedTemplateKey, title]);

  useEffect(() => {
    if (selectedTemplate?.formFields?.length) {
      setFormResponses(buildInitialResponsesFromTemplate(selectedTemplate));
      setFormFieldErrors({});
    } else {
      setFormResponses({});
      setFormFieldErrors({});
    }
  }, [selectedTemplate]);

  const selectedLabels = useMemo(() => {
    if (!metadata) return [];
    return metadata.labels.filter((label) => labelIds.includes(label.id));
  }, [metadata, labelIds]);

  const selectedAssignees = useMemo(() => {
    if (!metadata) return [];
    return metadata.assignees.filter((user) => assigneeIds.includes(user.id));
  }, [metadata, assigneeIds]);

  const selectedProjects = useMemo(() => {
    if (!metadata) return [];
    return metadata.projects.filter((project) => projectIds.includes(project.id));
  }, [metadata, projectIds]);

  const selectedMilestone = useMemo(() => {
    if (!metadata || !milestoneId) return null;
    return metadata.milestones.find((mile) => mile.id === milestoneId) || null;
  }, [metadata, milestoneId]);

  const metadataLoaded = !!metadata && !loadingMeta && !metaError;

  const summaryText = (items, empty, formatter = (item) => item.name || item.login || item.title) =>
    items.length ? items.map(formatter).join(", ") : empty;

  const formFields = selectedTemplate?.formFields || [];
  const isFormTemplate = formFields.length > 0;
  const formPreviewBody = useMemo(() => {
    if (!isFormTemplate) return "";
    return generateFormMarkdown(formFields, formResponses);
  }, [isFormTemplate, formFields, formResponses]);

  const handleToggle = (setter, field) => (id) =>
    setter((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (field && next.length) {
        clearValidationError(field);
      }
      return next;
    });

  const handleFormFieldChange = (field, nextValue) => {
    setFormResponses((prev) => ({
      ...prev,
      [field.id]: nextValue,
    }));
    setFormFieldErrors((prev) => {
      if (!prev[field.id]) return prev;
      const { [field.id]: _removed, ...rest } = prev;
      return rest;
    });
    setValidationErrors((prev) => {
      if (!prev.form) return prev;
      const { form: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleMilestoneToggle = (id) => {
    setMilestoneId((prev) => {
      const next = prev === id ? "" : id;
      if (next) {
        clearValidationError("milestone");
      }
      return next;
    });
  };

  const handleTemplateSelect = (option) => {
    const changed = selectedTemplateKey !== option.key;
    setSelectedTemplateKey(option.key);
    setSelectedTemplate(option);
    setActiveTab("write");
    setBody(option.body || "");
    if (option.formFields?.length) {
      setFormResponses(buildInitialResponsesFromTemplate(option));
      setFormFieldErrors({});
    } else {
      setFormResponses({});
      setFormFieldErrors({});
    }
    if (changed && option.title) {
      setTitle(option.title);
    } else if (!title.trim()) {
      setTitle(option.title || "");
    }
    clearValidationError("template");
    setValidationErrors((prev) => {
      if (!prev.form) return prev;
      const { form: _removed, ...rest } = prev;
      return rest;
    });
  };

  const resetForm = () => {
    setTitle(selectedTemplate?.title || "");
    setBody(selectedTemplate?.body || "");
    if (isFormTemplate) {
      setFormResponses(buildInitialResponsesFromTemplate(selectedTemplate));
    } else {
      setFormResponses({});
    }
    setFormFieldErrors({});
    setLabelIds([]);
    setAssigneeIds([]);
    setProjectIds([]);
    setMilestoneId("");
    setValidationErrors({});
    setActiveTab("write");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!repo || !token || submitting) return;
    const errors = {};
    let templateFieldErrors = {};
    if (!selectedTemplateKey) errors.template = "Select an issue template to continue.";
    if (!assigneeIds.length) errors.assignees = "Assign this issue to at least one person.";
    if (!projectIds.length) errors.projects = "Add this issue to at least one project.";
    if (!milestoneId) errors.milestone = "Choose a milestone for this issue.";
    if (!title.trim()) errors.title = "Title is required.";

    if (isFormTemplate) {
      templateFieldErrors = validateFormResponses(formFields, formResponses);
      if (Object.keys(templateFieldErrors).length) {
        errors.form = "Complete the required fields for this template.";
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    const hasFieldErrors = Object.keys(templateFieldErrors).length > 0;

    if (hasErrors || hasFieldErrors) {
      setValidationErrors(errors);
      setFormFieldErrors(templateFieldErrors);
      if (errors.assignees) setAssigneesOpen(true);
      if (errors.projects) setProjectsOpen(true);
      if (errors.milestone) setMilestonesOpen(true);
      return;
    }

    setValidationErrors({});
    setFormFieldErrors({});

    const finalBody = isFormTemplate ? formPreviewBody.trim() : body;

    setSubmitError("");
    setSubmitting(true);
    setCreatedIssue(null);
    try {
      const input = {
        repositoryId: repo.id,
        title: title.trim(),
        body: finalBody,
      };
      if (labelIds.length) input.labelIds = labelIds;
      if (assigneeIds.length) input.assigneeIds = assigneeIds;
      if (projectIds.length) input.projectIds = projectIds;
      if (milestoneId) input.milestoneId = milestoneId;

      const issue = await createIssue(token, input);
      setCreatedIssue(issue);
      resetForm();
      if (typeof loadData === "function") {
        loadData();
      }
    } catch (err) {
      setSubmitError(err.message || "Failed to create issue.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (!token || !org) {
    return (
      <div className="max-w-3xl mx-auto mt-10 text-center space-y-3">
        <p className="text-lg font-semibold text-gray-800">Connect to GitHub</p>
        <p className="text-sm text-gray-500">
          Enter your organization and token above, then load data to create a new issue.
        </p>
        <div>
          <Button onClick={() => navigate("/")} className="bg-black text-white">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!repoOptions.length) {
    return (
      <div className="max-w-3xl mx-auto mt-10 text-center space-y-3">
        <p className="text-lg font-semibold text-gray-800">No repositories loaded.</p>
        <p className="text-sm text-gray-500">
          Use the controls in the header to load repositories before creating an issue.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="mt-3 text-2xl font-semibold text-gray-900">New issue</h2>
          <p className="text-sm text-gray-500">
            in {repo ? <span className="font-medium text-gray-700">{repo.nameWithOwner}</span> : "repository"}
          </p>
        </div>
        <div className="sm:text-right">
          <label className="text-xs uppercase tracking-wide text-gray-500 block mb-1">
            Repository
          </label>
          <select
            className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
          >
            {repoOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nameWithOwner}
              </option>
            ))}
          </select>
        </div>
      </div>

      {submitError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      {createdIssue ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Issue{" "}
          <a
            className="font-semibold underline"
            href={createdIssue.url}
            target="_blank"
            rel="noreferrer"
          >
            #{createdIssue.number} {createdIssue.title}
          </a>{" "}
          created successfully.
          <Button
            type="button"
            className="bg-white text-green-700 border border-green-300 px-3 py-1 rounded-md text-xs"
            onClick={() => window.open(createdIssue.url, "_blank")}
          >
            Open on GitHub
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-5">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">Choose a template</h3>
              <p className="mt-1 text-xs text-gray-500">
                Select an issue template to pre-fill the description. Blank issue is available if you prefer to start from scratch.
              </p>
            </div>
            <div className="space-y-3 p-4">
              {loadingMeta && !metadata ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading templates…</span>
                </div>
              ) : null}
              {metaError ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {metaError}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {templateOptions.map((option) => (
                  <TemplateOption
                    key={option.key}
                    option={option}
                    isSelected={selectedTemplateKey === option.key}
                    onSelect={handleTemplateSelect}
                  />
                ))}
              </div>
              {validationErrors.template ? (
                <p className="text-sm text-red-600">{validationErrors.template}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) {
                    clearValidationError("title");
                  }
                }}
                className="w-full border-none px-0 focus-visible:ring-0 focus-visible:outline-none text-lg font-medium"
              />
              {validationErrors.title ? (
                <p className="mt-1 text-xs text-red-600">{validationErrors.title}</p>
              ) : null}
            </div>
            <div className="px-4 py-3 space-y-4">
              {isFormTemplate ? (
                <>
                  {validationErrors.form ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                      {validationErrors.form}
                    </div>
                  ) : null}
                  {formFields.map((field) => {
                    const label = getFieldLabel(field);
                    const isMarkdown = field.type === "markdown";
                    return (
                      <div key={field.id} className="space-y-2">
                        {!isMarkdown && label && label !== "Field" ? (
                          <label className="flex items-center gap-1 text-sm font-medium text-gray-800">
                            {label}
                            {field.required ? (
                              <span className="text-xs font-semibold text-red-500">*</span>
                            ) : null}
                          </label>
                        ) : null}
                        <FormFieldRenderer
                          field={field}
                          value={formResponses[field.id]}
                          onChange={(val) => handleFormFieldChange(field, val)}
                        />
                        {!isMarkdown && field.description ? (
                          <p className="text-xs text-gray-500">{field.description}</p>
                        ) : null}
                        {!isMarkdown && formFieldErrors[field.id] ? (
                          <p className="text-xs text-red-600">{formFieldErrors[field.id]}</p>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className="rounded-md border border-gray-200">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Preview
                    </div>
                    <div className="prose prose-sm max-w-none px-3 py-3">
                      {formPreviewBody.trim().length ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {formPreviewBody}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-sm text-gray-500">Fill in the form to see a preview.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <WritePreviewToggle active={activeTab} onChange={setActiveTab} />
                    <div className="text-xs text-gray-500">Styling with Markdown is supported.</div>
                  </div>
                  <div className="rounded-md border border-gray-200">
                    {activeTab === "write" ? (
                      <textarea
                        className="min-h-[260px] w-full resize-y rounded-md border-0 px-3 py-3 text-sm focus:outline-none focus:ring-0"
                        placeholder="Leave a comment"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                      />
                    ) : (
                      <div className="prose prose-sm max-w-none px-3 py-3">
                        {body.trim().length ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {body}
                          </ReactMarkdown>
                        ) : (
                          <p className="text-sm text-gray-500">Nothing to preview.</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Submit new issue"
              )}
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg"
            >
              Cancel
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <SidebarSection
            title="Assignees"
            summary={
              metaError
                ? metaError
                : metadataLoaded
                ? summaryText(
                    selectedAssignees,
                    metadata.assignees.length
                      ? "Required: assign someone."
                      : "No assignees available.",
                    (item) => item.login
                  )
                : "Loading assignees…"
            }
            error={validationErrors.assignees}
            open={assigneesOpen}
            onToggle={() => setAssigneesOpen((prev) => !prev)}
          >
            <SelectionList
              items={
                metadata?.assignees.map((user) => ({
                  ...user,
                  secondary: user.name ? `${user.name} — @${user.login}` : `@${user.login}`,
                })) || []
              }
              selectedIds={assigneeIds}
              onToggle={handleToggle(setAssigneeIds, "assignees")}
              loading={loadingMeta && !metadata}
              emptyText="No assignable users for this repository."
            />
            {assigneeIds.length ? (
              <div className="mt-3">
                <Button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-500 px-0"
                  onClick={() => setAssigneeIds([])}
                >
                  Clear assignees
                </Button>
              </div>
            ) : null}
          </SidebarSection>

          <SidebarSection
            title="Labels"
            summary={
              metaError
                ? metaError
                : metadataLoaded
                ? summaryText(
                    selectedLabels,
                    metadata.labels.length ? "Optional: add labels." : "No labels defined.",
                    (item) => item.name
                  )
                : "Loading labels…"
            }
            open={labelsOpen}
            onToggle={() => setLabelsOpen((prev) => !prev)}
          >
            <SelectionList
              items={
                metadata?.labels.map((label) => ({
                  ...label,
                  secondary: label.description,
                })) || []
              }
              selectedIds={labelIds}
              onToggle={handleToggle(setLabelIds)}
              loading={loadingMeta && !metadata}
              emptyText="No labels configured for this repository."
            />
            {labelIds.length ? (
              <div className="mt-3">
                <Button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-500 px-0"
                  onClick={() => setLabelIds([])}
                >
                  Clear labels
                </Button>
              </div>
            ) : null}
          </SidebarSection>

          <SidebarSection
            title="Projects"
            summary={
              metaError
                ? metaError
                : metadataLoaded
                ? summaryText(
                    selectedProjects,
                    metadata.projects.length ? "Required: choose a project." : "No projects available.",
                    (item) => `#${item.number} ${item.title}`
                  )
                : "Loading projects…"
            }
            error={validationErrors.projects}
            open={projectsOpen}
            onToggle={() => setProjectsOpen((prev) => !prev)}
          >
            <SelectionList
              items={
                metadata?.projects.map((project) => ({
                  ...project,
                  secondary: project.url ? project.url.replace("https://github.com/", "") : "",
                })) || []
              }
              selectedIds={projectIds}
              onToggle={handleToggle(setProjectIds, "projects")}
              loading={loadingMeta && !metadata}
              emptyText="No projects found."
            />
            {projectIds.length ? (
              <div className="mt-3">
                <Button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-500 px-0"
                  onClick={() => setProjectIds([])}
                >
                  Clear projects
                </Button>
              </div>
            ) : null}
          </SidebarSection>

          <SidebarSection
            title="Milestone"
            summary={
              metaError
                ? metaError
                : metadataLoaded
                ? selectedMilestone
                  ? selectedMilestone.title
                  : metadata.milestones.length
                  ? "Required: choose a milestone."
                  : "No open milestones."
                : "Loading milestones…"
            }
            error={validationErrors.milestone}
            open={milestonesOpen}
            onToggle={() => setMilestonesOpen((prev) => !prev)}
          >
            <SelectionList
              items={
                metadata?.milestones.map((mile) => ({
                  ...mile,
                  secondary: mile.dueOn
                    ? `Due ${new Date(mile.dueOn).toLocaleDateString()}`
                    : "No due date",
                })) || []
              }
              selectedIds={milestoneId ? [milestoneId] : []}
              onToggle={handleMilestoneToggle}
              multiple={false}
              name="milestones"
              loading={loadingMeta && !metadata}
              emptyText="No open milestones."
            />
            {milestoneId ? (
              <div className="mt-3">
                <Button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-500 px-0"
                  onClick={() => setMilestoneId("")}
                >
                  Clear milestone
                </Button>
              </div>
            ) : null}
          </SidebarSection>

          <div className="border border-gray-200 rounded-lg bg-white shadow-sm px-4 py-3 text-sm text-gray-600 space-y-3">
            <div className="flex items-center gap-2 text-gray-700">
              <GitBranch className="w-4 h-4" />
              <span>Linked pull requests</span>
            </div>
            <p className="text-sm text-gray-500">
              Link a pull request to automatically close this issue when the pull request is merged.
            </p>
            <Button
              type="button"
              className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg"
            >
              Link a pull request
            </Button>
          </div>

          <div className="border border-gray-200 rounded-lg bg-white shadow-sm px-4 py-3 text-xs text-gray-500 space-y-2">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
            <p>You’re receiving notifications because you’re watching this repository.</p>
            <p>
              <a
                href={repo?.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-500"
              >
                Manage subscription
              </a>
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
