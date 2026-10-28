import React, { Suspense, lazy } from 'react';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { ViewSkeleton } from './components/layout/ViewSkeleton';

// Code-split heavy views to isolate Three.js, R3F, CAD editor, and analytics
const FloorEditor2D = lazy(() => import('./components/editor/FloorEditor2D').then(m => ({ default: m.FloorEditor2D })));
const Viewer3D = lazy(() => import('./components/viewer3d/Viewer3D').then(m => ({ default: m.Viewer3D })));
const AIPanel = lazy(() => import('./components/agent/AIPanel').then(m => ({ default: m.AIPanel })));
const BenchmarkView = lazy(() => import('./components/benchmark/BenchmarkView').then(m => ({ default: m.BenchmarkView })));
const ResultsView = lazy(() => import('./components/results/ResultsView').then(m => ({ default: m.ResultsView })));
const ImportWizard = lazy(() => import('./components/import/ImportWizard').then(m => ({ default: m.ImportWizard })));
const ReportView = lazy(() => import('./components/report/ReportView').then(m => ({ default: m.ReportView })));

const MainContent: React.FC = () => {
  const { activeTab, is3DMode } = useProject();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'editor':
        return is3DMode ? <Viewer3D /> : <FloorEditor2D />;
      case 'simulation3d':
        return <Viewer3D />;
      case 'agent':
        return <AIPanel />;
      case 'benchmark':
        return <BenchmarkView />;
      case 'results':
        return <ResultsView />;
      case 'import':
        return <ImportWizard />;
      case 'report':
        return <ReportView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<ViewSkeleton />}>
            {renderActiveView()}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ProjectProvider>
      <MainContent />
    </ProjectProvider>
  );
};

export default App;
