import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { applyDesktopColor, loadDesktopColor } from './ui/DisplayProperties';
import { iconDataUri } from './ui/icons';
import '@fontsource/win95fa/400.css';
import './ui/styles.css';
import './ui/win95-vars.css';
import './ui/win95-controls.css';

applyDesktopColor(loadDesktopColor(), false);
// Sanduhr-Mauszeiger aus dem Pixel-Symbol (Hotspot in der Mitte)
document.documentElement.style.setProperty('--cursor-wait', `url("${iconDataUri('hourglass', 32)}") 16 16, wait`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
