# Translation Task: French to English in testcordplugins

## Overview
Translate all French plugin names, settings, descriptions, console logs, UI strings, and README content to English in the src/testcordplugins directory.

## Plugins with French Content Identified
Based on regex searches, the following plugins contain French text:

1. **token** - README.md and index.tsx (settings, logs, UI)
2. **soundboardPro** - index.tsx (settings, logs, UI)
3. **serverPinner** - README.md and index.tsx (settings, logs)
4. **messageCleaner** - index.tsx (settings, logs, UI)
5. **lockGroup** - index.tsx (logs, comments)
6. **leaveAllGroups** - index.tsx (settings, logs, UI)
7. **groupKicker** - index.tsx (settings, logs, UI)
8. **autoUnmute** - index.ts (comments)
9. **autoDeleter** - index.tsx (settings, logs)
10. **autoDeco** - index.ts (settings, logs)
11. **audioLimiter** - index.tsx (settings, UI)
12. **audioCenter** - index.tsx (settings, UI)
13. **antiGroup** - index.tsx (settings)
14. **antiDeco** - index.ts (comments)
15. **closeAllDms** - index.tsx (logs)
16. **chatGPT** - index.ts (logs, UI)
17. **serverBackup** - index.tsx (logs)
18. **zipPreview** - index.tsx (name might be English, but check)
19. **And potentially others with French plugin names like 'abreviation', 'accroche', 'annoiler', etc.**

## Translation Plan
For each plugin:
- Read the main file (index.tsx/ts) and README.md if present.
- Identify French strings in:
  - Plugin name
  - Settings descriptions
  - Console.log messages
  - UI text (buttons, notifications)
  - Comments
  - README content
- Translate to natural English equivalents.
- Update the files using edit_file tool.

## Steps
1. Start with plugins that have the most French content (token, soundboardPro, etc.)
2. For each plugin, edit the files.
3. After editing, mark as completed in this TODO.
4. Verify no French text remains using search_files.

## Dependent Files
- Each plugin's index.tsx/ts file
- README.md files where present

## Followup Steps
- Run search_files again to ensure all French text is translated.
- Test plugins if possible to ensure functionality remains intact.
