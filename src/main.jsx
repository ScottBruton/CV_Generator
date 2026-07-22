import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { installDebugConsoleCapture } from './lib/debugLog.js';

import '../style.css';
import '../profile.css';
import '../stat-card.css';
import '../timeline.css';
import '../impact.css';
import '../skills.css';
import '../portfolio.css';
import '../tools.css';
import '../cover.css';
import '../career-path.css';
import '../app.css';
import '../print.css';
import './styles/shell.css';

document.body.classList.add('app');
installDebugConsoleCapture();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
