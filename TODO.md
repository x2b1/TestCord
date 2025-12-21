# AutoQuestAccepter Fixes

## Issues to Fix
- [ ] Accept only works if in quest screen - switch manual acceptAllQuests to RestAPI instead of DOM clicks
- [ ] Doesn't accept video quests properly via manual method - RestAPI will fix
- [ ] Fails to claim quests - change PUT to POST for claim-reward
- [ ] Questify has to complete quests since AutoQuestAccepter wrongly does it - remove autoComplete functionality
- [ ] TypeError in claimAllQuests: className?.toLowerCase is not a function - fix className handling

## Changes Needed
- [ ] Update claimAllQuests to use RestAPI.post loop instead of DOM
- [ ] Update acceptAllQuests to use RestAPI loop instead of DOM
- [ ] Remove autoComplete settings and functions
- [ ] Remove completeInterval from start/stop
- [ ] Fix className handling in DOM filters (optional since removing DOM)
