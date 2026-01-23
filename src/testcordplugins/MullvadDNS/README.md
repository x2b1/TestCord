# MullvadDNS Plugin v1.3.0

A powerful Discord client mod plugin that forces Discord to use Mullvad VPN DNS servers for enhanced privacy and security. Features advanced logging, customizable settings, and comprehensive monitoring capabilities.

## 🌟 Key Features

### 🔒 Privacy & Security
- Routes all Discord traffic through Mullvad infrastructure
- Bypasses ISP DNS monitoring
- Prevents DNS leaks

### ⚙️ Advanced Configuration
- **Granular Logging Control**: Enable/disable with configurable verbosity levels
- **Customizable Notifications**: Toggle toast notifications for DNS resolutions
- **Flexible Startup**: Choose between auto-start or manual activation
- **Multiple Log Levels**: Verbose, Info, Warning, Error

### 📊 Comprehensive Monitoring
- Real-time statistics tracking
- Detailed cache performance metrics
- Request success/failure rates
- DNS resolution analytics

### 🛠️ Developer Tools
- Global API access for scripting
- Custom DNS record management
- Cache manipulation utilities
- Performance profiling capabilities

## 🔧 How It Works

The plugin operates by intercepting network requests to Discord domains and transparently redirecting them through verified Mullvad VPN IP addresses. This process happens at the JavaScript level, ensuring all Discord communications are routed through privacy-enhancing infrastructure.

### Technical Implementation
- **Fetch API Hooking**: Intercepts all outgoing HTTP requests
- **Smart Domain Detection**: Automatically identifies Discord-related domains
- **Efficient Caching**: Stores resolved DNS records to minimize overhead
- **Error Handling**: Gracefully falls back to original behavior on failures

### 🔐 Protected Domains
- `discord.com` → `162.159.137.233`
- `gateway.discord.gg` → `162.159.135.233`
- `media.discordapp.net` → `152.67.79.60`
- `cdn.discordapp.com` → `152.67.72.12`
- `status.discord.com` → `104.18.33.247`
- `ptb.discord.com` → `162.159.137.233`
- `canary.discord.com` → `162.159.137.233`
- `discordapp.net` → `152.67.79.60`

*Support for additional domains can be added via custom records*

## 📥 Installation

### Prerequisites
- Vencord, Illegalcord, or compatible Discord client mod
- Node.js environment (for building)
- Working internet connection

### Steps
1. Clone or download the plugin files
2. Place the entire `MullvadDNS` folder in your `userplugins` directory:
   ```
   DiscordModding/Illegalcord/src/userplugins/MullvadDNS/
   ```
3. Ensure all files are present:
   - `index.tsx` (main plugin)
   - `config.json` (default settings)
   - `standalone.js` (browser version)
   - `userscript.js` (userscript version)
   - `README.md` (this documentation)
4. Restart Discord client
5. Enable the plugin in your mod's settings panel

## 🎯 Usage Guide

### Automatic Operation
The plugin runs automatically in the background once enabled. Monitor its activity through:

#### 🖥️ Console Monitoring
- Press `F12` → Console tab
- Filter by `[MullvadDNS]` for plugin-specific logs
- Configure verbosity in plugin settings

#### 📈 Statistics Dashboard
Access real-time metrics through the global API:
```javascript
// Open browser console and run:
MullvadDNS.getStatistics()
// Returns: { totalRequests, successfulResolutions, failedResolutions, cacheHits }
```

#### 📱 Visual Feedback
- Toast notifications for major DNS resolutions
- Color-coded console messages
- Status indicators in plugin settings

## 🧪 Developer API

The plugin exposes a comprehensive global API for advanced usage and automation:

### Core Controls
```javascript
// Status checking
MullvadDNS.isActive()           // Boolean
MullvadDNS.start()              // Manual activation
MullvadDNS.stop()               // Manual deactivation
```

### DNS Management
```javascript
// View current DNS mappings
MullvadDNS.getDNSTable()        // Object of domain->IP mappings

// Custom record management
MullvadDNS.addCustomRecord('custom.domain.com', '1.2.3.4')
MullvadDNS.removeCustomRecord('custom.domain.com')
```

### Performance Monitoring
```javascript
// Statistics tracking
MullvadDNS.getStatistics()      // Detailed metrics
MullvadDNS.getCacheStats()      // Cache performance data
MullvadDNS.clearStatistics()    // Reset counters
MullvadDNS.clearCache()         // Clear DNS cache
```

### Integration Example
```javascript
// Monitor plugin performance
setInterval(() => {
  const stats = MullvadDNS.getStatistics();
  console.log(`Success rate: ${(stats.successfulResolutions/stats.totalRequests*100).toFixed(1)}%`);
}, 30000);
```

## ⚠️ Requirements & Compatibility

### System Requirements
- **Client Mods**: Vencord, Illegalcord, Equicord, or compatible forks
- **Environment**: Desktop Discord clients (not web version)
- **Runtime**: Node.js 16+ for building
- **Network**: Stable internet connection

### Browser Support
For web-based Discord:
- Use `userscript.js` with Tampermonkey/Greasemonkey
- Or use `standalone.js` for direct injection

### Limitations
- Does not encrypt traffic (use with actual VPN for full protection)
- May conflict with other network-intercepting extensions
- Requires JavaScript execution permissions

## 🔐 Privacy & Security Notice

### What This Plugin Does
✅ Routes Discord DNS queries through Mullvad infrastructure
✅ Prevents ISP-level DNS monitoring
✅ Blocks DNS-based tracking
✅ Provides transparent privacy enhancement

### What This Plugin Does NOT Do
❌ Encrypt your network traffic
❌ Hide your IP address from Discord
❌ Provide complete anonymity
❌ Replace a proper VPN service

### Recommended Usage
For maximum privacy protection, combine this plugin with:
- Actual Mullvad VPN subscription
- Tor Browser for web browsing
- DNS-over-HTTPS (DoH) system-wide
- Regular security audits

## 🛠️ Troubleshooting Guide

### Common Issues & Solutions

#### ❌ Plugin Not Loading
```
Solution: 
1. Verify all files are in correct directory
2. Check Discord console for import errors
3. Ensure Vencord/Illegalcord is properly installed
4. Try restarting Discord with admin privileges
```

#### ❌ DNS Resolution Failures
```
Solution:
1. Check internet connectivity
2. Verify Mullvad IPs are still active
3. Clear plugin cache: MullvadDNS.clearCache()
4. Temporarily disable other network plugins
```

#### ❌ Performance Issues
```
Solution:
1. Lower logging verbosity in settings
2. Disable unnecessary notifications
3. Clear cache regularly
4. Monitor statistics for unusual patterns
```

#### ❌ Conflicts with Other Mods
```
Solution:
1. Disable network-modifying plugins one by one
2. Check for duplicate DNS interception
3. Review console for conflicting extensions
4. Consider plugin load order
```

### Debug Commands
```javascript
// Force restart plugin
MullvadDNS.stop(); MullvadDNS.start();

// Reset everything
MullvadDNS.clearCache(); MullvadDNS.clearStatistics();

// Test specific domain
console.log(MullvadDNS.getDNSTable()['discord.com']);
```

## 👥 Credits & Acknowledgments

### Development Team
- **Lead Developer**: Irritably
- **Inspiration**: Based on Mullvad VPN's public DNS infrastructure

### Technical References
- Mullvad VPN public IP addresses
- Vencord plugin development framework
- Discord client network architecture
- Modern JavaScript interception techniques

### Community Resources
- Illegalcord GitHub repository
- Mullvad VPN documentation
- Privacy-focused development communities
