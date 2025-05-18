# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2024-03-21

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