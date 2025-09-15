import React from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Search as SearchIcon, Download as DownloadIcon } from "lucide-react";
import { downloadSprintsWorkbook } from "../utils/exportExcel";

export default function MilestoneTabs({ sprints, activeTab, setActiveTab, search = "", setSearch = () => {} }) {
  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Milestones</h3>
        <Button
          className="ml-auto text-xs border px-3 py-1"
          onClick={() => downloadSprintsWorkbook(sprints, "milestones.xlsx")}
          title="Export all milestones to Excel"
        >
          <DownloadIcon className="w-4 h-4 mr-1" />
          Export All
        </Button>
        <div className="relative w-full max-w-md">
          <SearchIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search sprint issues (number, title, description, assignee)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-9 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sprints.map((sp) => (
          <button
            key={sp.id}
            onClick={() => setActiveTab(sp.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-all duration-200 ${
              activeTab === sp.id
                ? "bg-blue-50 border-blue-200 shadow-sm text-blue-700"
                : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700"
            }`}
          >
            <span className="text-sm font-medium whitespace-nowrap">{sp.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
