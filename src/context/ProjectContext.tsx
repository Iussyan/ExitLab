import React, { createContext, useContext, useState, useEffect } from 'react';
import { Building, validateBuildingGeometry, ValidationResult } from '../schemas/building';
import { Scenario, SimulationResult } from '../simulation/types';
import { runSimulation } from '../simulation/engine';
import { StressTestReport } from '../agent/orchestrator';
import { BenchmarkResult } from '../agent/benchmark';

// Pre-loaded fixtures
import simpleSchoolData from '../fixtures/simple-school.json';
import disconnectedRoomData from '../fixtures/disconnected-room.json';
import narrowDoorData from '../fixtures/narrow-door.json';
import malformedBuildingData from '../fixtures/malformed-building.json';

export interface ProjectContextType {
  building: Building;
  setBuilding: (b: Building) => void;
  validation: ValidationResult;
  selectedFixtureId: string;
  loadFixture: (id: string) => void;
  activeScenario: Scenario;
  setActiveScenario: (s: Scenario) => void;
  toggleDoorBlockage: (doorId: string) => void;
  currentRun: SimulationResult | null;
  baselineRun: SimulationResult | null;
  runCurrentSimulation: () => SimulationResult;
  runBaselineSimulation: () => SimulationResult;
  stressTestReport: StressTestReport | null;
  setStressTestReport: (r: StressTestReport | null) => void;
  benchmarkResult: BenchmarkResult | null;
  setBenchmarkResult: (b: BenchmarkResult | null) => void;
  isSimulating: boolean;
  activeTab: string;
  setActiveTab: (t: string) => void;
  is3DMode: boolean;
  setIs3DMode: (v: boolean) => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>('simple-school');
  const [building, setBuildingState] = useState<Building>(simpleSchoolData as unknown as Building);
  const [validation, setValidation] = useState<ValidationResult>(() => validateBuildingGeometry(building));

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const [activeScenario, setActiveScenario] = useState<Scenario>({
    id: 'custom-scenario',
    name: 'Custom Interactive Scenario',
    seed: 42,
    blockedDoorIds: [],
    occupancyMultiplier: 1.0,
  });

  const [currentRun, setCurrentRun] = useState<SimulationResult | null>(null);
  const [baselineRun, setBaselineRun] = useState<SimulationResult | null>(null);
  const [stressTestReport, setStressTestReport] = useState<StressTestReport | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);

  const setBuilding = (b: Building) => {
    setBuildingState(b);
    setValidation(validateBuildingGeometry(b));
  };

  const loadFixture = (id: string) => {
    setSelectedFixtureId(id);
    let chosen: Building;
    switch (id) {
      case 'disconnected-room':
        chosen = disconnectedRoomData as unknown as Building;
        break;
      case 'narrow-door':
        chosen = narrowDoorData as unknown as Building;
        break;
      case 'malformed':
        chosen = malformedBuildingData as unknown as Building;
        break;
      case 'simple-school':
      default:
        chosen = simpleSchoolData as unknown as Building;
        break;
    }
    setBuilding(chosen);
    setActiveScenario({
      id: `scenario-${id}`,
      name: `Scenario for ${chosen.name}`,
      seed: 42,
      blockedDoorIds: [],
      occupancyMultiplier: 1.0,
    });
    setCurrentRun(null);
    setBaselineRun(null);
    setStressTestReport(null);
  };

  const toggleDoorBlockage = (doorId: string) => {
    setActiveScenario(prev => {
      const exists = prev.blockedDoorIds.includes(doorId);
      const newBlocked = exists
        ? prev.blockedDoorIds.filter(id => id !== doorId)
        : [...prev.blockedDoorIds, doorId];
      return {
        ...prev,
        blockedDoorIds: newBlocked,
      };
    });
  };

  const runCurrentSimulation = (): SimulationResult => {
    setIsSimulating(true);
    const result = runSimulation(building, activeScenario);
    setCurrentRun(result);
    setIsSimulating(false);
    return result;
  };

  const runBaselineSimulation = (): SimulationResult => {
    setIsSimulating(true);
    const baselineSc: Scenario = {
      id: 'baseline-standard',
      name: 'Baseline Standard State',
      seed: 42,
      blockedDoorIds: [],
      occupancyMultiplier: 1.0,
    };
    const result = runSimulation(building, baselineSc);
    setBaselineRun(result);
    setCurrentRun(result);
    setIsSimulating(false);
    return result;
  };

  // Run initial baseline on load
  useEffect(() => {
    if (validation.valid && !baselineRun) {
      runBaselineSimulation();
    }
  }, [building.id]);

  return (
    <ProjectContext.Provider
      value={{
        building,
        setBuilding,
        validation,
        selectedFixtureId,
        loadFixture,
        activeScenario,
        setActiveScenario,
        toggleDoorBlockage,
        currentRun,
        baselineRun,
        runCurrentSimulation,
        runBaselineSimulation,
        stressTestReport,
        setStressTestReport,
        benchmarkResult,
        setBenchmarkResult,
        isSimulating,
        activeTab,
        setActiveTab,
        is3DMode,
        setIs3DMode,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
};
