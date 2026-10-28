import React from 'react';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/dashboard/Dashboard';
import { FloorEditor2D } from './components/editor/FloorEditor2D';
import { Viewer3D } from './components/viewer3d/Viewer3D';
import { AIPanel } from './components/agent/AIPanel';
import { BenchmarkView } from './components/benchmark/BenchmarkView';
import { ResultsView } from './components/results/ResultsView';
import { ImportWizard } from './components/import/ImportWizard';
import { ReportView } from './components/report/ReportView';

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
          {renderActiveView()}
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
