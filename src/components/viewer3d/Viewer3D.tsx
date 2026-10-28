import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Users,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Wall, Door } from '../../schemas/building';

// Component to render 3D Building Floor & Extruded Walls
const Building3DModel: React.FC<{
  walls: Wall[];
  doors: Door[];
  blockedDoorIds: string[];
  floorBounds: { minX: number; minY: number; maxX: number; maxY: number };
}> = ({ walls, doors, blockedDoorIds, floorBounds }) => {
  const wallMeshes = useMemo(() => {
    const meshes: JSX.Element[] = [];
    const blockedSet = new Set(blockedDoorIds);

    walls.forEach((wall, wIdx) => {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      if (wallLen < 0.01) return;

      const angle = Math.atan2(dy, dx);
      const doorsOnWall = doors.filter(d => d.wallId === wall.id);

      if (doorsOnWall.length === 0) {
        // Solid wall without doors
        meshes.push(
          <mesh
            key={`wall-${wIdx}`}
            position={[wall.start.x + dx / 2, wall.heightM / 2, -(wall.start.y + dy / 2)]}
            rotation={[0, angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[wallLen, wall.heightM, wall.thicknessM]} />
            <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.1} />
          </mesh>
        );
      } else {
        // Wall with doors: split into segments around door openings
        const sortedDoors = [...doorsOnWall].sort((a, b) => a.offsetM - b.offsetM);
        let currOffset = 0;

        sortedDoors.forEach((door, dIdx) => {
          const segLength = door.offsetM - currOffset;
          if (segLength > 0.05) {
            const segMid = currOffset + segLength / 2;
            const midX = wall.start.x + Math.cos(angle) * segMid;
            const midY = wall.start.y + Math.sin(angle) * segMid;

            meshes.push(
              <mesh
                key={`wall-${wIdx}-seg-${dIdx}`}
                position={[midX, wall.heightM / 2, -midY]}
                rotation={[0, angle, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[segLength, wall.heightM, wall.thicknessM]} />
                <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.1} />
              </mesh>
            );
          }

          // Lintel above door
          const doorMid = door.offsetM + door.widthM / 2;
          const doorMidX = wall.start.x + Math.cos(angle) * doorMid;
          const doorMidY = wall.start.y + Math.sin(angle) * doorMid;
          const doorHeight = 2.1;
          const lintelHeight = Math.max(0.1, wall.heightM - doorHeight);

          meshes.push(
            <mesh
              key={`wall-${wIdx}-lintel-${dIdx}`}
              position={[doorMidX, doorHeight + lintelHeight / 2, -doorMidY]}
              rotation={[0, angle, 0]}
              castShadow
            >
              <boxGeometry args={[door.widthM, lintelHeight, wall.thicknessM]} />
              <meshStandardMaterial color="#475569" roughness={0.6} />
            </mesh>
          );

          // If blocked door: render red physical barrier mesh
          const isBlocked = blockedSet.has(door.id) || !door.passable;
          if (isBlocked) {
            meshes.push(
              <mesh
                key={`door-blockage-${door.id}`}
                position={[doorMidX, doorHeight / 2, -doorMidY]}
                rotation={[0, angle, 0]}
              >
                <boxGeometry args={[door.widthM * 0.95, doorHeight * 0.95, wall.thicknessM * 0.8]} />
                <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.2} transparent opacity={0.85} />
              </mesh>
            );
          }

          currOffset = door.offsetM + door.widthM;
        });

        // Final segment after last door
        const remLength = wallLen - currOffset;
        if (remLength > 0.05) {
          const segMid = currOffset + remLength / 2;
          const midX = wall.start.x + Math.cos(angle) * segMid;
          const midY = wall.start.y + Math.sin(angle) * segMid;

          meshes.push(
            <mesh
              key={`wall-${wIdx}-end`}
              position={[midX, wall.heightM / 2, -midY]}
              rotation={[0, angle, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[remLength, wall.heightM, wall.thicknessM]} />
              <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.1} />
            </mesh>
          );
        }
      }
    });

    return meshes;
  }, [walls, doors, blockedDoorIds]);

  // Dynamic floor dimensions
  const fWidth = Math.max(10, floorBounds.maxX - floorBounds.minX + 8);
  const fHeight = Math.max(10, floorBounds.maxY - floorBounds.minY + 8);
  const centerX = (floorBounds.minX + floorBounds.maxX) / 2;
  const centerY = (floorBounds.minY + floorBounds.maxY) / 2;

  return (
    <group>
      {/* Floor Plate dynamically centered */}
      <mesh position={[centerX, -0.05, -centerY]} receiveShadow>
        <boxGeometry args={[fWidth, 0.1, fHeight]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      {/* Wall Meshes */}
      {wallMeshes}
    </group>
  );
};

// Component to render dynamic occupant markers
const Occupants3D: React.FC<{
  agents: { id: string; x: number; y: number; status: string }[];
}> = ({ agents }) => {
  return (
    <group>
      {agents.map(ag => {
        if (ag.status === 'exited') return null; // already evacuated
        const isTrapped = ag.status === 'unreachable';
        return (
          <mesh key={ag.id} position={[ag.x, 0.5, -ag.y]} castShadow>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial
              color={isTrapped ? '#ef4444' : '#315cfa'}
              emissive={isTrapped ? '#ef4444' : '#315cfa'}
              emissiveIntensity={0.3}
              roughness={0.3}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export const Viewer3D: React.FC = () => {
  const {
    building,
    validation,
    currentRun,
    baselineRun,
    activeScenario,
    runCurrentSimulation,
    setActiveTab,
    setIs3DMode,
  } = useProject();

  const runToReplay = currentRun || baselineRun;
  const frames = runToReplay?.frames || [];

  const [frameIdx, setFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const intervalMs = Math.max(16, Math.round(100 / speedMultiplier));
    const timer = setInterval(() => {
      setFrameIdx(curr => {
        if (curr >= frames.length - 1) {
          setIsPlaying(false);
          return frames.length - 1;
        }
        return curr + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, frames.length, speedMultiplier]);

  const currentFrame = frames[frameIdx] || frames[0];
  const floor = building.floors[0];

  // Dynamic 3D building bounds & camera center calculation
  const floorBounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (floor) {
      for (const w of floor.walls) {
        minX = Math.min(minX, w.start.x, w.end.x);
        minY = Math.min(minY, w.start.y, w.end.y);
        maxX = Math.max(maxX, w.start.x, w.end.x);
        maxY = Math.max(maxY, w.start.y, w.end.y);
      }
    }
    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 24; maxY = 14;
    }
    return { minX, minY, maxX, maxY };
  }, [floor]);

  const centerX = (floorBounds.minX + floorBounds.maxX) / 2;
  const centerY = (floorBounds.minY + floorBounds.maxY) / 2;
  const spanX = Math.max(10, floorBounds.maxX - floorBounds.minX);
  const spanY = Math.max(10, floorBounds.maxY - floorBounds.minY);
  const cameraDistance = Math.max(spanX, spanY) * 1.35;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#0D1729] select-none text-white relative overflow-hidden">
      {/* Validation Error State Notice */}
      {!validation.valid && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/30">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">3D Simulation Blocked by Validation Errors</h3>
          <p className="text-slate-300 text-xs max-w-md leading-relaxed mb-6">
            The active building has {validation.issues.length} geometric errors (such as degenerate walls,
            floating doors, or unconfirmed scale). Egress routing cannot be computed until these are resolved.
          </p>
          <button
            onClick={() => {
              setIs3DMode(false);
              setActiveTab('editor');
            }}
            className="btn-primary text-xs py-2.5 px-5 shadow-lg"
          >
            Review & Fix in 2D Floor Editor →
          </button>
        </div>
      )}

      {/* 3D Top Overlay HUD */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="bg-[#152238]/90 backdrop-blur-md border border-[#233554] px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-3">
            <div>
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Scenario</div>
              <div className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-xs">
                {runToReplay?.scenario.name || activeScenario.name}
              </div>
            </div>
            <div className="w-[1px] h-5 bg-[#233554]" />
            <div>
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Simulated Time</div>
              <div className="text-xs sm:text-sm font-extrabold text-blue-400 font-mono">
                {currentFrame ? `${currentFrame.timeSeconds.toFixed(2)}s` : '0.00s'}
              </div>
            </div>
          </div>

          {/* Live Counters */}
          <div className="bg-[#152238]/90 backdrop-blur-md border border-[#233554] px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <span className="text-[9px] text-slate-400 block font-semibold">Evacuated</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {currentFrame?.exitedCumulative ?? 0}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <div>
                <span className="text-[9px] text-slate-400 block font-semibold">In Egress</span>
                <span className="font-bold text-blue-400 font-mono">
                  {currentFrame?.activeCount ?? 0}
                </span>
              </div>
            </div>

            {(runToReplay?.metrics.unreachableCount ?? 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                <div>
                  <span className="text-[9px] text-slate-400 block font-semibold">Trapped</span>
                  <span className="font-bold text-rose-400 font-mono">
                    {runToReplay?.metrics.unreachableCount}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick trigger if no run yet */}
        {!runToReplay && validation.valid && (
          <button
            onClick={() => runCurrentSimulation()}
            className="pointer-events-auto btn-primary text-xs py-1.5 px-3 shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Run Simulation
          </button>
        )}
      </div>

      {/* Main 3D Canvas */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        <Canvas
          camera={{ position: [centerX, cameraDistance * 0.9, -centerY + cameraDistance * 0.9], fov: 42 }}
          shadows
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={['#0D1729']} />
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[centerX + 15, 25, -centerY + 20]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <directionalLight position={[centerX - 10, 15, -centerY - 15]} intensity={0.3} />

          {/* Isometric Building Model & Occupants with Dynamic Bounds */}
          {floor && (
            <Building3DModel
              walls={floor.walls}
              doors={floor.doors}
              blockedDoorIds={runToReplay?.scenario.blockedDoorIds || activeScenario.blockedDoorIds}
              floorBounds={floorBounds}
            />
          )}

          {currentFrame && <Occupants3D agents={currentFrame.agents} />}

          <OrbitControls
            target={[centerX, 1, -centerY]}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={4}
            maxDistance={80}
          />
        </Canvas>
      </div>

      {/* Bottom Playback & Timeline Controls */}
      <div className="h-16 sm:h-20 bg-[#152238]/95 border-t border-[#233554] px-4 md:px-6 flex items-center justify-between z-10 backdrop-blur-md gap-3">
        {/* Play/Pause & Reset */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              if (frames.length === 0 && validation.valid) {
                runCurrentSimulation();
              }
              setIsPlaying(!isPlaying);
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#315CFA] hover:bg-[#2347d9] text-white flex items-center justify-center shadow-md shadow-blue-500/20 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
          </button>
          <button
            onClick={() => {
              setFrameIdx(0);
              setIsPlaying(true);
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1e293b] hover:bg-[#24344d] border border-[#2e4265] text-slate-300 flex items-center justify-center transition-colors"
            title="Reset Timeline"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Scrub Slider */}
        <div className="flex-1 mx-2 sm:mx-6 flex items-center gap-2 sm:gap-4 min-w-0">
          <span className="text-[11px] font-mono text-slate-400 shrink-0">0.0s</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={frameIdx}
            onChange={e => {
              setFrameIdx(Number(e.target.value));
              setIsPlaying(false);
            }}
            className="flex-1 h-2 bg-[#233554] rounded-lg appearance-none cursor-pointer accent-[#315CFA] min-w-16"
          />
          <span className="text-[11px] font-mono text-slate-300 shrink-0">
            {frames[frames.length - 1]?.timeSeconds.toFixed(1) || '0.0'}s
          </span>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 bg-[#0D1729] p-0.5 sm:p-1 rounded-lg border border-[#233554] shrink-0">
          {[0.5, 1.0, 2.0, 4.0].map(s => (
            <button
              key={s}
              onClick={() => setSpeedMultiplier(s)}
              className={`px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all ${
                speedMultiplier === s
                  ? 'bg-[#315CFA] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
