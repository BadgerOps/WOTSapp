# Screenshot & GIF Generation

This directory contains scripts for automatically generating screenshots and GIFs of the WOTS app with mock data, for use in documentation and the main README.

## Prerequisites

1. **Node.js** - Required for running the scripts
2. **Playwright** - Installed automatically via npx
3. **ffmpeg** - Required for GIF conversion (optional)
   - macOS: `brew install ffmpeg`
   - Ubuntu: `sudo apt install ffmpeg`

## Quick Start

```bash
# Generate all screenshots
npm run screenshots

# Generate only desktop screenshots
npm run screenshots:desktop

# Generate only mobile screenshots
npm run screenshots:mobile

# Record videos for GIF conversion
npm run screenshots:video

# Convert recorded videos to GIFs (requires ffmpeg)
npm run gifs
```

## How It Works

### Demo Mode

The app has a built-in demo mode that can be activated by adding `?demo=user` or `?demo=admin` to any URL. This injects mock data instead of connecting to Firebase.

- `?demo=user` - Shows the app as a regular user would see it
- `?demo=admin` - Shows the app with admin permissions

**Security Note:** Demo mode is **only available in development** (`npm run dev`). In production builds, the `?demo` parameter is ignored entirely. This is enforced by checking `import.meta.env.DEV` in the DemoContext.

### Screenshot Capture

Playwright opens the app in demo mode and captures screenshots of various pages:

- **Desktop** (1280x800): Login, Home, Admin Dashboard tabs, Documents, Details, CQ
- **Mobile** (375x667): Login, Home, Admin

### Video Recording

For GIF creation, Playwright records videos of user flows:
- Admin creating a post
- Navigating through the app

### Output

Generated files are saved to `screenshots/output/`:
- `desktop-*.png` - Desktop screenshots
- `mobile-*.png` - Mobile screenshots
- `*.gif` - Animated GIFs from video recordings

## Mock Data

Mock data is defined in `src/contexts/DemoContext.jsx` and includes:

- **Posts**: Announcements, UOTD, Schedule, General updates
- **Personnel**: 8 sample candidates with various roles
- **CQ Shifts**: Active shift with notes
- **Cleaning Details**: Templates and assignments
- **Documents**: Training materials, forms
- **App Config**: Graduation countdown, class info

## Updating Screenshots

When the UI changes significantly, regenerate screenshots:

```bash
# Regenerate all screenshots
npm run screenshots

# Update specific categories
npm run screenshots:desktop
npm run screenshots:mobile
```

## File Structure

```
screenshots/
├── README.md              # This file
├── playwright.config.js   # Playwright configuration
├── capture.spec.js        # Screenshot capture tests
├── convert-to-gif.js      # Video to GIF converter
├── mockData.js            # External mock data (for reference)
├── .gitignore             # Ignores output directory
└── output/                # Generated screenshots (gitignored)
    ├── desktop-*.png
    ├── mobile-*.png
    └── *.gif
```

## Customization

### Adding New Screenshots

Edit `capture.spec.js` to add new screenshot captures:

```javascript
test('my new page', async ({ page }) => {
  await page.goto('/my-page?demo=user')
  await waitForApp(page)
  await screenshot(page, 'desktop-my-page')
})
```

### Modifying Mock Data

Edit `src/contexts/DemoContext.jsx` to change the mock data displayed in screenshots. The `MOCK_DATA` object contains all collections.

### GIF Settings

The `convert-to-gif.js` script uses these ffmpeg settings:
- **FPS**: 10 frames per second
- **Width**: 800px (height auto-scaled)
- **Max Duration**: 15 seconds
- **Dithering**: Bayer dithering for smooth gradients

## Troubleshooting

### Screenshots show login page
The demo mode may not be activating correctly. Check that:
1. The URL includes `?demo=user` or `?demo=admin`
2. The `DemoProvider` is wrapped around the app in `main.jsx`
3. The hooks are checking for demo data (e.g., `useDemoData`)

### ffmpeg not found
Install ffmpeg:
- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt install ffmpeg`

### Playwright installation issues
Run `npx playwright install` to ensure browsers are installed.
