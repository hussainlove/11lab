import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
}

class StudioErrorBoundary extends React.Component<{children: React.ReactNode}, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('HBL voicelab runtime recovery:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-6">
          <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center space-y-4">
            <h1 className="text-xl font-bold tracking-tight">HBL voicelab</h1>
            <p className="text-sm text-zinc-400">
              Studio encountered an unexpected state. Click below to restore cleanly.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Reload Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StudioErrorBoundary>
    <App />
  </StudioErrorBoundary>
);
