import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { applyDesktopColor, loadDesktopColor } from './ui/DisplayProperties';
import '@fontsource/win95fa/400.css';
import './ui/styles.css';
import './ui/win95-vars.css';
import './ui/win95-controls.css';

applyDesktopColor(loadDesktopColor(), false);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
