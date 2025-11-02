# TODO: Change xcinstaller from Equicord to TestCord

## Files to Edit
- constants.go: Update URLs, UserAgent
- gui.go: Update title, labels, messages
- patcher.go: Update BaseDir, EquicordDirectory
- app_asar.go: Update variable names if any
- install.sh: Update download URL, remove Chrome extension message
- README.md: Update all references
- Other files if needed (e.g., cli.go, github_downloader.go)

## Changes
- Replace "Equicord" with "TestCord"
- Replace "equicord" with "testcord"
- Update GitHub repos: Equicord/Equicord -> x2b1/testcord, Equicord/Equilotl -> x2b1/xcinstaller
- Update installer name: Equilotl -> TestCordInstaller
- Update BaseDir: Equicord -> TestCord
- Update EquicordDirectory: equicord.asar -> testcord.asar
- Remove Chrome extension URL since no extension

## Steps
1. Edit constants.go
2. Edit gui.go
3. Edit patcher.go
4. Edit app_asar.go
5. Edit install.sh
6. Edit README.md
7. Test build
