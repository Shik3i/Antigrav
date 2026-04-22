# src/pages/ - AI Context

**🎯 Purpose:** Primary view layer of the React SPA. Each component here acts as a route-level container for a specific feature or administrative dashboard.

**🏛️ Architecture & Patterns:**
- **Route Orchestration:** `App.jsx` handles all top-level routing and socket lifecycle management.
- **Lazy Loading:** All pages are dynamically imported via `React.lazy` to optimize initial load times.
- **Context Integration:** Pages consume `AuthContext` (security), `ToastContext` (feedback), and `PersistentDataContext` (shared real-time data).
- **Socket Passing:** The global `socket` instance is passed down as a prop to most pages for feature-specific event listening.
- **Layout Consistency:** Most pages use the `glass-card` CSS class and adhere to the "Premium Glassmorphic" design system.

**🚨 Strict Rules:**
- **Component Wrapping:** New routes must be wrapped in `RouteErrorBoundary` and `MaintenanceGuard` within `App.jsx`.
- **No Direct Fetch:** Use the `apiClient.js` wrapper or `axios` for HTTP requests; always handle loading/error states.
- **Vanilla CSS Only:** Styling must be done via `index.css` or component-specific CSS files. Utility libraries are banned.
- **Reactivity:** Pages must listen for relevant socket events (e.g., `COIN_BALANCE_UPDATE`) to ensure UI stays in sync without refreshes.

**⚠️ Known Pitfalls:**
- **Giant Components:** Pages like `Admin.jsx` (1,800+ lines) and `Blackjack.jsx` (2,400+ lines) are excessively large and mix UI with complex logic.
- **State Fragmentation:** Beware of mixing local page state with socket-synchronized state.
- **Prop Drilling:** The `socket` prop is drilled deep into sub-components; consider using a specialized socket context for new features.

**🔗 Key Files:**
- [App.jsx](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/shared-timer-app/src/App.jsx): Root routing and global socket lifecycle.
- [Admin.jsx](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/src/pages/Admin.jsx): Monolithic administration dashboard.
- [Room.jsx](file:///c:/Users/s3ish/Documents/Workspace/AntiGravity/Antigrav/src/pages/Room.jsx): Real-time shared timer interface.
