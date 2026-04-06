import * as React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import process from 'process';
import App from './App.js';
import './index.css';

// Polyfills for Solana Wallet Adapter
window.Buffer = Buffer;
window.process = process;

// Ignore wallet conflict errors from Mises browser
window.addEventListener('error', (e) => {
  if (e.message?.includes('Cannot redefine property')) {
    e.preventDefault();
    return true;
  }
});

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-zinc-900 border border-white/10 p-8 rounded-2xl shadow-2xl">
            <h1 className="text-2xl font-black tracking-tighter uppercase mb-4 text-rose-500">System Error</h1>
            <p className="text-zinc-400 text-sm mb-6">
              The application encountered an unexpected error. This might be due to a connection issue or a temporary service interruption.
            </p>
            <div className="bg-black/50 p-4 rounded border border-white/5 mb-6 overflow-auto max-h-40">
              <code className="text-xs text-rose-400 font-mono">
                {this.state.error?.message || "Unknown error"}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  let errorMsg = "Unknown reason";
  
  if (reason instanceof Error) {
    errorMsg = reason.message;
  } else if (typeof reason === 'string' && reason.trim() !== "") {
    errorMsg = reason;
  } else if (typeof reason === 'object' && reason !== null) {
    try {
      errorMsg = "[Complex Rejection Reason: " + (reason.constructor ? reason.constructor.name : "Object") + "]";
    } catch (e) {
      errorMsg = "[Complex Rejection Reason]";
    }
  } else if (reason !== undefined && reason !== null) {
    errorMsg = String(reason);
  }
  
  console.error("Unhandled Promise Rejection:", errorMsg);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
