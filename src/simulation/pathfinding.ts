import { GridCell, NavGrid } from './navgrid';

export interface DistanceField {
  distances: number[][]; // [y][x] distance in meters to closest exit, Infinity if unreachable
  nextStep: (GridCell | null)[][]; // [y][x] best adjacent cell towards exit
}

/**
 * Computes multi-source Dijkstra distance field from all active exit cells.
 * Uses 8-connected grid with corner-cutting prevention.
 */
export function computeExitDistanceField(navGrid: NavGrid): DistanceField {
  const { cols, rows, cells, exitCells } = navGrid;

  const distances: number[][] = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  const nextStep: (GridCell | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));

  if (exitCells.length === 0) {
    return { distances, nextStep };
  }

  // Priority Queue / Min-Heap implementation for Dijkstra
  interface PQNode {
    cell: GridCell;
    dist: number;
  }

  // Fast binary min-heap
  class MinHeap {
    private data: PQNode[] = [];

    push(node: PQNode) {
      this.data.push(node);
      this.bubbleUp(this.data.length - 1);
    }

    pop(): PQNode | undefined {
      if (this.data.length === 0) return undefined;
      const top = this.data[0];
      const bottom = this.data.pop()!;
      if (this.data.length > 0) {
        this.data[0] = bottom;
        this.sinkDown(0);
      }
      return top;
    }

    get size(): number {
      return this.data.length;
    }

    private bubbleUp(index: number) {
      while (index > 0) {
        const parentIdx = (index - 1) >> 1;
        if (this.data[index].dist < this.data[parentIdx].dist) {
          [this.data[index], this.data[parentIdx]] = [this.data[parentIdx], this.data[index]];
          index = parentIdx;
        } else {
          break;
        }
      }
    }

    private sinkDown(index: number) {
      const len = this.data.length;
      while (true) {
        const left = (index << 1) + 1;
        const right = left + 1;
        let smallest = index;

        if (left < len && this.data[left].dist < this.data[smallest].dist) {
          smallest = left;
        }
        if (right < len && this.data[right].dist < this.data[smallest].dist) {
          smallest = right;
        }
        if (smallest !== index) {
          [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
          index = smallest;
        } else {
          break;
        }
      }
    }
  }

  const pq = new MinHeap();

  // Initialize with all exit cells
  for (const exitCell of exitCells) {
    if (exitCell.walkable) {
      distances[exitCell.y][exitCell.x] = 0;
      nextStep[exitCell.y][exitCell.x] = exitCell; // self is exit
      pq.push({ cell: exitCell, dist: 0 });
    }
  }

  // 8-directional offsets: [dx, dy, stepCostFactor]
  const neighbors = [
    { dx: 1, dy: 0, cost: 1.0 },
    { dx: -1, dy: 0, cost: 1.0 },
    { dx: 0, dy: 1, cost: 1.0 },
    { dx: 0, dy: -1, cost: 1.0 },
    { dx: 1, dy: 1, cost: Math.SQRT2 },
    { dx: 1, dy: -1, cost: Math.SQRT2 },
    { dx: -1, dy: 1, cost: Math.SQRT2 },
    { dx: -1, dy: -1, cost: Math.SQRT2 },
  ];

  while (pq.size > 0) {
    const { cell: curr, dist } = pq.pop()!;
    if (dist > distances[curr.y][curr.x]) continue;

    for (const { dx, dy, cost } of neighbors) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;

      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

      const neighborCell = cells[ny][nx];
      if (!neighborCell.walkable) continue;

      // Prevent corner cutting through diagonal walls
      if (dx !== 0 && dy !== 0) {
        const adj1 = cells[curr.y][nx];
        const adj2 = cells[ny][curr.x];
        if (!adj1.walkable || !adj2.walkable) continue;
      }

      const stepDist = cost * navGrid.cellSizeM;
      const newDist = dist + stepDist;

      if (newDist < distances[ny][nx] - 1e-6) {
        distances[ny][nx] = newDist;
        nextStep[ny][nx] = curr; // step points towards cell with smaller distance
        pq.push({ cell: neighborCell, dist: newDist });
      }
    }
  }

  return { distances, nextStep };
}
