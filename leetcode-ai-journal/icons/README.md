# Icons Folder

This folder should contain the icon files required by the Chrome extension manifest.

## Required Icon Sizes

The extension manifest specifies three icon sizes that must be present:

### icon16.png
- **Size:** 16x16 pixels
- **Usage:** Extension icon in Chrome toolbar and various UI elements
- **Format:** PNG with transparency

### icon48.png
- **Size:** 48x48 pixels
- **Usage:** Extension management page and browser settings
- **Format:** PNG with transparency

### icon128.png
- **Size:** 128x128 pixels
- **Usage:** Chrome Web Store listing and installation dialog
- **Format:** PNG with transparency

## Icon Design Guidelines

- **Theme:** Dark/tech-focused to match the extension's purpose
- **Colors:** Use the extension's accent color (#7c6af7) as primary
- **Style:** Simple, recognizable icon representing coding/problem-solving
- **Suggestions:**
  - Code brackets or algorithm symbols
  - Lightbulb or brain icon for "AI"
  - Circuit/network pattern
  - Mathematical symbols (∑, ∫, etc.)

## How to Generate Icons

1. **Design the base icon** at 128x128 pixels
2. **Scale down** to create 48x48 and 16x16 versions
3. **Export as PNG** with transparent background
4. **Test in Chrome** by loading the unpacked extension

## Tools for Icon Creation

- **Figma/Adobe XD:** Design vector icons and export at multiple sizes
- **Inkscape:** Free vector graphics editor
- **Online generators:** Simpleicons, Iconfinder, or Flaticon
- **AI tools:** Midjourney, DALL-E for initial concepts

## File Naming

Place the icon files directly in this folder with exact names:
- `icon16.png`
- `icon48.png`
- `icon128.png`

The manifest.json references these files, so naming must match exactly.