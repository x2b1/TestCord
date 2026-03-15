# Fix Testcord Crash After Git Pull from Dev

Status: In progress

## Steps from Approved Plan:

- [x] Edit `src/api/PluginManager.ts`: Add null coalescing `?? {}` to `const settings = Settings.plugins;` in `startDependenciesRecursive` (2 places)
- [x] Edit `src/api/Settings.ts`: After `mergeDefaults`, add `settings.plugins ??= {};`

- [ ] Rebuild project (`npm run build` or dev command)
- [ ] Test launch, verify no crash
- [ ] Update this TODO with results
- [ ] attempt_completion

## Current Progress:

Initial diagnosis complete. Core issue: `Settings.plugins` undefined during plugin deps check.

Next step: Edit PluginManager.ts
