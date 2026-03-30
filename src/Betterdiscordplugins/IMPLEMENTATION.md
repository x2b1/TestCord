# BetterDiscord Plugin Support for Testcord - Implementation Summary

## What Was Created

This implementation adds full BetterDiscord plugin support to Testcord, allowing you to use BetterDiscord `.plugin.js` files alongside native Testcord plugins.

## Files Created

### Core Files

1. **`src/Betterdiscordplugins/`** - Main plugin directory
   - `README.md` - Comprehensive documentation
   - `BdApi.ts` - BetterDiscord API compatibility layer
   - `PluginManager.ts` - Plugin loading and management
   - `loader.ts` - Build system integration
   - `bundledPlugins.ts` - Auto-generated plugin bundle
   - `SettingsPanel.tsx` - Settings UI component
   - `index.tsx` - Main plugin entry point
   - `TestPlugin.plugin.js` - Sample test plugin

### Build System Files

2. **`scripts/loadBDPlugins.mjs`** - Plugin bundling script

### Modified Files

3. **Build Configuration Updates:**
   - `scripts/build/common.mjs` - Added Betterdiscordplugins to pluginDirs
   - `scripts/build/build.mjs` - Added Betterdiscordplugins to native modules
   - `package.json` - Added `loadBDPlugins` script, integrated into build

## Features

### BdApi Compatibility Layer

The following BetterDiscord APIs are supported:

- **BdApi.Patcher** - Patch functions (before, after, instead)
- **BdApi.Data** - Save/load plugin data (localStorage based)
- **BdApi.DOM** - DOM manipulation utilities
- **BdApi.Logger** - Logging utilities
- **BdApi.Webpack** - Access Discord's webpack modules
- **BdApi.React** - React library access
- **BdApi.ReactDOM** - ReactDOM library access
- **BdApi.UI** - UI utilities (alert, confirm)
- **BdApi.Utils** - Utility functions
- **BdApi.ContextMenu** - Context menu utilities
- **BdApi.Flux** - Discord's Flux dispatcher
- **BdApi.Plugins** - Plugin management API
- **BdApi.Themes** - Theme management API

### Plugin Management

- Automatic plugin loading from the `Betterdiscordplugins` folder
- Enable/disable plugins via settings
- Plugin settings panel with toggle switches
- Console API for debugging: `window.TestcordBD`

## Usage

### Adding Plugins

1. Download BetterDiscord plugins (`.plugin.js` files)
2. Place them in `src/Betterdiscordplugins/`
3. Run `pnpm build` or `pnpm dev`
4. Enable plugins in Testcord settings

### Console Commands

```javascript
// View all plugins
TestcordBD.getAllPlugins()

// Toggle a plugin
TestcordBD.togglePlugin("PluginName")

// Start/Stop a plugin
TestcordBD.startPlugin("PluginName")
TestcordBD.stopPlugin("PluginName")

// Access manager
TestcordBD.manager
```

## How It Works

1. **Build Time**: The `loadBDPlugins.mjs` script scans the `Betterdiscordplugins` folder and bundles all `.plugin.js` files into `bundledPlugins.ts`

2. **Runtime**: The main plugin (`index.tsx`) loads all bundled plugins and registers them with the `BDPluginManager`

3. **API Translation**: When a BD plugin calls `BdApi` methods, the compatibility layer translates them to Testcord equivalents

4. **Settings**: Plugins can be enabled/disabled via the settings panel, with state persisted in localStorage

## Example Plugin

```javascript
/**
 * @name MyPlugin
 * @author Me
 * @version 1.0.0
 * @description My awesome plugin
 */

module.exports = {
    start() {
        BdApi.Logger.info("Plugin started!");
        BdApi.Data.save("setting", true);
    },
    stop() {
        BdApi.Logger.info("Plugin stopped!");
    },
    getSettingsPanel() {
        const div = document.createElement("div");
        div.innerHTML = "<h3>Settings</h3>";
        return div;
    }
};
```

## Limitations

- Not all BetterDiscord plugins may work (depends on API usage)
- Some BdApi methods are simplified implementations
- Plugins requiring native modules won't work
- Webpack module finding may differ from BetterDiscord

## Security

⚠️ **Only load plugins from trusted sources!** Plugins have access to your Discord account.

## Testing

A test plugin (`TestPlugin.plugin.js`) is included to verify the implementation works correctly.

## Next Steps

1. Test with real BetterDiscord plugins
2. Expand BdApi compatibility as needed
3. Add more settings options
4. Improve error handling and reporting
