# TODO: Update SystemMessageSpoofer Plugin

## Tasks
- [ ] Restructure plugin to use multiple separate commands instead of one "spoofsystem" with choices
- [ ] Create /spoofnitro command with options: duration, from_user, channel, delay
- [ ] Fix nitro embed to match official Discord Nitro gift embed structure
- [ ] Create /spoofserverboost command with options: message, channel, delay, sender (booster)
- [ ] Create /spoofclyde command with options: message, channel, delay
- [ ] Create /spoofsystem command with options: message, channel, delay (for general system messages)
- [ ] Add new commands for additional spoof types: /spoofvoice (with audio upload), /spoofmedia (with file upload), /spoofuserjoin, /spoofchannelpin, /spoofcallstart
- [ ] Ensure options are tailored per command to avoid redundancy
- [ ] Test the new commands in Discord

## Dependent Files
- src/testcordplugins/systemMessageSpoofer/index.ts
