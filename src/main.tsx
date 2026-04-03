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
    try {
      errorMsg = JSON.stringify(error);
    } catch (e) {
      errorMsg = "[Complex Error Object]";
    }
  }
  console.error("Global Error Caught:", errorMsg, source, lineno, colno);
  return false;
};

window.onunhandledrejection = function(event) {
  let reason = event.reason;
  if (reason instanceof Error) {
    reason = reason.message;
  } else if (typeof reason === 'object' && reason !== null) {
    try {
      // Try to get a safe string representation
      reason = JSON.stringify(reason);
    } catch (e) {
      reason = "[Complex Rejection Reason]";
    }
  }
  console.error("Unhandled Promise Rejection:", reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
