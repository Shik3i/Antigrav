# routes/ - AI Context

**🎯 Purpose:** Entry point for all RESTful API interactions. Bridges the frontend with backend controllers to handle data persistence, authentication, and administrative tasks.

**🏛️ Architecture & Patterns:**
- **Express Router:** Endpoints are grouped logically in `api.js` (and domain-specific files like `speedcubeRoutes.js`).
- **Middleware Chain:** Standard flow is `Middleware (Auth/Validation) -> Controller`.
- **Authentication:** Layered security using `authController.authenticateToken` (strict) and `authController.optionalAuthenticateToken` (guest-friendly).
- **Validation:** Uses `express-validator` with a central `validate` middleware to catch and return 400 errors before reaching controllers.

**🚨 Strict Rules:**
- **Auth Mandatory:** All state-mutating (POST/PUT/DELETE) routes must use `authenticateToken`.
- **Superadmin Guard:** Admin-sensitive routes (Backups, Wordle Dictionary) must explicitly verify `req.user.is_superadmin`.
- **No Direct DB Calls:** Routes must delegate business logic to controllers; they should never call the `database/` layer directly.
- **Sanitization:** Use `xss` sanitizer on user-controlled inputs within the validation chain.

**⚠️ Known Pitfalls:**
- **Monolithic Route File:** `api.js` is growing rapidly and contains nearly all application endpoints.
- **Query Token Hack:** Backup download routes use a custom query parameter to map tokens to headers for browser-initiated downloads.
- **Inline Logic:** Avoid adding async logic directly in `api.js` (legacy backup routes currently violate this).

**🔗 Key Files:**
- [api.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/routes/api.js): The main routing registry.
- [speedcubeRoutes.js](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/routes/speedcubeRoutes.js): Example of domain-specific route extraction.
