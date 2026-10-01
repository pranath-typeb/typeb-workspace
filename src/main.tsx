import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './data/theme'

// A standalone single-file build (see vite.singlefile.config.ts) is opened directly as a
// local file, or hosted with no server-side rewrite rules — there's no server to fall back
// unmatched paths to index.html. HashRouter keeps all routing in the URL fragment
// (e.g. #/time), which works from a bare file:// page with zero server config.
const Router = typeof __STANDALONE__ !== 'undefined' && __STANDALONE__ ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
)
