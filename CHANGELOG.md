# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-10-24

### Added
- **SQLite Migration (Core Data Store)**
  - Replaced legacy CSV/JSON storage (`database/image_log.csv`, `database/statistics.csv`, `database/users.json`, `database/customization.json`) with a robust SQLite database (`database/app.sqlite3`).
  - New schema:
    - `users` (username, password_hash, role)
    - `settings` (key/value, JSON) – includes `customization`, encrypted API keys, and feature flags
    - `generations` (all image metadata, costs, and a `deleted` flag to preserve billing data)
  - Central PDO layer with WAL, foreign keys, and timeouts for reliability.
  - All endpoints rewritten to use SQLite (auth, customization, upload/list/delete images, private toggle, batch main image, statistics, user stats).
  - Costs are persisted per generation (OpenAI: 3/6/25 + 3 per ref; Gemini: 3 output + 15 per input) and statistics now include deleted images to preserve historical spend.
  - Optional migration script `php/migrate.php` to import existing CSV/JSON into SQLite idempotently. This file will be removed in future versions.
  - Setup flow now seeds admin, customization, and stores API keys encrypted (no .env needed for runtime).

- **Gemini Nano Banana Integration** - AI-powered image editing with Google Gemini 2.5 Flash Image:
  - New mode toggle in generation UI to switch between image generation (OpenAI) and image editing (Gemini)
  - Upload 1-2 reference images for AI-powered editing and transformation
  - Gemini API key management in customization settings (admin-only)
  - Automatic cost calculation: 15 cents per input image + 3 cents for output
  - Dynamic thumbnail generation supporting arbitrary aspect ratios from Gemini
  - Full integration with existing gallery, lightbox, and statistics
  - Mode toggle only appears when Gemini API key is configured
  - Seamless workflow: upload images, describe desired changes, get edited results
  - Complete i18n support with English and German translations
- Image streaming for 1-image generations. Users will see partial images during generation
- Reference image storage and display in lightbox:
  - Reference images used during generation are now automatically saved on the server
  - Reference images are stored per batch in `images/refs/<batchId>` directory
  - Lightbox displays reference image thumbnails for images that were generated with references
  - Reference images are only visible to the image owner (or administrators)
  - Thumbnails are hidden by default and can be toggled via clickable label with tooltip
  - Clicking on a reference thumbnail opens it in a new tab
  - Reference images are automatically deleted when the associated batch is removed

## [0.4.1] - 2025-06-20

### Added
- New "Surprise me" button:
  - Added compact button with gradient design next to reference image controls
  - Generates random, creative image prompts using AI
  - Supports localization for button tooltip and generated prompts
  - Visual feedback with loading spinner during generation
- New "cost per user" statistic

### Fixed
- Fixed reference image cost inconsistency between frontend and backend:
  - Updated frontend calculation from 4 cents to 3 cents per reference image
  - Now matches backend pricing used in statistics and user calculations
  - Ensures consistent cost display across the entire application

## [0.4.0] - 2025-05-28

### Added
- New admin-only private images toggle feature in gallery:
  - Added "P" button in gallery header for administrators only
  - Allows admins to toggle visibility of other users' private images
  - Own private images are always visible regardless of toggle state
  - Button is enabled by default and persists state in localStorage
  - Visual feedback with eye/crossed-eye icons and color changes
- User statistics info badge in header:
  - Shows total number of images created by the logged-in user
  - Displays total cost in local currency
  - Positioned next to username in desktop header
  - Auto-updates after new image generation
  - Supports localization with singular/plural forms
  - Hidden when user is not logged in or in view-only mode

### Changed
- Enhanced gallery grid size control:
  - Replaced binary size toggle with 5-step slider control
  - Added very compact, compact, medium, large, and very large grid layouts
  - Set large layout (4) as new default
  - Added persistent grid size storage in browser's localStorage
  - Added translations for all grid size labels
- Improved mobile UI by making variant selection buttons more compact on small screens:
  - Hid variant count text on mobile devices while keeping icons visible
  - Prevented buttons from overflowing on narrow screens
  - Maintained full button text on desktop/tablet views

### Fixed
- Fixed error that caused customization file to not be loaded properly when logged out
- Fixed missing metadata (including private/public toggle) in lightbox when first clicking on batch-generated images:
  - Ensured proper synchronization of gallery data after image generation
  - Metadata now correctly displays on first click for all batch images

## [0.3.2] - 2025-05-19

### Security
- Implemented minimum password length requirement (8 characters) for all password fields:
  - Initial setup
  - Password changes
  - User creation
  - Password resets
- Added client-side and server-side validation for password requirements
- Added translated error messages for password validation

## [0.3.1] - 2025-05-18

### Security
- Added secure PHP proxy for accessing customization data
- Implemented proper session authentication for customization file access
- Protected database folder contents from direct access

### Changed
- Updated JavaScript files to use new secure PHP endpoint for customization data:
  - Modified `js/script.js`
  - Modified `js/i18n.js`
  - Modified `js/customization.js`

### Added
- New `php/get_customization.php` endpoint for secure customization data access
- Session-based authentication check for customization data
- Support for view-only mode access to customization data 