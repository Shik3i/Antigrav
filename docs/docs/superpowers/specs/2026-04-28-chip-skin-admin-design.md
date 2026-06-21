# Chip Skin Admin Design

## Goal

Add an admin-managed chip skin system so new casino chip skins can be created without code changes, and access to skins can be controlled per user. The first version should solve manual creation and manual grants, while keeping the model ready for future unlock rules such as shop purchases, achievements, levels, and events.

## Current Context

Chip skins are currently bundled in `src/features/casino/chipConfig.js` through static imports. The existing skins are `classic`, `neon`, and `tropical`, each with eight PNG assets for the supported chip values. User selection is stored in local storage through `ChipSkinContext`, and Blackjack/Roulette consume the selected skin when rendering chips or syncing table state.

This makes adding a skin a code change: files must be added to the source tree, imports must be edited, and the settings UI must know about the new option. The admin feature should move custom skins to backend-managed metadata and uploaded files.

## Design

### Storage Model

Skin images should be stored as files on the server, not as database blobs. SQLite stores metadata, asset paths, and grants.

Uploaded files are stored under:

```txt
data/chip-skins/<skin-slug>/<value>.png
```

The database stores these concepts:

- `chip_skins`: one row per skin.
- `chip_skin_assets`: one row per uploaded chip value image.
- `chip_skin_grants`: manual user access to restricted skins.
- Future: `chip_skin_unlock_rules` for automatic access rules.

`chip_skins` fields:

- `id`
- `name`
- `slug`
- `description`
- `status`: `draft`, `public`, `restricted`, `disabled`
- `rarity`: `common`, `rare`, `epic`, `legendary`, `limited`, `exclusive`
- `release_date`
- `created_at`
- `updated_at`

`release_date` is enforceable, not decorative. A skin remains visible to admins before release, but normal users cannot see or select it until `release_date <= now`.

### Skin Completeness

A publishable skin must have exactly one valid PNG for each supported value:

```txt
1, 5, 10, 25, 50, 100, 500, 1000
```

The backend validates required values before a skin can become `public` or `restricted`. Draft skins may be incomplete so admins can build them incrementally.

### Visibility Rules

Normal users may see and use a skin only when all of these are true:

- The skin is complete.
- `release_date <= now`.
- The status permits the user:
  - `public`: every logged-in user.
  - `restricted`: users with a matching manual grant.
  - `draft`: admins only.
  - `disabled`: nobody outside admin management.

The backend performs this filtering for user-facing endpoints. The frontend should not receive unreleased or unauthorized skins through normal user APIs.

### Admin UI

Add a new admin tab named `Chip-Skins`.

The first version should include:

- Skin list with preview, status, rarity badge, release date, completeness, and access type.
- Create/edit form for name, slug, description, status, rarity, and release date.
- Asset upload section for the eight required chip values.
- Preview before publishing.
- Validation feedback for missing or invalid assets.
- Restricted access manager:
  - Search users.
  - Grant a skin to a user.
  - Revoke a skin from a user.
  - Show existing grants.

The UI should prevent publishing an incomplete skin and should make unreleased skins easy to identify.

### Public/User UI

Settings should load the user's available skins from the backend instead of relying only on hard-coded client config.

If the stored skin is no longer available because it is disabled, unreleased, or access was revoked, the client should fall back to `default` and persist that fallback.

Existing static skins can stay as built-ins during the transition, but they should be exposed through the same user-facing shape as backend skins so Settings and casino components can render one unified list.

### API Shape

Admin endpoints:

- `GET /api/admin/chip-skins`
- `POST /api/admin/chip-skins`
- `PUT /api/admin/chip-skins/:id`
- `POST /api/admin/chip-skins/:id/assets`
- `GET /api/admin/chip-skins/:id/grants`
- `POST /api/admin/chip-skins/:id/grants`
- `DELETE /api/admin/chip-skins/:id/grants/:userId`

User endpoints:

- `GET /api/chip-skins`
- `GET /api/chip-skins/me`

Asset delivery should go through an explicit backend route, for example:

```txt
/api/chip-skins/assets/:skinSlug/:fileName
```

This keeps uploaded files outside the source tree and avoids exposing arbitrary filesystem paths.

### Future Unlock Rules

The first implementation should not build automatic unlock rules, but the schema and API design should leave room for them.

Future rule types:

- Level reached.
- Achievement earned.
- Shop purchase.
- Event window.
- Superadmin-only or staff-only access.
- Limited availability with an optional `available_until`.

Manual grants remain useful even after rules are added because admins may need overrides, event prizes, or support corrections.

## Error Handling

The backend should return clear validation errors for:

- Duplicate slug.
- Invalid status or rarity.
- Invalid release date.
- Missing required assets when publishing.
- Upload with an unsupported chip value.
- Upload with a non-PNG file.
- Granting access to a missing user or missing skin.

The admin UI should surface these errors inline and keep unsaved form state when a request fails.

## Testing

Backend tests should cover:

- Skin visibility filtering by status, release date, completeness, and manual grants.
- Validation for publishability.
- Grant and revoke behavior.
- Fallback behavior when a selected skin is no longer available.

Frontend tests should cover:

- Admin list renders status, rarity, release date, completeness, and previews.
- Settings renders only available skins returned by the user API.
- Settings falls back to `default` when the selected skin is unavailable.

## Scope Decisions

The first implementation will use server-file storage plus SQLite metadata. Automatic unlock rules are intentionally deferred, but the design preserves a clean path for adding them later.
