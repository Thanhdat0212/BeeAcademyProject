import { completeCourseProgressItem } from '../api/courseProgressService';
import {
  saveStudentVideoProgress,
  type SaveStudentVideoProgressPayload,
} from '../api/studentVideoProgressService';

type QueuedVideoProgress = {
  kind: 'video-progress';
  courseId: string;
  lessonId: string;
  payload: SaveStudentVideoProgressPayload;
  queuedAt: number;
};

type QueuedCompletion = {
  kind: 'completion';
  courseId: string;
  itemId: string;
  itemType: 'lesson' | 'quiz';
  queuedAt: number;
};

type QueueItem = QueuedVideoProgress | QueuedCompletion;

const STORAGE_KEY = 'bee-academy.offline-learning-sync.v1';

function readQueue(): QueueItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value as QueueItem[] : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-100)));
}

function replaceLatest(items: QueueItem[], next: QueueItem, same: (item: QueueItem) => boolean): void {
  writeQueue([...items.filter(item => !same(item)), next]);
}

export function queueVideoProgress(
  courseId: string,
  lessonId: string,
  payload: SaveStudentVideoProgressPayload,
): void {
  const next: QueuedVideoProgress = { kind: 'video-progress', courseId, lessonId, payload, queuedAt: Date.now() };
  replaceLatest(readQueue(), next, item =>
    item.kind === 'video-progress' && item.courseId === courseId && item.lessonId === lessonId,
  );
}

export function queueCompletion(
  courseId: string,
  itemId: string,
  itemType: 'lesson' | 'quiz',
): void {
  const next: QueuedCompletion = { kind: 'completion', courseId, itemId, itemType, queuedAt: Date.now() };
  replaceLatest(readQueue(), next, item =>
    item.kind === 'completion' && item.courseId === courseId && item.itemId === itemId && item.itemType === itemType,
  );
}

/** Flush in order. Failed items remain durable for the next online event/page visit. */
export async function flushOfflineLearningSyncQueue(): Promise<number> {
  if (!navigator.onLine) return 0;
  const items = readQueue();
  const remaining: QueueItem[] = [];
  let synced = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      if (item.kind === 'video-progress') {
        await saveStudentVideoProgress(item.courseId, item.lessonId, item.payload);
      } else {
        await completeCourseProgressItem(item.courseId, { itemId: item.itemId, itemType: item.itemType });
      }
      synced += 1;
    } catch {
      remaining.push(...items.slice(index));
      break;
    }
  }
  writeQueue(remaining);
  return synced;
}
