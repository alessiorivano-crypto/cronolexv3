export interface Lap {
  lapNumber: number;
  totalTime: number;
  totalDistance: number;
  timestamp: number;
}

export interface Athlete {
  id: number;
  name: string;
  startTime: number | null;
  time: number;
  laps: Lap[];
  isRunning: boolean;
  targetDistance: number;
  targetTime: number;
  pbDistance: number;
  pbTime: number;
  lapDistance: number;
}