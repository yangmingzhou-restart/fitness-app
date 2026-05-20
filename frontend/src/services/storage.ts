import * as FileSystem from 'expo-file-system/legacy';

const BASE_DIR = `${FileSystem.documentDirectory}fitness_data/`;

interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface FoodRecord {
  id: string;
  imageThumbnail: string;
  foods: any[];
  totalCalories: number;
  totalMacros: Macros | null;
  createdAt: string;
}

interface ExerciseSet {
  weight: number;
  reps: number;
  rpe: number | null;
  completed: boolean;
}

interface ExerciseRecord {
  id: string;
  exerciseName: string;
  muscleGroup: string;
  date: string;
  sets: ExerciseSet[];
  notes: string;
}

interface PlanExercise {
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  targetWeight?: number;
  targetRpe?: number;
}

interface PlanTemplate {
  id: string;
  name: string;
  nameEn?: string;
  muscleGroup: string;
  exercises: PlanExercise[];
}

interface UserSettings {
  weightUnit: 'kg' | 'lbs';
  language: string;
}

const FILES = {
  foodRecords: 'food_records.json',
  exerciseRecords: 'exercise_records.json',
  plans: 'plans.json',
  settings: 'settings.json',
  bodyStats: 'body_stats.json',
  exerciseTimerSettings: 'exercise_timer_settings.json',
  deviceId: 'device_id.json',
};

export interface ExerciseTimerSettings {
  [exerciseName: string]: {
    restSec: number;
    alarmSec: number;
  };
}

export interface BodyStatsEntry {
  id: string;
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  chestCm: number | null;
  waistCm: number | null;
  armCm: number | null;
  legCm: number | null;
  photoFront: string | null;
  photoSide: string | null;
  photoBack: string | null;
  notes: string;
  createdAt: string;
}

async function ensureDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(BASE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BASE_DIR, { intermediates: true });
  }
}

async function readJSON<T>(filename: string): Promise<T | null> {
  try {
    const path = BASE_DIR + filename;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const content = await FileSystem.readAsStringAsync(path);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeJSON<T>(filename: string, data: T): Promise<void> {
  await ensureDir();
  const path = BASE_DIR + filename;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data));
}

export async function getFoodRecords(): Promise<FoodRecord[]> {
  return (await readJSON<FoodRecord[]>(FILES.foodRecords)) || [];
}

export async function saveFoodRecord(record: FoodRecord): Promise<void> {
  const records = await getFoodRecords();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.unshift(record);
  await writeJSON(FILES.foodRecords, records);
}

export async function getExerciseRecords(): Promise<ExerciseRecord[]> {
  return (await readJSON<ExerciseRecord[]>(FILES.exerciseRecords)) || [];
}

export async function getExerciseRecordsByDate(date: string): Promise<ExerciseRecord[]> {
  const records = await getExerciseRecords();
  return records.filter((r) => r.date === date);
}

// Mutex to serialize exercise record writes — prevents concurrent
// read-modify-write cycles from corrupting the records array.
let _writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(fn: () => Promise<void>): Promise<void> {
  const task = _writeQueue.then(() => fn());
  _writeQueue = task.catch(() => {});
  return task;
}

export async function saveExerciseRecord(record: ExerciseRecord): Promise<void> {
  return enqueueWrite(async () => {
    const records = await getExerciseRecords();
    const idx = records.findIndex((r) => r.id === record.id);
    if (idx >= 0) records[idx] = record;
    else records.push(record);
    await writeJSON(FILES.exerciseRecords, records);
  });
}

export async function deleteExerciseRecord(id: string): Promise<void> {
  return enqueueWrite(async () => {
    const records = await getExerciseRecords();
    await writeJSON(FILES.exerciseRecords, records.filter((r) => r.id !== id));
  });
}

export async function getPlans(): Promise<PlanTemplate[]> {
  return (await readJSON<PlanTemplate[]>(FILES.plans)) || [];
}

export async function savePlan(plan: PlanTemplate): Promise<void> {
  const plans = await getPlans();
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  await writeJSON(FILES.plans, plans);
}

export async function getSettings(): Promise<UserSettings> {
  return (await readJSON<UserSettings>(FILES.settings)) || {
    weightUnit: 'kg',
    language: 'zh',
  };
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await writeJSON(FILES.settings, settings);
}

export async function getBodyStats(): Promise<BodyStatsEntry[]> {
  return (await readJSON<BodyStatsEntry[]>(FILES.bodyStats)) || [];
}

export async function saveBodyStat(entry: BodyStatsEntry): Promise<void> {
  const entries = await getBodyStats();
  const idx = entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  entries.sort((a, b) => b.date.localeCompare(a.date));
  await writeJSON(FILES.bodyStats, entries);
}

export async function deleteBodyStat(id: string): Promise<void> {
  const entries = await getBodyStats();
  await writeJSON(FILES.bodyStats, entries.filter((e) => e.id !== id));
}

export async function getExerciseTimerSettings(): Promise<ExerciseTimerSettings> {
  return (await readJSON<ExerciseTimerSettings>(FILES.exerciseTimerSettings)) || {};
}

function generateDeviceId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${t}-${r}`;
}

export async function getDeviceId(): Promise<string> {
  const stored = await readJSON<{ id: string }>(FILES.deviceId);
  if (stored?.id) return stored.id;
  const id = generateDeviceId();
  await writeJSON(FILES.deviceId, { id });
  return id;
}

export async function saveExerciseTimerSettings(name: string, restSec: number, alarmSec: number): Promise<void> {
  const settings = await getExerciseTimerSettings();
  settings[name] = { restSec, alarmSec };
  await writeJSON(FILES.exerciseTimerSettings, settings);
}
