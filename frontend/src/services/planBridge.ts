/**
 * Bridge for passing plan data from PlanScreen to ExerciseRecordScreen.
 * Route params are fragile when the target screen may already be mounted —
 * this module-level store guarantees data is available regardless of navigation state.
 */

export interface PlanExerciseData {
  exerciseName: string;
  targetSets: number;
  targetReps: string;
}

export interface PendingPlan {
  exerciseNames: string;
  muscleGroup: string;
  exercises: PlanExerciseData[];
}

let _pending: PendingPlan | null = null;

export function setPendingPlan(plan: PendingPlan): void {
  _pending = plan;
}

export function takePendingPlan(): PendingPlan | null {
  const p = _pending;
  _pending = null;
  return p;
}
