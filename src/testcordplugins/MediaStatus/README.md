# MediaStatus

Display your Jellyfin/Plex media activity as Discord Rich Presence. Show your friends what you're watching or listening to with detailed information and progress tracking.

## Features

- 🎬 Support for movies, TV shows & music
- 🔄 Progress and time tracking
- 🎵 Music information including artist and album
- ⚙️ Customizable display options
- 🖼️ Media thumbnails and server icons

## Setup Guide

### Jellyfin Setup
1. Get your server URL (e.g., `https://jellyfinisbetter.com`)
2. Get your API key:

![Configuration](https://img.redbaron2k7.dev/u/fVdxBk.png)

### Plex Setup
1. Get your server URL (e.g., `https://iloveplex.com`)
2. Find your X-Plex-Token:

   Open your browser's developer console (`F12` or `Ctrl + Shift + I` on Windows/Linux, `Cmd + Option + I` on Mac), go to the **Console** tab, and run:

   ```javascript
   console.log("X-Plex-Token:", localStorage.getItem("myPlexAccessToken") || "Not found");
   ```

   This will print your Plex token if it's stored in `localStorage`.

## Display Examples

Movies:

![Movies](https://img.redbaron2k7.dev/u/t5pehm.png)

TV Shows:

![TV Shows](https://img.redbaron2k7.dev/u/eBocx2.png)

Music:

![Music](https://img.redbaron2k7.dev/u/26OuEF.png)

## Troubleshooting


### No Activity Showing
- Verify your server URL includes http:// or https://
- Check if your API key/token is correct
- Ensure media is actively playing or check the "Hide When Paused" and "Hide When Other Activity" settings
- Check if server is accessible from your computer

### Wrong Information
- Try increasing the update interval
- Make sure you're using the latest plugin version
- Check if your media has correct metadata on your server
