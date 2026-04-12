import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Mock CSS and static assets
    "\\.(css|less|scss|sass)$": "<rootDir>/src/test/__mocks__/styleMock.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
        },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  // Ignore Next.js server files
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  // Transform ESM packages
  transformIgnorePatterns: ["/node_modules/(?!(dexie|dexie-react-hooks)/)"],
};

export default config;
