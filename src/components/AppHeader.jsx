import React, { Suspense, lazy } from "react";
import { Github, Loader2, RefreshCcw, Sun, Moon, Monitor, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const Navigation = lazy(() => import("./Navigation"));

export default function AppHeader({
  org,
  setOrg,
  token,
  setToken,
  loadData,
  loading,
  cycleTheme,
  toggleDensity,
  theme,
  density,
  sidebarOpen,
}) {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Github className="w-6 h-6" />
          <h1 className="text-xl font-semibold">GitHub Issues Manager</h1>
          <a
            href="https://github.com/evolvus/github-issue-manager"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            title="View Source Code"
          >
            <Github className="w-4 h-4" />
          </a>
          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
            <Input
              placeholder="Organization (e.g. vercel)"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              className="w-44"
            />
            <Input
              placeholder="Personal Access Token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-64"
            />
            <Button className="bg-black text-white" onClick={loadData} disabled={loading || !org || !token}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading</span>
                </>
              ) : (
                <>
                  <RefreshCcw className="w-4 h-4" />
                  <span>Load</span>
                </>
              )}
            </Button>
            <button onClick={cycleTheme} title={`Theme: ${theme}`} className="p-2 border rounded">
              {theme === "dark" ? (
                <Moon className="w-4 h-4" />
              ) : theme === "light" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Monitor className="w-4 h-4" />
              )}
            </button>
            <button onClick={toggleDensity} title={`Density: ${density}`} className="p-2 border rounded">
              {density === "compact" ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
        {sidebarOpen && (
          <Suspense fallback={<Loader2 className="w-4 h-4 animate-spin" />}>
            <Navigation />
          </Suspense>
        )}
      </div>
    </header>
  );
}

