# BetterDiscord Plugins for Testcord

This folder is for BetterDiscord (.plugin.js) plugins. Testcord now supports loading BetterDiscord plugins directly!

## How to Use

### Adding Plugins

1. **Download BetterDiscord plugins** (`.plugin.js` files) from sources like:
    - [BetterDiscord Plugins](https://betterdiscord.app/plugins)
    - [BD Store](https://bdstore.dev/plugins)
    - GitHub repositories

2. **Place them in this folder** (`Betterdiscordplugins`)

3. **Build Testcord** - Run `pnpm build` or `pnpm build --dev` for development

4. **Enable plugins** in Testcord settings under "BetterDiscord Plugins"

### Manual Plugin Loading

You can also load plugins dynamically via the console:

```javascript
// Load a plugin from code
TestcordBD.loadPlugin("MyPlugin.plugin.js", pluginCode);

// Toggle a plugin
TestcordBD.togglePlugin("PluginName");

// Get all plugins
TestcordBD.getAllPlugins();

// Access the manager
TestcordBD.manager;
```

## Supported Plugin Format

BetterDiscord plugins should have a meta block at the top of the file:

```javascript
/**
 * @name PluginName
 * @author AuthorName
 * @version 1.0.0
 * @description Plugin description here
 * @source https://github.com/author/plugin
 * @website https://example.com
 * @invite inviteCode
 */

module.exports = {
    start() {
        // Called when plugin starts
    },
    stop() {
        // Called when plugin stops
    },
    getSettingsPanel() {
        // Return a DOM element for settings
        return document.createElement("div");
    },
};
```

## BdApi Support

Testcord provides a compatibility layer for the BetterDiscord API:

### Available APIs

- **BdApi.Patcher** - Patch functions (before, after, instead)
- **BdApi.Data** - Save/load plugin data
- **BdApi.DOM** - DOM manipulation utilities
- **BdApi.Logger** - Logging utilities
- **BdApi.Webpack** - Access Discord's webpack modules
- **BdApi.React** - React library
- **BdApi.ReactDOM** - ReactDOM library
- **BdApi.UI** - UI utilities (alert, confirm)
- **BdApi.Utils** - Utility functions
- **BdApi.ContextMenu** - Context menu utilities
- **BdApi.Flux** - Discord's Flux dispatcher
- **BdApi.Components** - React components

### Example Usage

```javascript
// Access BdApi (automatically bound to your plugin)
const monochromeModule = BdApi.Webpack.getModule((m) => m?.monochrome);

// Patch a function
BdApi.Patcher.before(console, "log", (ctx) => {
    console.log("Console.log was called!", ctx.arguments);
});

// Save data
await BdApi.Data.save("setting", true);
const value = await BdApi.Data.load("setting");

// DOM manipulation
BdApi.DOM.appendStyle("my-plugin-style", `.my-class { color: red; }`);
```

## Limitations

Not all BetterDiscord plugins may work perfectly due to:

1. **API Differences** - Some BdApi methods may not be fully implemented
2. **Webpack Module Access** - Module finding may differ from BetterDiscord
3. **React Internals** - Discord updates may break plugin functionality
4. **Native Features** - Plugins requiring native modules won't work

## Troubleshooting

### Plugin Not Loading

1. Check the console for errors
2. Ensure the plugin has a valid meta block
3. Verify the plugin is enabled in settings
4. Try rebuilding Testcord: `pnpm build`

### Plugin Causing Issues

1. Disable the plugin in settings
2. Remove the `.plugin.js` file from the folder
3. Rebuild Testcord

### Debug Mode

Access debug utilities via the console:

```javascript
// View all loaded plugins
console.log(TestcordBD.getAllPlugins());

// Check plugin status
console.log(TestcordBD.getPlugin("PluginName"));

// Reload all plugins
TestcordBD.reloadAll();
```

## Development

To create a new BetterDiscord plugin for Testcord:

1. Create a `.plugin.js` file with the meta block
2. Implement `start()` and `stop()` methods
3. Use BdApi for Discord interactions
4. Test in Testcord's development mode

## Security Notice

⚠️ **Only load plugins from trusted sources!** Plugins have access to your Discord account and can potentially steal tokens or perform malicious actions.

## License

This BetterDiscord compatibility layer is part of Testcord and follows the same license (GPL-3.0-or-later).
