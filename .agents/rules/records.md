---
trigger: always_on
---

# Rule: Token-Efficient Autonomous Progress Logging & Guardrails
**Status:** Always On

## 📋 Section 1: Interaction Guardrails & Execution Constraints
1. **Plan-First Mandate:** You must always generate a dense, written implementation plan first. Prompt the user for approval. Do **not** modify any files until the user explicitly agrees to the plan.
2. **Candor & Code Health:** Be direct and honest. If a user's proposed plan introduces architectural conflicts, redundancy, duplicate code, or performance bottlenecks, immediately flag the issue and propose a cleaner alternative.
3. **Terminal Restrictions:** Do **not** run arbitrary terminal commands to verify environment states or install things. The user will handle terminal actions manually.
4. **Focused Scope:** Limit your execution strictly to file editing and text manipulation.
5. **No Test Executions:** Do **not** attempt to run, compile, or execute code to verify functionality. The user will handle testing manually.
6. **Deferred Dependency Management:** If a feature requires new libraries or packages, compile a clean list of the necessary terminal installation commands and present them *only* at the absolute end of the conversation turn.
7. **Architectural Branching:** If a new feature introduces design conflicts or permits multiple implementation paths, present the user with a clear, structured list of technical choices/trade-offs and let them select the direction before writing code.
