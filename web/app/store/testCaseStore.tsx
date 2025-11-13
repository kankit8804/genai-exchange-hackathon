import { create } from "zustand";
import { API_BASE } from "@/utils/api";


export interface TestCase {
  test_id: string;
  req_id: string;
  title: string;
  severity: string;
  expected_result: string;
  steps: string[];
  isPushed?: boolean;
  isRemoved?: boolean;
  project_id: string;
  createdAt?: string | number | Date;
}

interface TestStore {
  testCases: TestCase[];
  setTestCases: (updater: TestCase[] | ((prev: TestCase[]) => TestCase[])) => void;
}

export const useTestStore = create<TestStore>((set) => ({
  testCases: [],
  setTestCases: (updater) =>
    set((state) => ({
      testCases:
        typeof updater === "function" ? updater(state.testCases) : updater,
    })),
}));

export async function fetchTestCasesByProject(projectId: string): Promise<TestCase[]> {
  const res = await fetch(`${API_BASE}/testcases/project/${projectId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch test cases");
  }
  return res.json();
}
