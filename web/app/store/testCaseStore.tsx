import { create } from "zustand";

interface TestCase {
  test_id: string;
  req_id: string;
  title: string;
  severity: string;
  expected_result: string;
  steps: string[];
  isPushed?: boolean;
}

interface TestStore {
  testCases: TestCase[];
  setTestCases: (cases: TestCase[]) => void;
}

export const useTestStore = create<TestStore>()(
  (set: (fn: (state: TestStore) => Partial<TestStore>) => void) => ({
    testCases: [],
    setTestCases: (cases: TestCase[]) => set(() => ({ testCases: cases })),
  })
);
