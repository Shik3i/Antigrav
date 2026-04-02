import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/** 
 * BUGFIX: Recharts 3.x VariablesStore.putRootVars TypeError
 * Recharts iterates over document.styleSheets and crashes if a sheet is null or inaccessible.
 */
try {
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'styleSheets');
  if (descriptor && descriptor.configurable) {
    Object.defineProperty(document, 'styleSheets', {
      get() {
        const sheets = descriptor.get.call(this);
        if (!sheets) return [];
        return Array.from(sheets).filter(s => {
          try { return !!s && !!s.cssRules; } catch (e) { return false; }
        });
      },
      configurable: true
    });
  }
} catch (e) {
  console.warn('Recharts CSS fix could not be applied:', e);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

