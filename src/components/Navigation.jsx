import React from "react";
import { NavLink } from "react-router-dom";
import { BarChart3, Users, Tags, FolderKanban, Calendar, List } from "lucide-react";

export default function Navigation() {
  const navItems = [
    { path: "/", label: "Dashboard", icon: BarChart3 },
    { path: "/by-assignee", label: "By Assignee", icon: Users },
    { path: "/by-tags", label: "By Tags", icon: Tags },
    { path: "/project-board", label: "Project Board", icon: FolderKanban },
    { path: "/sprints", label: "Sprints", icon: Calendar },
    { path: "/all-issues", label: "All Issues", icon: List },
  ];

  return (
    <nav className="flex space-x-1">
      {navItems.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700"
            }`
          }
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
