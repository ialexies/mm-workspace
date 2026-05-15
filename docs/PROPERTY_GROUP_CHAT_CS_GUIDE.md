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

- Staff admins are stored in **Postgres**: tables **`property_group_chat_admins`** and **`property_group_chat_admin_properties`** (for property-specific access).
- **Global** admins are included in **every** property group chat; **scoped** admins only for configured **`property_id`** values (Cloudbeds IDs).
- Each listed person must still exist as a **customer** in our database (`customers` row).
- Changing who has access is done by **engineering / ops** (SQL or scripts — see `backend/docs/PROPERTY_GROUP_CHAT_ADMINS.md`), not via Sendbird or app settings by CS.
- Legacy env **`PROPERTY_GROUP_CHAT_ADMIN_EMAILS`** may still be used **only when running seed scripts**; the running backend sync reads **from the database**, not from that env var.

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

_For technical detail: `PROPERTY_GROUP_CHATS_IMPLEMENTATION_PLAN.md`, `backend/docs/PROPERTY_GROUP_CHAT_ADMINS.md`, and backend `PropertyGroupChatService.ts`._
