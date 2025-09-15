import React, { createContext, useContext, useReducer } from "react";

const getInitialTheme = () => {
  if (typeof localStorage === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  if (!stored || stored === "auto") {
    localStorage.setItem("theme", "light");
    return "light";
  }
  return stored;
};

const getInitialDensity = () => {
  if (typeof localStorage === "undefined") return "comfy";
  return localStorage.getItem("density") || "comfy";
};

const initialState = {
  query: "",
  filterState: [],
  filterProjectStatus: [],
  filterAssignee: [],
  filterTag: [],
  filterMilestone: [],
  filterIssueType: [],
  range: "month",
  burnRange: "month",
  theme: getInitialTheme(),
  density: getInitialDensity(),
  sidebarOpen: true,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_QUERY":
      return { ...state, query: action.payload };
    case "SET_FILTER_STATE":
      return { ...state, filterState: action.payload };
    case "SET_FILTER_PROJECT_STATUS":
      return { ...state, filterProjectStatus: action.payload };
    case "SET_FILTER_ASSIGNEE":
      return { ...state, filterAssignee: action.payload };
    case "SET_FILTER_TAG":
      return { ...state, filterTag: action.payload };
    case "SET_FILTER_MILESTONE":
      return { ...state, filterMilestone: action.payload };
    case "SET_FILTER_ISSUE_TYPE":
      return { ...state, filterIssueType: action.payload };
    case "SET_RANGE":
      return { ...state, range: action.payload };
    case "SET_BURN_RANGE":
      return { ...state, burnRange: action.payload };
    case "SET_THEME":
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("theme", action.payload);
      }
      return { ...state, theme: action.payload };
    case "SET_DENSITY":
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("density", action.payload);
      }
      return { ...state, density: action.payload };
    case "SET_SIDEBAR_OPEN":
      return { ...state, sidebarOpen: action.payload };
    default:
      return state;
  }
}

const StoreContext = createContext();

export function AppStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export default function useAppStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useAppStore must be used within AppStoreProvider");
  }
  const { state, dispatch } = context;
  return {
    ...state,
    setQuery: (payload) => dispatch({ type: "SET_QUERY", payload }),
    setFilterState: (payload) => dispatch({ type: "SET_FILTER_STATE", payload }),
    setFilterProjectStatus: (payload) => dispatch({ type: "SET_FILTER_PROJECT_STATUS", payload }),
    setFilterAssignee: (payload) => dispatch({ type: "SET_FILTER_ASSIGNEE", payload }),
    setFilterTag: (payload) => dispatch({ type: "SET_FILTER_TAG", payload }),
    setFilterMilestone: (payload) => dispatch({ type: "SET_FILTER_MILESTONE", payload }),
    setFilterIssueType: (payload) => dispatch({ type: "SET_FILTER_ISSUE_TYPE", payload }),
    setRange: (payload) => dispatch({ type: "SET_RANGE", payload }),
    setBurnRange: (payload) => dispatch({ type: "SET_BURN_RANGE", payload }),
    setTheme: (payload) => dispatch({ type: "SET_THEME", payload }),
    setDensity: (payload) => dispatch({ type: "SET_DENSITY", payload }),
    setSidebarOpen: (payload) => dispatch({ type: "SET_SIDEBAR_OPEN", payload }),
  };
}
