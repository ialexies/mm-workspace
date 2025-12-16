# TODO List

## In Progress

- [ ]

## Pending

- [ ] Disable the auto creation of channel for customers with same destination and date in the backend

## Completed

- [x] Disable automatic group channel creation for same destination and dates - disabled in frontend by early return in `loadDestinationChannels` function in `frontend/pages/my-chats/index.tsx`
- [x] Disable all group channels in frontend, show only DMs - filtered out non-DM group channels in `ChatChannelList.tsx`, removed destination channels and open channels from display

---

## Notes 

_Add any additional notes or context here_
