import React, { useMemo } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import IssueCard from "./IssueCard";
import jsPDF from "jspdf";

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

  async function summarizeIssues(issues) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) return "";
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful release notes generator." },
            {
              role: "user",
              content: `Summarize the following issues in one short paragraph:\n${issues
                .map(i => `- ${i.title}`)
                .join("\n")}`,
            },
          ],
          max_tokens: 120,
          temperature: 0.2,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      console.error("LLM summary failed", err);
      return "";
    }
  }

  function splitIssues(issues) {
    const isFeature = i =>
      /feature|enhancement/i.test(i.issueType?.name || "") ||
      i.labels.some(l => /^type:\s*(feature|enhancement)/i.test(l.name));
    const isBug = i =>
      /bug/i.test(i.issueType?.name || "") ||
      i.labels.some(l => /^type:\s*bug/i.test(l.name));
    return {
      features: issues.filter(isFeature),
      bugs: issues.filter(isBug),
    };
  }

  async function downloadReleaseNotes(sp) {
    const { features, bugs } = splitIssues(sp.issues);
    const summary = await summarizeIssues(sp.issues);

    const doc = new jsPDF();
    let y = 10;
    doc.text(`Release Notes - ${sp.title}`, 10, y);
    y += 10;
    if (summary) {
      const lines = doc.splitTextToSize(summary, 180);
      doc.text(lines, 10, y);
      y += lines.length * 7 + 3;
    }
    if (features.length) {
      doc.text("Features:", 10, y);
      y += 7;
      features.forEach(f => {
        const lines = doc.splitTextToSize(`#${f.number} ${f.title}`, 180);
        doc.text(lines, 10, y);
        y += lines.length * 7;
      });
      y += 3;
    }
    if (bugs.length) {
      doc.text("Bugs:", 10, y);
      y += 7;
      bugs.forEach(b => {
        const lines = doc.splitTextToSize(`#${b.number} ${b.title}`, 180);
        doc.text(lines, 10, y);
        y += lines.length * 7;
      });
    }
    doc.save(`${sp.title}-release-notes.pdf`);
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        {sprints.map(sp => (
          <Card key={sp.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="truncate">
                    <a href={sp.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {sp.title}
                    </a>
                  </CardTitle>
                  <Button
                    className="text-xs border px-2 py-1"
                    onClick={() => downloadReleaseNotes(sp)}
                  >
                    Download
                  </Button>
                </div>
                <Badge variant="secondary">{sp.closed}/{sp.open + sp.closed}</Badge>
              </div>
              {sp.dueOn && <div className="text-xs text-gray-500 mt-1">Due {fmtDate(sp.dueOn)}</div>}
            </CardHeader>
            <CardContent>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${((sp.closed / (sp.open + sp.closed)) * 100 || 0)}%` }}
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-auto pr-1">
                {sp.issues.map(iss => (
                  <IssueCard key={iss.id} issue={iss} showMilestone={false} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {!sprints.length && (
          <Card>
            <CardContent className="py-10">
              <div className="text-sm text-gray-500">No data available.</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
