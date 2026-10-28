import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Users,
  AlertOctagon,
  CheckCircle2,
  Maximize2,
  Repeat,
  Camera,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Wall, Door, Room } from '../../schemas/building';
import { SimulationFrame, AgentTracePoint } from '../../simulation/types';

// Component to render 3D Building Floor, Extruded Walls, Exit Mats, & Room Labels
const Building3DModel: React.FC<{
  walls: Wall[];
  doors: Door[];
  rooms: Room[];
  blockedDoorIds: string[];
  floorBounds: { minX: number; minY: number; maxX: number; maxY: number };
}> = ({ walls, doors, rooms, blockedDoorIds, floorBounds }) => {
  const blockedSet = useMemo(() => new Set(blockedDoorIds), [blockedDoorIds]);

  const { wallMeshes, exitMats, blockedBarriers } = useMemo(() => {
    const wallElements: JSX.Element[] = [];
    const exitMatElements: JSX.Element[] = [];
    const barrierElements: JSX.Element[] = [];

    walls.forEach((wall, wIdx) => {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      if (wallLen < 0.01) return;

      const angle = Math.atan2(dy, dx);
      const doorsOnWall = doors.filter(d => d.wallId === wall.id);

      if (doorsOnWall.length === 0) {
        // Solid wall without doors
        wallElements.push(
          <mesh
            key={`wall-${wIdx}`}
            position={[wall.start.x + dx / 2, wall.heightM / 2, -(wall.start.y + dy / 2)]}
            rotation={[0, angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[wallLen, wall.heightM, wall.thicknessM]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.15} />
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

            wallElements.push(
              <mesh
                key={`wall-${wIdx}-seg-${dIdx}`}
                position={[midX, wall.heightM / 2, -midY]}
                rotation={[0, angle, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[segLength, wall.heightM, wall.thicknessM]} />
                <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.15} />
              </mesh>
            );
          }

          const doorMid = door.offsetM + door.widthM / 2;
          const doorMidX = wall.start.x + Math.cos(angle) * doorMid;
          const doorMidY = wall.start.y + Math.sin(angle) * doorMid;
          const doorHeight = 2.1;
          const lintelHeight = Math.max(0.1, wall.heightM - doorHeight);

          // Lintel above door
          wallElements.push(
            <mesh
              key={`wall-${wIdx}-lintel-${dIdx}`}
              position={[doorMidX, doorHeight + lintelHeight / 2, -doorMidY]}
              rotation={[0, angle, 0]}
              castShadow
            >
              <boxGeometry args={[door.widthM, lintelHeight, wall.thicknessM]} />
              <meshStandardMaterial color="#334155" roughness={0.5} />
            </mesh>
          );

          // If exit door: render illuminated green discharge threshold & wayfinding sign
          if (door.kind === 'exit') {
            exitMatElements.push(
              <group key={`exit-mat-${door.id}`}>
                {/* Glowing Floor Threshold */}
                <mesh
                  position={[doorMidX, 0.015, -doorMidY]}
                  rotation={[-Math.PI / 2, 0, angle]}
                >
                  <planeGeometry args={[door.widthM, 1.4]} />
                  <meshStandardMaterial
                    color="#059669"
                    emissive="#10b981"
                    emissiveIntensity={0.65}
                    roughness={0.2}
                    transparent
                    opacity={0.85}
                  />
                </mesh>
                {/* Overhead Exit Beacon Sign */}
                <mesh position={[doorMidX, doorHeight + 0.35, -doorMidY]} rotation={[0, angle, 0]}>
                  <boxGeometry args={[Math.min(1.2, door.widthM * 0.9), 0.3, 0.08]} />
                  <meshStandardMaterial
                    color="#064e3b"
                    emissive="#10b981"
                    emissiveIntensity={0.8}
                    roughness={0.1}
                  />
                </mesh>
                <Text
                  position={[doorMidX + Math.sin(angle) * 0.05, doorHeight + 0.35, -doorMidY + Math.cos(angle) * 0.05]}
                  rotation={[0, angle, 0]}
                  fontSize={0.15}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                >
                  EXIT ➔
                </Text>
              </group>
            );
          }

          // If blocked door: render red physical warning barrier with hazard sign
          const isBlocked = blockedSet.has(door.id) || !door.passable;
          if (isBlocked) {
            barrierElements.push(
              <group key={`barrier-${door.id}`}>
                <mesh
                  position={[doorMidX, doorHeight / 2, -doorMidY]}
                  rotation={[0, angle, 0]}
                >
                  <boxGeometry args={[door.widthM * 0.96, doorHeight * 0.96, wall.thicknessM * 0.9]} />
                  <meshStandardMaterial
                    color="#b91c1c"
                    emissive="#ef4444"
                    emissiveIntensity={0.4}
                    roughness={0.3}
                    metalness={0.2}
                    transparent
                    opacity={0.92}
                  />
                </mesh>
                <Text
                  position={[doorMidX + Math.sin(angle) * (wall.thicknessM * 0.5), doorHeight * 0.6, -doorMidY + Math.cos(angle) * (wall.thicknessM * 0.5)]}
                  rotation={[0, angle, 0]}
                  fontSize={0.18}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                >
                  BLOCKED
                </Text>
              </group>
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

          wallElements.push(
            <mesh
              key={`wall-${wIdx}-end`}
              position={[midX, wall.heightM / 2, -midY]}
              rotation={[0, angle, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[remLength, wall.heightM, wall.thicknessM]} />
              <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.15} />
            </mesh>
          );
        }
      }
    });

    return { wallMeshes: wallElements, exitMats: exitMatElements, blockedBarriers: barrierElements };
  }, [walls, doors, blockedSet]);

  // Dynamic floor dimensions with architectural bevel
  const fWidth = Math.max(12, floorBounds.maxX - floorBounds.minX + 8);
  const fHeight = Math.max(12, floorBounds.maxY - floorBounds.minY + 8);
  const centerX = (floorBounds.minX + floorBounds.maxX) / 2;
  const centerY = (floorBounds.minY + floorBounds.maxY) / 2;

  // Calculate room center points for floor labels
  const roomLabels = useMemo(() => {
    return rooms.map(room => {
      if (room.outline.length === 0) return null;
      let sumX = 0;
      let sumY = 0;
      for (const pt of room.outline) {
        sumX += pt.x;
        sumY += pt.y;
      }
      const cx = sumX / room.outline.length;
      const cy = sumY / room.outline.length;

      return (
        <group key={`room-label-${room.id}`} position={[cx, 0.02, -cy]}>
          <Text
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.45}
            color="#475569"
            anchorX="center"
            anchorY="middle"
          >
            {room.name.toUpperCase()}
          </Text>
        </group>
      );
    });
  }, [rooms]);

  return (
    <group>
      {/* Dark Architectural Floor Slab */}
      <mesh position={[centerX, -0.06, -centerY]} receiveShadow>
        <boxGeometry args={[fWidth, 0.12, fHeight]} />
        <meshStandardMaterial color="#0b1329" roughness={0.9} />
      </mesh>

      {/* Subtle Beveled Perimeter Rim */}
      <mesh position={[centerX, -0.15, -centerY]}>
        <boxGeometry args={[fWidth + 0.6, 0.08, fHeight + 0.6]} />
        <meshStandardMaterial color="#070c18" roughness={0.95} />
      </mesh>

      {/* Architectural Grid on Floor */}
      <Grid
        position={[centerX, 0.005, -centerY]}
        args={[fWidth, fHeight]}
        cellSize={1}
        cellThickness={0.7}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1.4}
        sectionColor="#334155"
        fadeDistance={55}
        infiniteGrid={false}
      />

      {/* Wall Extrusions */}
      {wallMeshes}

      {/* Exit Mats & Beacons */}
      {exitMats}

      {/* Blocked Door Barricades */}
      {blockedBarriers}

      {/* Floor Room Blueprint Labels */}
      {roomLabels}
    </group>
  );
};

// High-Performance Instanced Occupant Renderer with Smooth useFrame Motion Lerping
const OccupantsInstanced3D: React.FC<{
  frames: SimulationFrame[];
  playbackTimeRef: React.MutableRefObject<number>;
  isPlaying: boolean;
  speedMultiplier: number;
  maxTime: number;
  loop: boolean;
  onTimeUpdate: (t: number, fIdx: number, activeCount: number, exitedCount: number) => void;
}> = ({
  frames,
  playbackTimeRef,
  isPlaying,
  speedMultiplier,
  maxTime,
  loop,
  onTimeUpdate,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Collect all unique agent IDs across all frames
  const allAgentIds = useMemo(() => {
    const idSet = new Set<string>();
    for (const f of frames) {
      for (const ag of f.agents) {
        idSet.add(ag.id);
      }
    }
    return Array.from(idSet).sort();
  }, [frames]);

  // Pre-index frames into Map for O(1) instant lookup
  const frameMaps = useMemo(() => {
    return frames.map(f => {
      const map = new Map<string, AgentTracePoint>();
      for (const ag of f.agents) {
        map.set(ag.id, ag);
      }
      return map;
    });
  }, [frames]);

  const lastAngles = useRef<Float32Array>(new Float32Array(allAgentIds.length));
  const lastUiUpdate = useRef<number>(0);

  // Resize angle tracking buffer when scenario agent count changes
  useEffect(() => {
    lastAngles.current = new Float32Array(allAgentIds.length);
  }, [allAgentIds.length]);

  // Three.js colors for status states
  const colorMoving = useMemo(() => new THREE.Color('#38bdf8'), []); // vibrant electric cyan-blue
  const colorWaiting = useMemo(() => new THREE.Color('#fbbf24'), []); // warm amber queueing
  const colorTrapped = useMemo(() => new THREE.Color('#ef4444'), []); // crimson trapped/unreachable
  const colorExiting = useMemo(() => new THREE.Color('#10b981'), []); // emerald green exiting

  useFrame((_, delta) => {
    if (!meshRef.current || frames.length === 0) return;

    // Advance continuous time if playing
    if (isPlaying) {
      playbackTimeRef.current += delta * speedMultiplier;
      if (playbackTimeRef.current >= maxTime) {
        if (loop) {
          playbackTimeRef.current = 0;
        } else {
          playbackTimeRef.current = maxTime;
        }
      }
    }

    const t = Math.max(0, Math.min(maxTime, playbackTimeRef.current));

    // Calculate frame indices f0, f1 and interpolation fraction alpha
    const sampleInterval = frames.length > 1 ? frames[1].timeSeconds - frames[0].timeSeconds : 0.25;
    const rawIndex = sampleInterval > 0 ? t / sampleInterval : 0;
    const f0 = Math.min(frames.length - 1, Math.max(0, Math.floor(rawIndex)));
    const f1 = Math.min(frames.length - 1, f0 + 1);
    const t0 = frames[f0].timeSeconds;
    const t1 = frames[f1].timeSeconds;
    const alpha = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;

    const map0 = frameMaps[f0];
    const map1 = frameMaps[f1];

    let currentActiveCount = 0;
    let currentExitedCount = frames[f0]?.exitedCumulative ?? 0;

    // Update each instanced occupant matrix and color
    for (let i = 0; i < allAgentIds.length; i++) {
      const id = allAgentIds[i];
      const a0 = map0?.get(id);
      const a1 = map1?.get(id);

      if (!a0 && !a1) {
        dummy.position.set(0, -100, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      if (a0?.status === 'exited' && a1?.status === 'exited') {
        dummy.position.set(0, -100, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      // Smoothly interpolate position (lerp)
      const x0 = a0 ? a0.x : a1!.x;
      const y0 = a0 ? a0.y : a1!.y;
      const x1 = a1 ? a1.x : a0!.x;
      const y1 = a1 ? a1.y : a0!.y;

      const posX = (1 - alpha) * x0 + alpha * x1;
      const posY = (1 - alpha) * y0 + alpha * y1;

      // Calculate facing direction angle (yaw)
      const dx = x1 - x0;
      const dy = y1 - y0;
      let angle = lastAngles.current[i];
      if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) {
        angle = Math.atan2(dy, dx);
        lastAngles.current[i] = angle;
      }

      // Calculate scale (smooth exit dissolution when crossing door)
      let scale = 1.0;
      if (a1?.status === 'exited' && a0?.status !== 'exited') {
        scale = Math.max(0, 1.0 - alpha * 1.25);
      } else if (!a0 && a1) {
        scale = Math.min(1.0, alpha * 1.25);
      }

      if (scale > 0.05) {
        currentActiveCount++;
      }

      // Set transform: Three.js coordinates: X = posX, Y = 0.45, Z = -posY
      dummy.position.set(posX, 0.45 * scale, -posY);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Set instance color based on status
      const isTrapped = a0?.status === 'unreachable' || a1?.status === 'unreachable';
      const isExiting = a1?.status === 'exited';
      const isWaiting = Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3;

      if (isTrapped) {
        meshRef.current.setColorAt(i, colorTrapped);
      } else if (isExiting) {
        meshRef.current.setColorAt(i, colorExiting);
      } else if (isWaiting) {
        meshRef.current.setColorAt(i, colorWaiting);
      } else {
        meshRef.current.setColorAt(i, colorMoving);
      }
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    // Throttle UI synchronization to ~20 Hz to avoid React re-render overhead
    const now = performance.now();
    if (now - lastUiUpdate.current > 50) {
      lastUiUpdate.current = now;
      onTimeUpdate(t, f0, currentActiveCount, currentExitedCount);
    }
  });

  if (allAgentIds.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, allAgentIds.length]}
      castShadow
      receiveShadow
    >
      <capsuleGeometry args={[0.2, 0.45, 8, 16]} />
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.25}
        metalness={0.2}
        emissiveIntensity={0.3}
      />
    </instancedMesh>
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
  const maxTime = frames.length > 0 ? frames[frames.length - 1].timeSeconds : 0;

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [loop, setLoop] = useState<boolean>(true);

  // Time & counter state for HUD display
  const playbackTimeRef = useRef<number>(0);
  const [uiTime, setUiTime] = useState<number>(0);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [liveActiveCount, setLiveActiveCount] = useState<number>(0);
  const [liveExitedCount, setLiveExitedCount] = useState<number>(0);

  const controlsRef = useRef<any>(null);

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

  // Handle throttled time updates from the 3D render loop
  const handleTimeUpdate = useCallback(
    (t: number, fIdx: number, activeCount: number, exitedCount: number) => {
      setUiTime(t);
      setCurrentFrameIdx(fIdx);
      setLiveActiveCount(activeCount);
      setLiveExitedCount(exitedCount);
    },
    []
  );

  // Camera preset controller
  const setCameraView = (view: 'iso' | 'top' | 'front') => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    const camera = controls.object as THREE.Camera;

    if (view === 'top') {
      camera.position.set(centerX, cameraDistance * 1.5, -centerY + 0.01);
      controls.target.set(centerX, 0, -centerY);
    } else if (view === 'front') {
      camera.position.set(centerX, cameraDistance * 0.55, -centerY + cameraDistance * 1.2);
      controls.target.set(centerX, 1, -centerY);
    } else {
      // Isometric 3D
      camera.position.set(centerX + cameraDistance * 0.75, cameraDistance * 0.85, -centerY + cameraDistance * 0.75);
      controls.target.set(centerX, 1, -centerY);
    }
    controls.update();
  };

  const handleSliderSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    playbackTimeRef.current = newTime;
    setUiTime(newTime);
  };

  const totalSpawned = runToReplay?.metrics.totalSpawned ?? 0;
  const evacuationProgress = totalSpawned > 0 ? Math.min(100, (liveExitedCount / totalSpawned) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#070D1E] select-none text-white relative overflow-hidden">
      {/* Validation Error State Notice */}
      {!validation.valid && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
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

      {/* Top Glassmorphic Overlay HUD */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Active Scenario Card */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-700/60 px-3.5 py-1.5 rounded-xl shadow-xl flex items-center gap-3">
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Active Scenario</div>
              <div className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-xs">
                {runToReplay?.scenario.name || activeScenario.name}
              </div>
            </div>
            <div className="w-[1px] h-6 bg-slate-700/60" />
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Simulated Elapsed</div>
              <div className="text-xs sm:text-sm font-black text-cyan-400 font-mono tracking-tight">
                {uiTime.toFixed(2)}s / {maxTime.toFixed(1)}s
              </div>
            </div>
          </div>

          {/* Live Progress Bar & Counters */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[9px] text-slate-400 block font-bold uppercase">Evacuated</span>
                <span className="font-extrabold text-emerald-400 font-mono">
                  {liveExitedCount} <span className="text-slate-500 text-[10px]">({evacuationProgress.toFixed(0)}%)</span>
                </span>
              </div>
            </div>

            <div className="w-[1px] h-6 bg-slate-700/60" />

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-[9px] text-slate-400 block font-bold uppercase">In Egress</span>
                <span className="font-extrabold text-cyan-400 font-mono">
                  {liveActiveCount}
                </span>
              </div>
            </div>

            {(runToReplay?.metrics.unreachableCount ?? 0) > 0 && (
              <>
                <div className="w-[1px] h-6 bg-slate-700/60" />
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Trapped</span>
                    <span className="font-extrabold text-rose-400 font-mono">
                      {runToReplay?.metrics.unreachableCount}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Camera Preset Quick Bar */}
        <div className="flex items-center gap-1 bg-[#0f172a]/90 backdrop-blur-md border border-slate-700/60 p-1 rounded-xl shadow-xl pointer-events-auto">
          <button
            onClick={() => setCameraView('iso')}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
            title="Isometric 3D Perspective"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            3D Iso
          </button>
          <button
            onClick={() => setCameraView('top')}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
            title="Top-Down Blueprint Plan"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Top Plan
          </button>
          <button
            onClick={() => setCameraView('front')}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Eye Level Perspective"
          >
            Front
          </button>
        </div>
      </div>

      {/* Main High-Fidelity 3D WebGL Canvas */}
      <div className="flex-1 w-full h-full cursor-grab active:cursor-grabbing">
        <Canvas
          camera={{
            position: [centerX + cameraDistance * 0.75, cameraDistance * 0.85, -centerY + cameraDistance * 0.75],
            fov: 40,
            near: 0.1,
            far: 500,
          }}
          shadows
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
        >
          <color attach="background" args={['#070D1E']} />

          {/* Premium Architectural Studio Lighting */}
          <ambientLight intensity={0.45} />
          <hemisphereLight args={['#38bdf8', '#070D1E', 0.4]} />

          {/* Key Sun Light with Soft Shadow Mapping */}
          <directionalLight
            position={[centerX + 20, 30, -centerY + 25]}
            intensity={1.4}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0001}
          />

          {/* Cool Fill Light for interior corridor shadows */}
          <directionalLight position={[centerX - 15, 18, -centerY - 20]} intensity={0.5} />

          {/* Subtle Rim Light to accentuate occupant silhouettes */}
          <pointLight position={[centerX, 15, -centerY]} intensity={0.3} color="#38bdf8" />

          {/* 3D Cutaway Building Geometry */}
          {floor && (
            <Building3DModel
              walls={floor.walls}
              doors={floor.doors}
              rooms={floor.rooms}
              blockedDoorIds={runToReplay?.scenario.blockedDoorIds || activeScenario.blockedDoorIds}
              floorBounds={floorBounds}
            />
          )}

          {/* Smoothly Interpolated Instanced Occupants */}
          {frames.length > 0 && (
            <OccupantsInstanced3D
              frames={frames}
              playbackTimeRef={playbackTimeRef}
              isPlaying={isPlaying}
              speedMultiplier={speedMultiplier}
              maxTime={maxTime}
              loop={loop}
              onTimeUpdate={handleTimeUpdate}
            />
          )}

          <OrbitControls
            ref={controlsRef}
            target={[centerX, 0.5, -centerY]}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={4}
            maxDistance={120}
            enableDamping
            dampingFactor={0.06}
          />
        </Canvas>
      </div>

      {/* Modern Glassmorphic Playback Control Bar */}
      <div className="h-16 sm:h-20 bg-[#0b1329]/95 border-t border-slate-800/80 px-4 md:px-6 flex items-center justify-between z-10 backdrop-blur-lg gap-3">
        {/* Play/Pause, Rewind, & Loop */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              if (frames.length === 0 && validation.valid) {
                runCurrentSimulation();
              }
              setIsPlaying(!isPlaying);
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95"
            title={isPlaying ? 'Pause Simulation' : 'Play Smooth 60fps Replay'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>

          <button
            onClick={() => {
              playbackTimeRef.current = 0;
              setUiTime(0);
              setIsPlaying(true);
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white flex items-center justify-center transition-all"
            title="Reset Timeline to Start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setLoop(!loop)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border transition-all flex items-center justify-center ${
              loop
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white'
            }`}
            title={loop ? 'Continuous Loop Enabled' : 'Loop Disabled'}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Scrub Timeline Slider with Real-Time Millisecond Precision */}
        <div className="flex-1 mx-2 sm:mx-6 flex items-center gap-2 sm:gap-4 min-w-0">
          <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">0.0s</span>
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={maxTime > 0 ? maxTime : 1}
              step={0.01}
              value={uiTime}
              onChange={handleSliderSeek}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 min-w-16 transition-all"
            />
          </div>
          <span className="text-[11px] font-mono font-bold text-cyan-400 shrink-0">
            {maxTime.toFixed(1)}s
          </span>
        </div>

        {/* Speed Multiplier Pill Selector */}
        <div className="flex items-center gap-1 bg-[#070D1E] p-1 rounded-xl border border-slate-800/80 shrink-0">
          {[0.5, 1.0, 2.0, 4.0, 8.0].map(s => (
            <button
              key={s}
              onClick={() => setSpeedMultiplier(s)}
              className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
                speedMultiplier === s
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
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
