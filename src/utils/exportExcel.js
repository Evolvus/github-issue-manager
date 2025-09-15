import * as XLSX from 'xlsx';

function toText(val) {
  if (val == null) return '';
  return String(val);
}

function joinNames(list, key = 'login') {
  if (!Array.isArray(list)) return '';
  return list.map((x) => x?.[key]).filter(Boolean).join(', ');
}

function joinLabels(labels) {
  if (!Array.isArray(labels)) return '';
  return labels.map((l) => l?.name).filter(Boolean).join(', ');
}

function makeSheet(issues, sheetName = 'Issues') {
  const headers = [
    'Number',
    'Title',
    'URL',
    'State',
    'Repository',
    'ProjectStatus',
    'Milestone',
    'MilestoneDue',
    'CreatedAt',
    'ClosedAt',
    'Assignees',
    'Labels',
  ];

  const rows = issues.map((i) => [
    toText(i.number),
    toText(i.title),
    toText(i.url),
    toText(i.state),
    toText(i.repository?.nameWithOwner || i.repository || ''),
    toText(i.project_status || ''),
    toText(i.milestone?.title || ''),
    toText(i.milestone?.dueOn || ''),
    toText(i.createdAt || ''),
    toText(i.closedAt || ''),
    toText(joinNames(i.assignees || [])),
    toText(joinLabels(i.labels || [])),
  ]);

  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto filter on header row
  const range = XLSX.utils.decode_range(ws['!ref']);
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }) };

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

  // Column widths for readability
  ws['!cols'] = [
    { wch: 8 }, // Number
    { wch: 60 }, // Title
    { wch: 50 }, // URL
    { wch: 10 }, // State
    { wch: 28 }, // Repository
    { wch: 16 }, // ProjectStatus
    { wch: 28 }, // Milestone
    { wch: 16 }, // MilestoneDue
    { wch: 22 }, // CreatedAt
    { wch: 22 }, // ClosedAt
    { wch: 28 }, // Assignees
    { wch: 28 }, // Labels
  ];

  return ws;
}

export function downloadIssuesExcel(issues, filename = 'issues.xlsx', sheetName = 'Issues') {
  const wb = XLSX.utils.book_new();
  const ws = makeSheet(issues, sheetName);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeSheetName(name) {
  const invalid = /[\\/?*\[\]:]/g; // Excel invalid chars
  let out = (name || 'Sheet').replace(invalid, ' ').substring(0, 31).trim();
  return out || 'Sheet';
}

export function downloadSprintsWorkbook(sprints, filename = 'milestones.xlsx') {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  (sprints || []).forEach((sp, idx) => {
    const nameBase = sanitizeSheetName(sp.title || `Sprint ${idx + 1}`);
    let name = nameBase;
    let n = 1;
    while (used.has(name)) {
      name = sanitizeSheetName(`${nameBase}-${++n}`);
    }
    used.add(name);
    const ws = makeSheet(sp.issues || [], name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
