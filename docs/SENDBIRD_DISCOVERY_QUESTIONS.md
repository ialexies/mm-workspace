# Sendbird Discovery Questions

Use this list to guide the upcoming meeting with the Sendbird team. Tailor or prioritise as needed based on time.

## 1. Product & Use Case Fit
- Can Sendbird comfortably support both 1:1 guest↔support conversations and multi-guest hostel channels with our expected concurrency?
- What best practices do you recommend for mixing temporary (booking-based) channels and persistent “property community” channels?
- Are there any notable limitations on message frequency, channel member counts, or attachment sizes we should plan around?

## 2. Authentication & Security
- We plan to authenticate users via Firebase and issue Sendbird session tokens from our backend. Any guidance on token TTL, renewal workflows, or revocation patterns?
- How should we handle staff/agent roles that need broader channel access—are there RBAC features we should leverage?
- What is the recommended approach to secure webhook endpoints (signature verification, IP allowlists)?

## 3. Moderation & Compliance
- Which moderation capabilities (auto-moderation, domain filtering, reporting APIs) come with our tier, and what requires add-ons?
- Are there best practices for human-in-the-loop moderation or escalation workflows?
- How does Sendbird assist with data residency, GDPR/CCPA compliance, and data retention policies?

## 4. Feature Roadmap & Integrations
- Does UIKit cover all features we need (reactions, typing indicators, unread counts, file uploads), or should we expect to build custom components?
- What upcoming roadmap items (e.g., analytics, AI moderation, message translation) might influence our implementation timeline?
- Can Sendbird integrate with our existing analytics/logging stack, or do you offer built-in dashboards we can rely on?

## 5. Performance & Reliability
- What SLAs/uptime guarantees apply to chat services and webhook delivery?
- How does Sendbird handle webhook retries and backoff if our endpoint is unavailable?
- Are there rate limits we need to factor into backend service design?

## 6. Implementation Support
- Can we get example implementations or starter kits matching our stack (Next.js frontend, Bun/Hono backend)?
- What level of technical support or solution architecture assistance do you provide during rollout?
- Are there tools for load testing or staging environments to validate before production launch?

## 7. Commercial Terms
- What pricing tier best fits our usage projections? Any volume discounts or add-on costs (e.g., moderation, analytics)?
- How does billing handle spikes (seasonal travel peaks) versus steady-state usage?
- Are there contractual considerations around data export, termination, or vendor lock-in we should review?

## 8. Next Steps
- What should we prepare before the next checkpoint (e.g., solution design diagram, estimated user counts)?
- Who will be our ongoing technical and account contacts post-meeting?


