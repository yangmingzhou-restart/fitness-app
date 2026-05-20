import type { ExerciseInfo } from '../services/api';

// Bundled exercise library data (200+ exercises)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rawExercises: any[] = require('./exercises.json');

function buildCoverImage(exercise: any): string {
  const folder = exercise.name || exercise.id || '';
  if (!folder) return '';
  return `/videos/${folder}/封面.jpg`;
}

function buildVideoUrls(exercise: any): { angle: string; url: string }[] {
  const folder = exercise.name || exercise.id || '';
  if (!folder) return [];
  const angles = ['侧面', '背面', '正面'];
  return angles.map((angle) => ({
    angle,
    url: `/videos/${folder}/${angle}.mp4`,
  }));
}

export function getLocalExercises(): ExerciseInfo[] {
  return rawExercises.map((ex: any) => ({
    id: ex.id || '',
    name: ex.name || '',
    nameEn: ex.nameEn || '',
    muscleGroup: ex.muscleGroup || '',
    secondaryMuscles: ex.secondaryMuscles || [],
    equipment: ex.equipment || '',
    difficulty: ex.difficulty || 'beginner',
    description: ex.description || '',
    tips: ex.tips || [],
    coverImage: buildCoverImage(ex),
    videos: buildVideoUrls(ex),
  }));
}

export function getLocalExerciseById(id: string): ExerciseInfo | undefined {
  const ex = rawExercises.find((e: any) => e.id === id);
  if (!ex) return undefined;
  return {
    id: ex.id || '',
    name: ex.name || '',
    nameEn: ex.nameEn || '',
    muscleGroup: ex.muscleGroup || '',
    secondaryMuscles: ex.secondaryMuscles || [],
    equipment: ex.equipment || '',
    difficulty: ex.difficulty || 'beginner',
    description: ex.description || '',
    tips: ex.tips || [],
    coverImage: buildCoverImage(ex),
    videos: buildVideoUrls(ex),
  };
}
