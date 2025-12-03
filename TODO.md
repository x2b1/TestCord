# TODO: Update SystemMessageSpoofer Plugin

## Tasks
- [x] Restructure plugin to use multiple separate commands instead of one "spoofsystem" with choices
- [x] Create /spoofnitro command with options: duration, from_user, channel, delay
- [x] Fix nitro embed to match official Discord Nitro gift embed structure
- [x] Create /spoofserverboost command with options: message, channel, delay, sender (booster)
- [x] Create /spoofclyde command with options: message, channel, delay
- [x] Create /spoofsystem command with options: message, channel, delay (for general system messages)
- [x] Add new commands for additional spoof types: /spoofvoice (with audio upload), /spoofmedia (with file upload), /spoofuserjoin, /spoofchannelpin, /spoofcallstart
- [x] Ensure options are tailored per command to avoid redundancy
- [x] Remove ephemeral properties from sendBotMessage calls
- [ ] Add voice message spoofing with audio upload option
- [ ] Add media spoofing with file upload option
- [ ] Test the new commands in Discord

## Dependent Files
- src/testcordplugins/systemMessageSpoofer/index.ts
