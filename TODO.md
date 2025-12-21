# TODO: Fix AutoQuestAccepter and lastOnline Plugins - Round 2

## AutoQuestAccepter Fixes
- [x] Change accept interval to 20 seconds instead of 30
- [x] Fix completion logic - currently sets to 99% instead of properly completing quests like questify
- [x] Fix rate limiting - only 1 quest accepted, others failed
- [x] Add video quest auto-completion after acceptance
- [ ] Test manual accept/claim functions

## lastOnline Fixes
- [x] Fix indicator text - changed "Online X ago" to "Last online X ago"
- [ ] Fix indicator visibility - last online text not showing anywhere
- [ ] Add decorators to additional locations (DM lists, user popups, etc.)

## Testing
- [ ] Test updated accept interval
- [ ] Test proper quest completion
- [ ] Test last online indicators
- [ ] Monitor logs for rate limiting and errors
