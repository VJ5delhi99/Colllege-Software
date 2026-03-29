import {
  createDemoDataset,
  demoUserAccounts,
  type DemoAnnouncement,
  type DemoCampus,
  type DemoCourse,
  type DemoDataset,
  type DemoStudent,
  type DemoTeacher,
  type DemoUserAccount
} from "./demo-data";
import { getDemoConfiguration } from "./demo-mode";

const DEMO_DATA_KEY = "university360.demo.dataset";
const DEMO_DATA_TIMESTAMP_KEY = "university360.demo.dataset.loadedAtUtc";

type DemoEntityMap = {
  students: DemoStudent;
  teachers: DemoTeacher;
  courses: DemoCourse;
  announcements: DemoAnnouncement;
  campuses: DemoCampus;
};

const inMemoryStore = new Map<string, string>();

function readStorage(key: string) {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(key);
  }

  return inMemoryStore.get(key) ?? null;
}

function writeStorage(key: string, value: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, value);
    return;
  }

  inMemoryStore.set(key, value);
}

function removeStorage(key: string) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
    return;
  }

  inMemoryStore.delete(key);
}

function shouldResetDataset(loadedAtUtc: string | null) {
  if (!loadedAtUtc) {
    return true;
  }

  const loadedAt = new Date(loadedAtUtc).getTime();
  if (Number.isNaN(loadedAt)) {
    return true;
  }

  return Date.now() - loadedAt > getDemoConfiguration().resetAfterMs;
}

export function resetDemoDataset(size: "small" | "medium" | "large" = "small") {
  const dataset = createDemoDataset(size);
  writeStorage(DEMO_DATA_KEY, JSON.stringify(dataset));
  writeStorage(DEMO_DATA_TIMESTAMP_KEY, dataset.generatedAtUtc);
  return dataset;
}

export function getDemoDataset() {
  const raw = readStorage(DEMO_DATA_KEY);
  const loadedAtUtc = readStorage(DEMO_DATA_TIMESTAMP_KEY);

  if (!raw || shouldResetDataset(loadedAtUtc)) {
    return resetDemoDataset();
  }

  try {
    return JSON.parse(raw) as DemoDataset;
  } catch {
    return resetDemoDataset();
  }
}

export function replaceDemoDataset(dataset: DemoDataset) {
  writeStorage(DEMO_DATA_KEY, JSON.stringify(dataset));
  writeStorage(DEMO_DATA_TIMESTAMP_KEY, new Date().toISOString());
  return dataset;
}

export function clearDemoDataset() {
  removeStorage(DEMO_DATA_KEY);
  removeStorage(DEMO_DATA_TIMESTAMP_KEY);
}

export function getDemoUsers(): DemoUserAccount[] {
  return getDemoDataset().demoUsers.length > 0 ? getDemoDataset().demoUsers : demoUserAccounts;
}

export function updateDemoCollection<K extends keyof DemoEntityMap>(
  key: K,
  updater: (items: DemoEntityMap[K][]) => DemoEntityMap[K][]
) {
  const dataset = getDemoDataset();
  const nextItems = updater([...dataset[key]] as DemoEntityMap[K][]);
  return replaceDemoDataset({
    ...dataset,
    [key]: nextItems
  });
}
