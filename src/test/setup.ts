import "@testing-library/jest-dom";

// Mock framer-motion — avoids animation timing issues in tests
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: React.forwardRef(function MotionDiv(props: Record<string, unknown>, ref: unknown) {
        // Strip motion-specific props before passing to DOM
        const { initial, animate, exit, transition, variants, whileHover, ...domProps } = props;
        void initial; void animate; void exit; void transition; void variants; void whileHover;
        return React.createElement("div", { ...domProps, ref });
      }),
      span: React.forwardRef(function MotionSpan(props: Record<string, unknown>, ref: unknown) {
        const { initial, animate, exit, transition, variants, whileHover, ...domProps } = props;
        void initial; void animate; void exit; void transition; void variants; void whileHover;
        return React.createElement("span", { ...domProps, ref });
      }),
    },
    AnimatePresence: function AnimatePresence({ children }: { children: unknown }) {
      return children;
    },
    useCycle: () => [0, jest.fn()],
  };
});

// Mock Dexie
jest.mock("@/lib/dexie", () => ({
  db: {
    gamification: {
      get: jest.fn().mockResolvedValue(null),
      put: jest.fn().mockResolvedValue(undefined),
      where: jest.fn().mockReturnValue({
        equals: jest.fn().mockReturnValue({
          modify: jest.fn().mockResolvedValue(undefined),
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    },
    badges: {
      get: jest.fn().mockResolvedValue(null),
      put: jest.fn().mockResolvedValue(undefined),
      where: jest.fn().mockReturnValue({
        equals: jest.fn().mockReturnValue({
          filter: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([]),
          }),
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    xpEvents: {
      add: jest.fn().mockResolvedValue(1),
      where: jest.fn().mockReturnValue({
        equals: jest.fn().mockReturnValue({
          filter: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    activityLog: {
      add: jest.fn().mockResolvedValue(1),
      where: jest.fn().mockReturnValue({
        equals: jest.fn().mockReturnValue({
          filter: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([]),
          }),
          toArray: jest.fn().mockResolvedValue([]),
        }),
      }),
    },
    commitments: {
      get: jest.fn().mockResolvedValue(null),
      put: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    courses: {
      filter: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      }),
    },
    assignments: {
      filter: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      }),
    },
  },
}));

// Mock dexie-react-hooks
jest.mock("dexie-react-hooks", () => ({
  useLiveQuery: jest.fn((fn: () => unknown) => {
    try { return fn(); } catch { return undefined; }
  }),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => "/today",
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
}));

// Suppress console.error warning noise
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Warning:")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
