# ImageBuddies - Self-Hosted OpenAI Image Generation UI

ImageBuddies is a user-friendly web interface that allows groups of friends or small teams to easily generate images using OpenAI's latest `gpt-image-1` image generation model. It's designed to be self-hosted on any webspace with PHP support and uses a self-contained SQLite database that is created automatically on first run (no external DB required).

![generate](https://github.com/user-attachments/assets/6f77748c-f461-4e94-8f2c-a0aa513ac18d)

The core idea is to provide a shared, self-managed platform for creative image generation, where an administrator can manage users and the OpenAI API key, and users can generate, view, and share images.

## ✨ Key Features

* **🚀 Easy to Host**:
    * No external database needed – uses SQLite automatically. Simply deploy on any web server with PHP.

* **🤖 OpenAI & Gemini Integration**:
    * Generate images using OpenAI's image generation models (e.g., `gpt-image-1`).
    * Optional image editing mode powered by Google Gemini 2.5 Flash Image (Nano Banana).
    * Toggle between image generation (OpenAI) and image editing (Gemini) directly in the UI.
    * Automatic prompt optimization feature using GPT.
 
* **👥 User Management**:
    * Admin interface for managing users (add, edit roles, change passwords, delete).
    * User roles (admin, user).
    * Secure login system.
 
* **🖼️ Image Generation & Customization**:
    * Intuitive interface for entering prompts.
    * Support for reference images (upload, paste, drag & drop - up to 8).
    * Select aspect ratios (1:1, 2:3, 3:2).
    * Choose image quality (low, medium, high - with associated cost display).
    * Generate multiple image variations (1-4 images per request).
    * Dynamic cost estimation before generation.
 
* **📸 Gallery & Image Viewing**:
    * Gallery of all generated images (with thumbnails).
    * Filter gallery to show "all images" or "my images".
    * Compact and normal grid view options.
    * Lightbox for detailed image viewing with metadata (prompt, user, date, quality, aspect ratio, reference image count).
    * Mark images as "private" (only visible to the owner and admins).
    * Download individual images or entire batches as a ZIP.
    * Easily copy image URLs or reuse prompts and settings.
    * Set any image in a batch as the new "main" thumbnail for the gallery.

![lightbox](https://github.com/user-attachments/assets/38310bd5-6f84-4599-9463-2e7f8031bfd2)

* **⚙️ Customization & Admin Controls**:
    * **Site Customization**: Admins can customize site name, headlines, features list, footer, and login contact information.
    * **API Key Management**: Securely manage the OpenAI API key via the admin interface.
    * **View-Only Mode**: Option to allow a "view-only" mode for users without login, if enabled by the admin.
    * **Header Visibility**: Admin can choose to hide the main hero/header section.
   
* **📊 Usage Statistics (Admin-only)**:
    * Track total images generated, total costs, average cost per image.
    * View distributions by quality, aspect ratio, and user.
    * See costs per month and images/costs per day.
    * Analyze reference image usage and associated costs.
    * View statistics on batch generation sizes.
      
* **💫 Modern UI**:
    * Clean, responsive design built with Tailwind CSS.
    * Dark/Light mode support.
    * Mobile-friendly interface with a dedicated mobile menu
    * 🌐 Multi-language support (currently: English, German)

## 👥 Who is it for?

* **Friend Groups**: Share an API key and generate images together without everyone needing an OpenAI account or technical setup.
* **Small Teams**: Collaborate on visual projects, brainstorm ideas, or create assets.
* **Individuals**: A personal, self-hosted alternative to other image generation UIs.

![gallery](https://github.com/user-attachments/assets/32691f10-2f1a-4a21-b238-c400199b3703)

## 🔧 Technical Overview

* **Frontend**: HTML, CSS (Tailwind CSS), Vanilla JavaScript (modular).
* **Backend**: PHP with PDO/SQLite (API proxy, user auth, file management, database access).
* **Layout**:
    * `www/` (Document Root): public assets and `www/api/*` endpoints
    * `src/`: non-public application code (bootstrap, DB helpers, crypto)
    * `data/`: created at first setup (non-public), stores `app.sqlite3` and `.secret.key`
    * `www/images/`: image files and thumbnails (public)
* **Storage**:
    * SQLite at `data/app.sqlite3` with tables:
        * `users` (accounts and roles)
        * `settings` (customization JSON, encrypted API keys, feature flags like `gemini_available`)
        * `generations` (all image metadata, costs, batch info, and a `deleted` flag)
    * API keys (OpenAI, Gemini) are encrypted at rest and managed via the admin UI.

## ⚠️ Security Notice

ImageBuddies is primarily designed for **controlled environments** (internal networks, personal servers, trusted groups). Since v1.1.0 the default layout keeps sensitive data **outside the webroot**:

* `data/` is non-public and created during setup (contains the SQLite DB `app.sqlite3` and the encryption key `.secret.key`).
* `src/` is non-public and contains application code.
* `www/` is the only public folder (static files and `www/api/*`).

Make sure your web server’s DocumentRoot points to `www/`. If your hosting forces a different public webroot, deploy only the contents of `www/` there and keep `data/` next to it (not under it). For Apache/Nginx/IIS, ensure requests cannot reach `data/` and `src/` — when following the recommended layout they are already outside the webroot.

## 🔧 Getting Started

1.  **Read** the Security Notice above.
2.  **Download**: Clone the repository or download the release zip-file.
3.  **Upload**: Upload the files to your webspace that supports PHP.
4.  **Setup**:
    * Navigate to the application in your web browser.
    * You will be guided through a one-time setup process to:
        * Create an admin user account.
        * Enter your API keys (OpenAI, optionally Gemini). Keys are encrypted and stored in the database and can be changed later in the admin UI.
        * Configure basic site settings (like enabling/disabling view-only mode).
5.  **Login**: Log in with your newly created admin credentials.
6.  **Manage (Optional)**:
    * Use the "Users" section (admin-only) to add more users.
    * Use the "Customization" section (admin-only) to personalize the UI texts, features, and other settings.
7.  **Generate!**: Start generating images.

## 🔄 Performing an Update

1.  **Download**: Download the new release from this page
2.  **Replace**: Replace all files on your webspace
3.  **Careful**: Your data lives in `data/` (DB and key) and in `www/images/`. Do not delete or overwrite these folders.

## 📋 Requirements

* Web server with PHP support (tested with PHP 7.x and 8.x).
* `curl` extension for PHP (for OpenAI API communication).
* `gd` extension for PHP (for thumbnail generation).
* `zip` extension for PHP (for downloading image batches).
* `pdo_sqlite` extension for PHP (for SQLite database access).
* One of: `sodium` (libsodium) or `openssl` extensions for PHP (for encrypting API keys at rest).
* Write permissions for the `data` and `www/images` directories.
* An OpenAI API key with access to the latest image generation models. You need to verify your organization within the OpenAI dashboard to get this access. This is easy and fast.

## ☕ Support

If you find ImageBuddies helpful and want to support its development, you can buy me a coffee:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://www.buymeacoffee.com/fizzyy89)

## 📄 License

MIT License