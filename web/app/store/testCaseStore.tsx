import { create } from "zustand";

const API_BASE = "http://127.0.0.1:8000";

export interface TestCase {
  test_id: string;
  req_id: string;
  title: string;
  severity: string;
  expected_result: string;
  steps: string[];
  isPushed?: boolean;
  project_id: string;
}

interface TestStore {
  testCases: TestCase[];
  setTestCases: (cases: TestCase[]) => void;
}

export const useTestStore = create<TestStore>((set) => ({
  testCases: [],
  setTestCases: (cases) => set({ testCases: cases }),
}));

export async function fetchTestCasesByProject(projectId: string): Promise<TestCase[]> {
  const res = await fetch(`${API_BASE}/testcases/project/${projectId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch test cases");
  }
  return res.json();
}
