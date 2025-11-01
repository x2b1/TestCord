# TODO: Modify supportHelper.tsx for Testcord Commands

- [ ] Change command names from `/equicord-debug` and `/equicord-plugins` to `/testcord-debug` and `/testcord-plugins`
- [ ] Remove predicates from both commands to make them usable everywhere
- [ ] Change "Equicord" to "Testcord" in the debug info output
- [ ] Remove the 100+ plugins check in `generatePluginList()` to always send the list
- [ ] Update `renderMessageAccessory` to check for "/testcord-..." and update button texts
