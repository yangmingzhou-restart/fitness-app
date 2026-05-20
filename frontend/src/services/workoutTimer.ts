import { Vibration, AppState } from 'react-native';

export type TimerState = 'idle' | 'active' | 'resting' | 'alarm' | 'paused';

type Listener = () => void;

class WorkoutTimerService {
  state: TimerState = 'idle';
  tick: number = 0;

  // Timing anchors (absolute timestamps in ms)
  startTime: number = 0;
  restEndTime: number = 0;
  alarmEndTime: number = 0;

  // Pause bookmark
  pausedAt: number = 0;

  // Config
  restDuration: number = 90;
  alarmDuration: number = 30;

  // Set-complete prompt flag
  showSetComplete: boolean = false;

  private listeners = new Set<Listener>();
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private appStateSub: any = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // ---- Config setters (no notify, avoids re-render lag on each keystroke) ----

  setRestDuration(sec: number) {
    this.restDuration = sec;
  }

  setAlarmDuration(sec: number) {
    this.alarmDuration = sec;
  }

  // ---- Timer lifecycle ----

  startWorkout() {
    this.startTime = Date.now();
    this.state = 'active';
    this.tick = 0;
    this.showSetComplete = false;
    this.ensureInterval();
    this.notify();
  }

  startRest() {
    this.restEndTime = Date.now() + this.restDuration * 1000;
    this.state = 'resting';
    this.ensureInterval();
    this.notify();
  }

  skipRest() {
    // Go directly to alarm phase (not active) — requirement 5
    this.alarmEndTime = Date.now() + this.alarmDuration * 1000;
    this.state = 'alarm';
    this.notify();
  }

  skipAlarm() {
    // Simple skip — go back to active
    this.showSetComplete = false;
    this.state = 'active';
    this.notify();
  }

  dismissSetComplete() {
    this.state = 'active';
    this.showSetComplete = false;
    this.notify();
  }

  pause() {
    if (this.state === 'active' || this.state === 'resting' || this.state === 'alarm') {
      this.pausedAt = Date.now();
      this.state = 'paused';
      this.stopInterval();
      this.notify();
    }
  }

  resume() {
    if (this.state !== 'paused') return;
    const elapsed = Date.now() - this.pausedAt;
    if (this.restEndTime > 0) this.restEndTime += elapsed;
    if (this.alarmEndTime > 0) this.alarmEndTime += elapsed;
    this.startTime += elapsed;

    if (this.alarmEndTime > Date.now()) {
      this.state = 'alarm';
    } else if (this.restEndTime > Date.now()) {
      this.state = 'resting';
    } else {
      this.state = 'active';
    }
    this.pausedAt = 0;
    this.ensureInterval();
    this.notify();
  }

  finishWorkout() {
    this.state = 'idle';
    this.tick = 0;
    this.showSetComplete = false;
    this.stopInterval();
    this.notify();
  }

  // ---- Computed values ----

  getElapsedSec(): number {
    if (this.state === 'idle') return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getRemainingRest(): number {
    if (this.state === 'resting') {
      return Math.max(0, Math.ceil((this.restEndTime - Date.now()) / 1000));
    }
    if (this.state === 'paused' && this.restEndTime > this.pausedAt) {
      return Math.max(0, Math.ceil((this.restEndTime - this.pausedAt) / 1000));
    }
    return this.restDuration;
  }

  getRemainingAlarm(): number {
    if (this.state === 'alarm') {
      return Math.max(0, Math.ceil((this.alarmEndTime - Date.now()) / 1000));
    }
    if (this.state === 'paused' && this.alarmEndTime > this.pausedAt) {
      return Math.max(0, Math.ceil((this.alarmEndTime - this.pausedAt) / 1000));
    }
    return this.alarmDuration;
  }

  // ---- Internal tick ----

  private ensureInterval() {
    if (this.intervalRef) return;
    this.intervalRef = setInterval(() => this.onTick(), 1000);
    this.setupAppState();
  }

  private stopInterval() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    this.teardownAppState();
  }

  private onTick() {
    this.tick++;

    // Check rest completion — vibrate in last 3s (requirement 6)
    if (this.state === 'resting') {
      const remaining = Math.max(0, Math.ceil((this.restEndTime - Date.now()) / 1000));
      if (remaining <= 3 && remaining >= 1) {
        Vibration.vibrate(200);
      } else if (Date.now() >= this.restEndTime) {
        Vibration.vibrate(500);
        this.alarmEndTime = Date.now() + this.alarmDuration * 1000;
        this.state = 'alarm';
      }
    }

    // Check alarm completion — no vibration during alarm (requirement 6)
    if (this.state === 'alarm') {
      if (Date.now() >= this.alarmEndTime) {
        this.showSetComplete = true;
      }
    }

    this.notify();
  }

  // ---- AppState (background/foreground) ----

  private setupAppState() {
    if (this.appStateSub) return;
    this.appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && this.state !== 'idle') {
        this.onTick();
      }
    });
  }

  private teardownAppState() {
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
  }
}

export const workoutTimer = new WorkoutTimerService();
