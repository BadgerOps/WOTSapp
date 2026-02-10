# Architecture Failure Modes (Top 5)

The app is a Firebase-first SPA: React clients read/write Firestore directly, while Cloud Functions handle scheduling, approvals, weather logic, and notification fan-out. This keeps delivery fast, but it concentrates risk in idempotency, Firestore rules, role consistency, and third-party dependency handling.

## Top Failure Modes

1. **Notification fan-out saturation**
   - **Trigger:** `onPostCreated` / survey / pass notification functions collect all tokens and send a single large multicast; invalid-token cleanup uses one Firestore batch.
   - **Symptoms:** Partial/failed notification delivery as token count grows, function retries/failures.
   - **Detection:** Monitor Cloud Function error rate and `successCount` vs `failureCount` in notification logs.
   - **Mitigation:** Chunk token sends, chunk cleanup writes, consider FCM topics for broad announcements.

2. **Duplicate/competing UOTD writes**
   - **Trigger:** Minute schedulers (`uotdScheduler`, `scheduledWeatherCheck`, auto-publish) rely on check-then-write patterns without a single deterministic document key per slot/date.
   - **Symptoms:** Duplicate or superseded recommendations/posts, confusing approval state.
   - **Detection:** Alert on multiple records sharing same `targetDate + targetSlot`.
   - **Mitigation:** Use deterministic IDs (for slot/date) and transactionally combine existence check + write.

3. **Role sync regression (privilege drift)**
   - **Trigger:** `functions/roleSync.js` only treats `user`, `uniform_admin`, `admin` as valid while app/rules also use `leave_admin` and `candidate_leadership`.
   - **Symptoms:** Leadership users downgraded to `user`; permission-denied errors for expected workflows.
   - **Detection:** Scheduled diff between `personnel.role` and `users.role`; auth-denied spike monitoring.
   - **Mitigation:** Centralize shared role enum/validation across frontend, functions, and rules.

4. **Over-permissive Firestore write paths**
   - **Trigger:** Rules permit broad authenticated updates in some workflows (notably liberty/status group operations).
   - **Symptoms:** Unauthorized mutation/tampering risk, inconsistent workflow data, audit noise.
   - **Detection:** Audit `updatedBy` vs ownership/role, anomaly alerts for non-privileged write volume.
   - **Mitigation:** Move sensitive transitions to callable functions and tighten rules to ownership + field constraints.

5. **External dependency outage propagation**
   - **Trigger:** Weather and notification critical paths depend on third-party APIs (WeatherAPI, FCM) with limited resilience controls.
   - **Symptoms:** Stale/missing weather recommendations, delayed notifications, degraded user trust.
   - **Detection:** Alert on scheduled/callable failure rates and weather cache staleness.
   - **Mitigation:** Add retries with backoff, timeouts, fallback behavior (last-known-good/default uniform), and explicit health alarms.

## Confirmed vs Inferred

- **Confirmed from repo evidence:** Firebase Auth + Firestore + Storage + Cloud Functions (callables, triggers, schedulers), WeatherAPI dependency, FCM push fan-out, rules-driven authorization model.
- **Inferred:** Production concurrency/load characteristics and growth thresholds (exact blast radius depends on real traffic/token counts).
