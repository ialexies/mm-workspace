# Property group chat — CS quick guide

## What it is

- Each **Mad Monkey property** has **one group chat** in the app (Sendbird). Guests and staff message on that property’s channel.
- Guests see it in **My chats** once they are a member of that channel.

## When a **guest** is added (booking rules)

A guest is added to **that property’s** group chat when **all** of the following are true:

1. The reservation is from **Cloudbeds** and is **not** canceled / no-show.
2. **Today’s date** falls in the membership window: **from 14 days before check-in through 3 days after check-out** (inclusive).
3. The booking has a **guest email** that matches a **customer account** in our database (the email tied to their Mad Monkey / app profile).

**If the booking email and the app account email don’t match**, they may not be added automatically.

## **Staff / admin** access

- Internal **admin emails** are set in backend configuration (`PROPERTY_GROUP_CHAT_ADMIN_EMAILS`).
- Those accounts are added to **every** property group chat, as long as each email exists as a **customer** in our database.
- Changing who is on that list is done by **engineering / ops** — not via Sendbird or app settings by CS.

## “I don’t see the property chat” — quick checks

| Check | What to ask / do |
|--------|-------------------|
| Dates | Are they **within 14 days before check-in**, on stay, or **up to 3 days after check-out**? |
| Email | Does the **booking email** match their **logged-in account email**? |
| Login | Confirm they’re in **My chats** with the correct account. |
| Timing | After booking or email fixes, access may wait until the **next automatic sync** (often up to **~24 hours**) unless ops runs a sync sooner. |

## Short script for guests

> “Property chats follow your **booking dates** and the **email on your reservation**. They usually show in **My chats** when you’re in the window around your stay. If your booking email and app email are different, tell us or update your profile so we can match your booking.”

## Escalation

- **Email mismatch, no customer record, or still missing after ~24 hours:** escalate to **engineering / ops** (they verify booking email vs customer records and can run **property group chat sync** if needed).
- Do **not** promise chat access **outside** the date window described above.

---

_For technical detail: `PROPERTY_GROUP_CHATS_IMPLEMENTATION_PLAN.md` and backend `PropertyGroupChatService.ts`._
