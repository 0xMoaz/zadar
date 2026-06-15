```markdown
# zadar Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you how to contribute effectively to the **zadar** TypeScript codebase. You'll learn the project's coding conventions, how to implement new features or bug fixes with proper testing and documentation, and which commands to use for common workflows. The repository is structured with clear commit patterns, file naming, and testing practices to ensure code quality and maintainability.

## Coding Conventions

- **Language:** TypeScript
- **Framework:** None detected
- **File Naming:** Use PascalCase for files (e.g., `MyComponent.tsx`)
- **Import Style:** Use relative imports  
  _Example:_
  ```typescript
  import { MyComponent } from './components/MyComponent';
  ```
- **Export Style:** Use named exports  
  _Example:_
  ```typescript
  // In src/components/MyComponent.tsx
  export function MyComponent() { ... }
  ```
- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/)  
  - Prefixes: `feat`, `fix`, `chore`
  - Example:  
    ```
    feat: add user authentication to App
    fix: correct date parsing in EventList
    chore: update dependencies
    ```

## Workflows

### Feature Development with Tests and Docs
**Trigger:** When adding a significant new feature or capability  
**Command:** `/new-feature`

1. **Implement feature logic** in relevant `src/` files (e.g., components, main app logic).
   ```typescript
   // src/components/NewFeature.tsx
   export function NewFeature() {
     // feature implementation
   }
   ```
2. **Update or create corresponding test files** (e.g., `.test.ts` or `.test.tsx`).
   ```typescript
   // src/components/NewFeature.test.tsx
   import { NewFeature } from './NewFeature';

   test('renders NewFeature correctly', () => {
     // test implementation
   });
   ```
3. **Update documentation files** (`README.md`, `FEATURES.md`) to describe the new feature.
   - Add usage instructions and feature description.
4. **Update or add helper or utility files** as needed.

**Files Involved:**
- `src/App.tsx`
- `src/components/*.ts*`
- `src/*.test.ts*`
- `README.md`
- `FEATURES.md`

**Frequency:** ~2x/month

---

### Bugfix with Targeted Tests
**Trigger:** When fixing a bug or improving correctness in a specific module  
**Command:** `/bugfix`

1. **Identify and fix the bug** in the relevant source file(s).
   ```typescript
   // src/utils/date.ts
   export function parseDate(input: string): Date {
     // corrected logic
   }
   ```
2. **Update or add test cases** in the corresponding `.test.ts` or `.test.tsx` files to cover the fix.
   ```typescript
   // src/utils/date.test.ts
   import { parseDate } from './date';

   test('parses ISO date correctly', () => {
     // test implementation
   });
   ```
3. **Refactor or add helper functions** as needed.

**Files Involved:**
- `src/*.ts`
- `src/*.test.ts`

**Frequency:** ~2x/month

---

## Testing Patterns

- **Framework:** [Jest](https://jestjs.io/)
- **Test File Pattern:** Files end with `.test.ts` or `.test.tsx`
- **Test Example:**
  ```typescript
  // src/components/Widget.test.tsx
  import { Widget } from './Widget';

  test('Widget displays label', () => {
    // test implementation
  });
  ```
- **Location:** Tests are placed alongside the code in `src/` or in dedicated test files.

## Commands

| Command      | Purpose                                           |
|--------------|---------------------------------------------------|
| /new-feature | Start a new feature with tests and documentation  |
| /bugfix      | Fix a bug and update/add corresponding tests      |
```