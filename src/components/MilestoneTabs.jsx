import React from "react";

export default function MilestoneTabs({ sprints, activeTab, setActiveTab }) {
  return (
    <div className="mb-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Milestones</h3>
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

