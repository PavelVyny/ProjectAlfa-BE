# Testing Guide for ProjectAlfa

This document outlines the testing strategy, commands, and CI/CD integration for the ProjectAlfa backend.

## 1. Running Tests Locally

We use [Jest](https://jestjs.io/) for testing.

### Unit & Integration Tests
Run all tests:
```bash
npm run test
```

Run tests in watch mode (development):
```bash
npm run test:watch
```

Run e2e tests (requires database connection):
```bash
npm run test:e2e
```

### Checking Test Coverage
To see how much of the code is covered by tests:
```bash
npm run test:cov
```
This will generate a `coverage` directory and print a summary table in the terminal.
- **% Stmts**: Percentage of statements executed.
- **% Branch**: Percentage of control flow branches (if/else) executed.
- **% Funcs**: Percentage of functions called.
- **% Lines**: Percentage of lines of code executed.

Target coverage should be >80% for critical logic (Auth, Payments).

## 2. CI/CD Integration (GitHub Actions)

To automatically run tests on every push/pull request, create a file at `.github/workflows/test.yml`:

```yaml
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install Dependencies
      run: npm ci

    - name: Run Unit Tests
      run: npm run test

    - name: Run Coverage
      run: npm run test:cov
```

## 3. GitHub Coverage Badges

To display a test coverage badge on your README:

### Data Sources
There are two common ways to get badges:
1.  **Codecov/Coveralls**: Integrated services (requires setup).
2.  **GitHub Gist (Free/Simple)**: Use an action to update a Gist with coverage % and generate a badge.

### Recommended: Dynamic Badge via Gist
Update your `.github/workflows/test.yml` to use `coverage-badge-action`:

```yaml
    - name: Generate Coverage Badge
      uses: schneegans/dynamic-badges-action@v1.7.0
      if: github.ref == 'refs/heads/main'
      with:
        auth: ${{ secrets.GIST_SECRET }}
        gistID: <YOUR_GIST_ID>
        filename: coverage.json
        label: coverage
        message: ${{ env.COVERAGE }}%
        color: green
```
*(Note: requires extracting coverage percentage from stdout first, usually via a script)*.

**Simpler Alternative**: Use [Codecov](https://about.codecov.io/).
1. Log in to Codecov with GitHub.
2. Add repo.
    - Add `GIST_ID`: The ID you copied.
    - Add `GIST_SECRET`: A GitHub Personal Access Token (Classic) with `gist` scope.

    ### How to get the GIST_SECRET (Personal Access Token):
    1. Click on your profile photo (top right) -> **Settings**.
    2. Scroll down to the bottom of the left sidebar -> **Developer settings**.
    3. Click **Personal access tokens** -> **Tokens (classic)**.
    4. Click **Generate new token** -> **Generate new token (classic)**.
    5. **Note**: "Coverage Badge" (or similar).
    6. **Expiration**: Choose "No expiration" (or set a rotation schedule).
    7. **Select scopes**: Check the box for **gist** (Create gists).
    8. Scroll down and click **Generate token**.
    9. **Copy the token immediately**. Use this as your `GIST_SECRET`.

3.  **Update README**:
- **Unit Tests**: Create `*.spec.ts` next to the file being tested (e.g., `auth.service.spec.ts` next to `auth.service.ts`).
- **Mocking**: Use `jest.fn()` or `jest-mock-extended` to mock external dependencies (DB, APIs).
- **Structure**:
    ```typescript
    describe('MyService', () => {
      beforeEach(() => { ...init... });
      it('should do something', () => { ...expect... });
    });
    ```
