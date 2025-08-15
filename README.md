# GitHub Issues Manager

A modern React application for managing and visualizing GitHub issues across organizations. Built with React Router for seamless navigation and enhanced user experience.

## ✨ Features

### 🎯 **Enhanced Navigation with React Router**
- **Clean URL Structure**: Each view has its own route (`/`, `/by-assignee`, `/by-tags`, etc.)
- **Browser History**: Back/forward buttons work seamlessly
- **Active State Indicators**: Visual feedback for current page
- **Responsive Navigation**: Collapsible navigation on mobile devices

### 📊 **Dashboard Analytics**
- **Real-time Charts**: Opened vs Closed issues over time (week/month/year)
- **Sprint Burndown Chart**: Track open and closed issues over time for sprint planning
- **Key Metrics**: Open, Closed, Backlog, and Sprint issues at a glance
- **Top Contributors**: See who's most active and who closes the most issues

### 👥 **Team Management**
- **By Assignee View**: Group issues by team members
- **Click-through Filtering**: Click on numbers to filter issues
- **Avatar Integration**: Visual team member identification
- **Unassigned Issues**: Track issues without assignees

### 🏷️ **Label & Tag Management**
- **By Tags View**: Organize issues by labels
- **Color-coded Labels**: GitHub's label colors preserved
- **Quick Filtering**: Click to filter by specific tags
- **No-label Tracking**: Identify issues without labels

### 📋 **Project Board**
- **Kanban-style Layout**: Drag and drop interface
- **Status Columns**: Backlog, Ready, In Progress, In Review, Done
- **Collapsible Columns**: Focus on specific statuses
- **CSV Export**: Download issues by status
- **Project Selection**: Choose from multiple projects

### 🏃 **Sprint Management**
- **Milestone Tracking**: Visualize sprint progress
- **Progress Bars**: See completion percentages
- **Due Date Monitoring**: Track sprint deadlines
- **Issue Grouping**: All issues in a milestone

### 🔍 **Advanced Issue Management**
- **Comprehensive Filtering**: By state, assignee, tags, milestones, project status
- **Global Search**: Search across titles, repositories, assignees, and labels
- **CSV Export**: Download filtered results
- **Responsive Grid**: Card-based issue display
- **Rich Issue Cards**: Labels, assignees, milestones, and status

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn
- GitHub Personal Access Token with `repo` scope

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd github-issues-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Usage

1. **Enter Organization**: Type your GitHub organization name (e.g., `vercel`, `facebook`)
2. **Add Token**: Enter your GitHub Personal Access Token
3. **Load Data**: Click "Load" to fetch issues and projects
4. **Navigate**: Use the navigation bar to switch between different views

## 🛠️ Technology Stack

- **React 18**: Modern React with hooks
- **React Router 6**: Client-side routing with nested routes
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Beautiful, composable charts
- **Lucide React**: Beautiful & consistent icon toolkit
- **GitHub GraphQL API**: Modern API for GitHub data

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── Dashboard.jsx       # Main dashboard view
│   ├── ByAssignee.jsx      # Assignee-based view
│   ├── ByTags.jsx          # Tag-based view
│   ├── ProjectBoard.jsx    # Kanban board view
│   ├── Sprints.jsx         # Milestone/sprint view
│   ├── AllIssues.jsx       # Comprehensive issue list
│   ├── IssueCard.jsx       # Individual issue display
│   └── Navigation.jsx      # Route navigation
├── App.jsx                 # Main app with routing
├── main.jsx               # App entry point
└── index.css              # Global styles
```

## 🔧 Configuration

### GitHub Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` scope
3. Copy the token and paste it in the app

### Environment Variables

Create a `.env` file for production settings:
```env
VITE_GITHUB_API_URL=https://api.github.com/graphql
```

## 🎨 Customization

### Styling
- Modify `tailwind.config.js` for theme customization
- Update `src/index.css` for global styles
- Component-specific styles in each component file

### Adding New Routes
1. Create a new component in `src/components/`
2. Add the route to `src/components/Navigation.jsx`
3. Add the route to `src/App.jsx` Routes

## 📊 Performance Features

- **Code Splitting**: Each route loads independently
- **Memoization**: Optimized re-renders with useMemo
- **Lazy Loading**: Components load on demand
- **Efficient Filtering**: Client-side filtering for fast response

## 🔒 Security

- **Client-side Only**: No server-side data storage
- **Token Security**: Tokens stored only in memory
- **Direct API Calls**: No proxy server needed
- **HTTPS Only**: Secure communication with GitHub

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- GitHub for the excellent GraphQL API
- The React Router team for the amazing routing solution
- The Tailwind CSS team for the utility-first approach
- All contributors and users of this project

---

**Made with ❤️ for the GitHub community**
