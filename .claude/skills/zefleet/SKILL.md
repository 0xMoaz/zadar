```markdown
# zefleet Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill introduces the core development patterns, coding conventions, and workflows used in the `zefleet` codebase—a TypeScript React project. You'll learn how to structure code, write and organize tests, enhance UI components, and follow standardized commit and workflow processes to ensure consistency and maintainability.

## Coding Conventions

- **File Naming:**  
  Use camelCase for file names.  
  _Example:_  
  ```
  transcriptStatus.ts
  collectSignal.ts
  mockData.ts
  ```

- **Import Style:**  
  Use relative imports for modules within the project.  
  _Example:_  
  ```typescript
  import { getStatus } from './transcriptStatus';
  import { mockData } from '../mockData';
  ```

- **Export Style:**  
  Prefer named exports.  
  _Example:_  
  ```typescript
  // src/collectSignal.ts
  export function collectSignal() { ... }
  ```

- **Commit Messages:**  
  Follow [Conventional Commits](https://www.conventionalcommits.org/) with prefixes such as `feat`, `fix`, or `plan`.  
  _Example:_  
  ```
  feat: add transcript status aggregation logic
  fix: correct signal collection edge case
  plan: outline UI enhancement roadmap
  ```

## Workflows

### Feature Development with Unit Tests
**Trigger:** When adding a new feature or overhauling core logic  
**Command:** `/new-feature-with-tests`

1. Implement or overhaul logic in one or more source files (e.g., `src/transcript/status.ts`, `src/signal.ts`, `src/collect.ts`).
2. Update or create corresponding unit test files (e.g., `src/transcript/status.test.ts`, `src/signal.test.ts`).
3. Update types as needed in `src/types.ts`.
4. Update related UI components if applicable.

_Example:_
```typescript
// src/signal.ts
export function processSignal(input: SignalInput): SignalResult { ... }

// src/signal.test.ts
import { processSignal } from './signal';
test('processSignal returns expected result', () => {
  // test logic
});
```

### UI Component Enhancement with Mock and Smoke
**Trigger:** When adding or improving UI components and ensuring coverage by mock data and smoke tests  
**Command:** `/enhance-ui`

1. Modify or add UI component files (e.g., `src/components/MyComponent.tsx`).
2. Update mock data to reflect new UI states in `src/mock.ts`.
3. Update or add smoke test files in `src/smoke.tsx`.
4. Optionally update format or helper files (`src/format.ts`, `src/format.test.ts`).

_Example:_
```tsx
// src/components/MyComponent.tsx
export function MyComponent(props: Props) { ... }

// src/mock.ts
export const mockMyComponent = { ... };

// src/smoke.tsx
import { MyComponent } from './components/MyComponent';
test('MyComponent renders without crashing', () => {
  // smoke test logic
});
```

### Test Suite Expansion and Docs Update
**Trigger:** When increasing test coverage and updating documentation  
**Command:** `/expand-tests-update-docs`

1. Add or update test files (e.g., `src/app.test.tsx`, `src/*.test.ts`).
2. Remove or replace obsolete test scripts.
3. Update documentation files (`README.md`, `DESIGN.md`).
4. Optionally update todo or planning files (`tasks/todo.md`).

_Example:_
```typescript
// src/app.test.tsx
test('App renders dashboard', () => {
  // test logic
});
```
```markdown
<!-- README.md -->
## New Feature: Signal Processing
This release adds advanced signal processing capabilities...
```

## Testing Patterns

- **Framework:**  
  [Jest](https://jestjs.io/) is used for unit and smoke tests.

- **Test File Naming:**  
  Test files follow the pattern `*.test.ts` or `*.test.tsx` and are placed alongside or near the files they test.

- **Example Test File:**
  ```typescript
  // src/collect.test.ts
  import { collectSignal } from './collectSignal';

  test('collectSignal aggregates correctly', () => {
    expect(collectSignal([1, 2, 3])).toEqual(6);
  });
  ```

## Commands

| Command                       | Purpose                                                      |
|-------------------------------|--------------------------------------------------------------|
| /new-feature-with-tests        | Start a feature or logic overhaul with corresponding tests    |
| /enhance-ui                   | Enhance or add UI components with updated mocks and smoke tests|
| /expand-tests-update-docs     | Expand test suite and update documentation                   |
```
