# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.3] - 2025-05-20 NOT YET RELEASED

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