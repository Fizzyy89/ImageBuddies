# 🎨 ImageBuddies - Self-Hosted OpenAI Image Generation UI

ImageBuddies is a user-friendly web interface that allows groups of friends or small teams to easily generate images using OpenAI's latest `gpt-image-1` image generation model. It's designed to be self-hosted on any webspace with PHP support, requiring no complex backend setup or databases.

The core idea is to provide a shared, self-managed platform for creative image generation, where an administrator can manage users and the OpenAI API key, and users can generate, view, and share images.

## ✨ Key Features

* **🚀 Easy to Host**: No database needed! Simply deploy on a web server with PHP.
* **🤖 OpenAI Integration**:
    * Generate images using OpenAI's image generation models (e.g., `gpt-image-1`).
    * Edit existing images using prompts.
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

## 🔧 Technical Overview

* **Frontend**: HTML, CSS (Tailwind CSS), Vanilla JavaScript (modular).
* **Backend**: PHP (for API proxy, user auth, file management, and basic CSV logging).
* **Storage**:
    * Images are stored on the server.
    * User data and customization settings are stored in JSON files in a `database` directory.
    * Image metadata and basic statistics are logged to CSV files in the `database` directory.
    * The OpenAI API key is stored in a `.env` file within the `database` directory.

## ⚠️ Security Notice

ImageBuddies is primarily designed for use in **controlled environments**, such as internal networks, personal servers, or among trusted groups. The default setup, with the `/database` directory located within the web root, prioritizes ease of installation.

If you choose to deploy ImageBuddies on a **publicly accessible web server**, please be aware of the following:

* **Sensitive Data:** The `/database` directory contains sensitive data, most notably the OpenAI API key (in the `.env` file).
* **Apache Web Server Protection:** An `.htaccess` file is included within the `/database` directory. This file is intended to block direct web access to the directory's contents **when using an Apache web server**. Ensure your Apache server is configured to allow `.htaccess` files (e.g., `AllowOverride All`).
* **Other Web Servers (Nginx, IIS, etc.):** The included `.htaccess` file **will not provide protection** on web servers other than Apache. If you are using Nginx, IIS, or another server type, you **must manually configure your server** to prevent direct web access to the `/database` directory. Consult your web server's documentation for instructions (e.g., search "deny access to folder nginx" or "request filtering iis").
* **Your Responsibility:** Ultimately, securing the `/database` directory and your server configuration is **your responsibility**, especially in a public-facing environment. Failure to do so can expose sensitive information.

Future versions may include more robust out-of-the-box security for public deployments.

## 🔧 Getting Started

1.  **Read** the Security Notice above.
2.  **Download**: Clone the repository or download the release zip-file.
3.  **Upload**: Upload the files to your webspace that supports PHP.
4.  **Setup**:
    * Navigate to the application in your web browser.
    * You will be guided through a one-time setup process to:
        * Create an admin user account.
        * Enter your OpenAI API key.
        * Configure basic site settings (like enabling/disabling view-only mode).
5.  **Login**: Log in with your newly created admin credentials.
6.  **Manage (Optional)**:
    * Use the "Users" section (admin-only) to add more users.
    * Use the "Customization" section (admin-only) to personalize the UI texts, features, and other settings.
7.  **Generate!**: Start generating images.

## 🔄 Performing an Update

1.  **Download**: Download the new release from this page
2.  **Replace**: Replace all files on your webspace
3.  **Careful**: Your data is stored inside the /database-Folder. Don't delete or overwrite.

## 📋 Requirements

* Web server with PHP support (tested with PHP 7.x and 8.x).
* `curl` extension for PHP (for OpenAI API communication).
* `gd` extension for PHP (for thumbnail generation).
* `zip` extension for PHP (for downloading image batches).
* Write permissions for the `database` and `images` directories.
* An OpenAI API key with access to the latest image generation models. You need to verify your organization within the OpenAI dashboard to get this access. This is easy and fast.

## ☕ Support

If you find ImageBuddies helpful and want to support its development, you can buy me a coffee:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://www.buymeacoffee.com/fizzyy89)

## 📄 License

MIT License