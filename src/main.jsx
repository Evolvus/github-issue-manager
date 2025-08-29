import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AppStoreProvider } from './store'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppStoreProvider>
      <BrowserRouter basename="/github-issue-manager">
        <App />
      </BrowserRouter>
    </AppStoreProvider>
  </React.StrictMode>,
)
