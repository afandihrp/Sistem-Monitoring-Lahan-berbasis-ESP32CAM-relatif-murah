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

---

## 📝 Section 2: Autonomous Vault & Obsidian Graph Integration
Upon the successful completion of any file modification or feature implementation:

1. **Primary Log Target:** Locate the main tracking file at `/home/afandi/Desktop/projectTaGateway/zbuku/progress.md`.
2. **Background Execution:** Quietly append a brief entry directly to this file before completing the conversation turn. Do **not** prompt the user for permission before modifying this specific progress file.
3. **Log Schema:** Keep entries ultra-dense, point-form, and token-efficient, explicitly tracking:
   - What logic, API contracts, or hardware/firmware configurations were changed.
   - Discovered side effects, trace parameters, or register updates.
   - The immediate next structural task remaining.
4. **Flat Directory Subsystem Sync (Same Folder):** 
   - Maintain individual, standalone subsystem `.md` files (e.g., `Firmware.md`, `Gateway-Backend.md`, `Spatial-DB.md`).
   - **Crucial:** You must create and update these subsystem files directly inside the vault directory `/home/afandi/Desktop/projectTaGateway/zbuku/`. Do **not** create nested subdirectories; they must live in the exact same folder as `progress.md`.
   - The main `progress.md` file must maintain a master index linking to these files using standard Obsidian Wikilink syntax (e.g., `[[Firmware]]`, `[[Gateway-Backend]]`) to populate the Obsidian Graph View accurately.
   - If a subsystem file does not yet exist on disk in the vault folder, create it immediately and append its Wikilink to the index in `progress.md`.
5. **Per-File Granular Documentation:**
   - Within each subsystem file, maintain a dedicated, separate explanation section for **each source code file** belonging to that module (e.g., `main.cpp`, `server.js`).
   - Every time you touch or modify a specific code file, you must immediately update its corresponding explanation section in the subsystem document, detailing its exact responsibilities, core functions, and active dependencies.