import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { detectFloorPlanFromPixelData } from '../src/services/planDetector';
import { validateBuildingGeometry } from '../src/schemas/building';
import { runSimulation } from '../src/simulation/engine';
import { runStressTestAgent } from '../src/agent/orchestrator';

function decodePNGFile(filePath: string) {
  const buf = fs.readFileSync(filePath);
  let pos = 8, width = 0, height = 0;
  const idats: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
    } else if (type === 'IDAT') {
      idats.push(buf.slice(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const bpp = 4;
  const stride = width * bpp;
  const pixels = Buffer.alloc(width * height * 4);

  let rawPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawPos++];
    const prevLine = y > 0 ? (y - 1) * stride : null;
    const currLine = y * stride;
    for (let x = 0; x < stride; x++) {
      const rawVal = raw[rawPos++];
      let a = x >= bpp ? pixels[currLine + x - bpp] : 0;
      let b = prevLine !== null ? pixels[prevLine + x] : 0;
      let c = (prevLine !== null && x >= bpp) ? pixels[prevLine + x - bpp] : 0;
      let val = rawVal;
      if (filter === 1) val = (rawVal + a) & 0xff;
      else if (filter === 2) val = (rawVal + b) & 0xff;
      else if (filter === 3) val = (rawVal + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        let pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        val = (rawVal + pr) & 0xff;
      }
      pixels[currLine + x] = val;
    }
  }
  return { pixels, width, height };
}

describe('Intelligent Plan Detection & 3D Conversion Engine', () => {
  it('detects walls, doors, rooms, and safety equipment from the Home Emergency Plan image', () => {
    const { pixels, width, height } = decodePNGFile('public/samples/home_fire_plan.png');
    expect(width).toBe(650);
    expect(height).toBe(743);

    const result = detectFloorPlanFromPixelData(pixels, width, height, {
      buildingName: 'Residential Emergency Plan 3D',
      sourceName: 'home_fire_plan.png',
    });

    // 1. Verify detected stats
    expect(result.stats.wallsCount).toBeGreaterThanOrEqual(15);
    expect(result.stats.doorsCount).toBeGreaterThanOrEqual(8);
    expect(result.stats.exitsCount).toBe(1);
    expect(result.stats.roomsCount).toBe(11);
    expect(result.stats.extinguishersCount).toBe(4);
    expect(result.stats.egressArrowsCount).toBeGreaterThanOrEqual(4);
    expect(result.stats.stairsCount).toBe(1);

    // 2. Verify strict geometry validation passes with 0 errors
    expect(result.validation.valid).toBe(true);
    expect(result.validation.issues.filter(i => i.severity === 'error')).toHaveLength(0);

    // 3. Verify scale and units
    expect(result.building.units).toBe('m');
    expect(result.building.floors[0].elevationM).toBe(0);
    expect(result.building.importProvenance?.scaleConfirmed).toBe(true);
    expect(result.building.importProvenance?.geometryReviewed).toBe(true);
  });

  it('runs deterministic evacuation simulation on the detected 3D building plan with 100% egress', () => {
    const { pixels, width, height } = decodePNGFile('public/samples/home_fire_plan.png');
    const result = detectFloorPlanFromPixelData(pixels, width, height);

    const sim = runSimulation(result.building, {
      id: 'detected-plan-baseline',
      name: 'Detected Plan Baseline Simulation',
      seed: 42,
      blockedDoorIds: [],
    });

    expect(sim.metrics.completed).toBe(true);
    expect(sim.metrics.totalSpawned).toBe(22);
    expect(sim.metrics.exitedCount).toBe(22);
    expect(sim.metrics.unreachableCount).toBe(0);
    expect(sim.metrics.clearanceTimeSeconds).toBeGreaterThan(10);
    expect(sim.metrics.clearanceTimeSeconds).toBeLessThan(35);
  });

  it('runs Meta AI stress-testing on the detected building and detects disruption impact', async () => {
    const { pixels, width, height } = decodePNGFile('public/samples/home_fire_plan.png');
    const result = detectFloorPlanFromPixelData(pixels, width, height);

    const report = await runStressTestAgent(
      result.building,
      { maxScenarios: 2, seed: 42, useBackendApi: false }
    );

    expect(report.baselineRun.metrics.exitedCount).toBe(22);
    expect(report.candidateRuns.length).toBe(2);
    expect(report.findings.length).toBeGreaterThan(0);

    // Primary exit blockage should be identified as critical impact
    const exitFinding = report.findings.find(f => f.scenarioId.includes('stress-1'));
    expect(exitFinding).toBeDefined();
    expect(exitFinding?.comparison.unreachableDelta).toBeGreaterThan(0);
  });
});
