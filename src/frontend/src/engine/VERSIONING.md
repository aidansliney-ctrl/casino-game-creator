# Game Type Versioning

## Overview

Scene files (e.g. `ThreeReelSlotScene.js`) are **base templates** used by the game creator. They are versioned so that:

- Users' saved games always have a matching base template available
- The AI assistant builds modifications on top of a specific version
- Updating a scene doesn't break existing saves

## How It Works

1. **Base templates are immutable once released.** Users save games that reference a specific template version. If you change the template, their saves may not work correctly with the new version.

2. **Template versions are registered** in `templates/index.js`. Each entry has a version number, label, source (raw import), and changelog.

3. **The AI assistant** receives the template source at runtime and returns modified code. The modified code is eval'd in the browser — it never touches the source files.

4. **Saves store** the modified source + the template version it was built on. Loading a save uses the stored source directly.

## How to Update a Scene File

### Step 1: Copy the current version

Before editing, copy the current file to a versioned backup:

```
cp ThreeReelSlotScene.js ThreeReelSlotScene.v1.0.js
```

### Step 2: Make your changes

Edit the original file (`ThreeReelSlotScene.js`) with your updates.

### Step 3: Register the new version

In `templates/index.js`:

```js
import threeReelV1 from '../ThreeReelSlotScene.v1.0.js?raw';
import threeReelV1_1 from '../ThreeReelSlotScene.js?raw';

export const templates = {
    'slots-3reel': [
        {
            version: '1.0',
            label: 'v1.0 — Egyptian Treasures',
            source: threeReelV1,
            changes: ['Initial release', ...]
        },
        {
            version: '1.1',
            label: 'v1.1 — Egyptian Treasures',
            source: threeReelV1_1,
            changes: ['Improved reel animations', 'Bug fix: wild symbol payout']
        }
    ],
};
```

### Step 4: Verify

- New users see the latest version by default
- Old saves still load correctly (they use their stored source)
- The "Version" tab in the sidebar shows both versions with changelogs
- Users with old saves see an "Upgrade Base" option (future feature)

## Rules

- **Never delete a versioned backup file** — old saves depend on it
- **Always add a changelog** to new version entries
- **The `getLatestTemplate()` function** returns the last entry in the array, so append new versions at the end
- **Scene classes must implement**: `constructor(config)`, `enter(game)`, `exit()`, `update(dt)`, `render(ctx)`
- **Optional methods**: `setAudioManager(am)`, `getUsedAssets()`
