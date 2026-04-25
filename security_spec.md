# MathMentor AI Security Specification

## 1. Data Invariants
- A user can only read/write their own profile, assessments, and memory.
- Assessment results must have a non-negative score and totalQuestions > 0.
- Timestamps must be server-generated.
- Users cannot modify their `totalPoints` directly (system should manage it, or we enforce logic if we allow them to add after an assessment).

## 2. The Dirty Dozen Payloads (Targeting `/users/{userId}/...`)

1. **Identity Theft**: User A tries to create a profile for User B.
2. **Score Injection**: User A submits an assessment with score 999/10.
3. **Ghost Field**: Adding `isAdmin: true` to a profile update.
4. **Time Travel**: Setting `completedAt` to 2030 (future) instead of `request.time`.
5. **Memory Corruption**: User A wiping User B's agent memory.
6. **Negative Progress**: Submitting a negative score.
7. **Type Mismatch**: Sending a string for `totalPoints`.
8. **ID Poisoning**: Using a 2KB string as `userId`.
9. **Relational Sync Break**: Submitting an assessment for a non-existent topic (if we had a topics collection to check).
10. **Shadow Update**: Overwriting `displayName` while also changing `userId` in the payload (if allowed).
11. **Blanket Read attempt**: Querying all user profiles.
12. **Unverified Auth**: Accessing data with an unverified email (if enforced).

## 3. Test Runner (Draft)

Testing will verify `PERMISSION_DENIED` for all malicious payloads.
