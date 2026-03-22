# Development Guidelines

## 1. Local Testing is Mandatory
**ALWAYS** test changes locally before attempting to build or deploy to Unraid. 

- Start the local backend server (e.g., `node server.js`).
- Start the local frontend development server (e.g., `npm run dev`).
- Use the `browser_subagent` or ask the user to manually verify the UI/UX changes and new features in the browser.
- Only run `deploy_to_unraid.bat` AFTER local verification is successful.
