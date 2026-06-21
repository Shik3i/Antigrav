# Development Guidelines

## 0. Git Branch Verification (MANDATORY)
Before starting any development or release workflow, **ALWAYS** run `git branch` and `git status` to verify your branch.
- Standard development and releases must target the **`main`** branch unless explicitly requested otherwise.
- Pull the latest changes (`git pull`) from the remote repository before making any modifications.

## 1. Local Testing is Mandatory
**ALWAYS** test changes locally before attempting to build or deploy to Unraid. 

- Start the local backend server (e.g., `node server.js`).
- Start the local frontend development server (e.g., `npm run dev`).
- Use the `browser_subagent` or ask the user to manually verify the UI/UX changes and new features in the browser.
- Only run `deploy_to_unraid.bat` (or use the GitHub Actions workflow) AFTER local verification is successful.
