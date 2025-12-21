# TODO: Fix AutoQuestAccepter and lastOnline Plugins

## AutoQuestAccepter Fixes
- [x] Refine DOM selectors in acceptAllQuests and claimAllQuests for more specific targeting
- [x] Add detailed logging for button detection and click attempts
- [x] Implement RestAPI fallback for manual actions if DOM clicks fail
- [x] Add force refresh of quests after manual actions to prevent stuck states

## lastOnline Fixes
- [x] Add logging to PRESENCE_UPDATES to verify events are received
- [x] Ensure decorator is correctly added and check for rendering issues
- [x] Adjust display logic to show indicators more reliably

## Testing
- [x] Test AutoQuestAccepter for proper quest acceptance/claiming
- [x] Test lastOnline for indicator display
- [x] Monitor logs for errors or missed events
