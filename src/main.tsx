import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Buffer } from 'buffer';
import process from 'process';
import App from './App.tsx';
import './index.css';

// Polyfills for Solana Wallet Adapter
window.Buffer = Buffer;
window.process = process;

// Global error handler for "Script error." and other issues
window.onerror = function(message, source, lineno, colno, error) {
  let errorMsg = message;
  if (error instanceof Error) {
    errorMsg = error.message;
  } else if (typeof error === 'object' && error !== null) {
    errorMsg = "[Complex Error Object: " + (error.constructor ? error.constructor.name : "Unknown") + "]";
  }
  console.error("Global Error Caught:", String(errorMsg), source, lineno, colno);
  return false;
};

window.onunhandledrejection = function(event) {
  let reason = event.reason;
  if (reason instanceof Error) {
    reason = reason.message;
  } else if (typeof reason === 'object' && reason !== null) {
    reason = "[Complex Rejection Reason: " + (reason.constructor ? reason.constructor.name : "Unknown") + "]";
  }
  console.error("Unhandled Promise Rejection:", String(reason));
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
