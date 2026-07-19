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

## 📝 Section 2: Hierarchical Vault Automation & Obsidian Graph Mesh Integration
Upon the successful completion of any file modification or feature implementation:

1. **Primary Log Target:** Locate the main tracking file at `/home/afandi/Desktop/projectTaGateway/zbuku/progress.md`.
2. **Background Execution:** Quietly update your records before completing the conversation turn. Do **not** prompt the user for permission before modifying any markdown documentation files in this target directory.
3. **Log Schema:** Keep entries ultra-dense, point-form, and token-efficient, explicitly tracking what logic or hardware parameters changed, side effects, and immediate next structural steps.
4. **Top-to-Bottom Hierarchical Link Mesh & Intermediary Constraints:**
   - **Level 1 (Root/Intermediary):** `progress.md` acts as the primary central connector. To preserve clean relational boundaries, Level 2 subsystem nodes must **not** link directly to each other. Inter-subsystem connections must pass exclusively through Level 1 as the single structural intermediary.
   - **Level 2 (Subsystems Architecture & General Documentation):** Each Subsystem file acts as an architectural bridge for its specific domain. You must explicitly document the following structural details within this file:
     - **Protocols Utilized:** Communication and data transfer protocols used (e.g., HTTP/HTTPS, MQTT, Serial/UART, SPI, WebSockets).
     - **Core Modules & Dependencies:** Primary external libraries, hardware drivers, or npm/c++ packages driving the subsystem and their roles.
     - **API Endpoint Registry:** Catalog of all exposed REST/HTTP endpoints (Method, Path), use cases, and required conditions.
     - **WebSocket Gateway Interface:** Explicit documentation of all WebSocket connections, detailing precise JSON payload structures, event names, and data keys.
     - **Subsystem Master Entrypoint Link:** The subsystem file must **only** link to the absolute primary entrypoint or master code file node of that system using a Wikilink (e.g., `[[code-main.cpp]]` or `[[code-server.js]]`). It must **not** list all level 3 files flatly.
   - **Level 3 (Hierarchical Individual File Nodes):** Every single source code file you create or edit must have its own dedicated `.md` file created in the folder. Level 3 files are **strictly forbidden** from linking back up to Level 2 files; they must resolve upwards exclusively through their own hierarchical chain to the Master Entrypoint node.
   - **Flat Storage Constraint:** All generated documentation files (`progress.md`, subsystem files, and individual source code documentation files) must live directly inside the tracking directory `/home/afandi/Desktop/projectTaGateway/zbuku/`. Do **not** create nested subdirectories inside `zbuku/`.
5. **Deep Interdependency Mapping, Content Spec & Granular Logs:**
   - **Topological Hierarchical Link Mesh:** Level 3 documentation nodes must be linked in a strict top-to-bottom master-slave functional sequence. The Master entrypoint note links down to its primary branch files/controllers, which in turn link down to their child services, utility scripts, or database drivers (`Master -> Slave Branch -> Sub-level Utility -> ...`).
   - Every Level 3 file's `.md` document must explicitly place direct Wikilinks at the top pointing out **Parent Node** (which file imports/calls it) and **Child/Slave Nodes** (which files it calls, imports, or forwards data to).
   - Each individual file's documentation node must contain a strict markdown layout detailing:
     - **Core Functional Objective:** Exactly what the file's logic does.
     - **Specific Use Case:** Why it exists in the lifecycle of the system.
     - **Per-Entity Granular Documentation:** Explicit documentation of every code entity contained within the file (functions, subroutines, instantiations, export/import structures, components, object schemas, object methods, class abstractions, state variables, API endpoints, or hardware register configurations). Each entity must have a clear text breakdown detailing its operational scope, expected properties, and what it handles.
     - **Granular Change History Log:** You must append a specific change log entry directly into this individual documentation file whenever you modify its corresponding source code file, detailing the exact internal logic adjustments made.
   - Ensure all files are cleanly linked together so they form a beautiful, multi-layered visual tree layout inside the Obsidian Graph View.

---

## 🧠 Section 3: Context Retrieval Bootstrapping & Token Recovery
1. **Cold-Start Protocol:** If you enter a new conversation thread, encounter a reset context window, or lack sufficient functional context regarding the active workspace state, you are **strictly forbidden** from reading, parsing, or searching through the entire raw codebase directory structure.
2. **Documentation-First Resolution:** You must immediately navigate to `/home/afandi/Desktop/projectTaGateway/zbuku/progress.md` and read it to establish the baseline project state. 
3. **Targeted Traversal:** Follow the explicit Obsidian Wikilinks from `progress.md` down into the relevant subsystem `.md` file, down to the Subsystem Master Node, and follow the master-slave mesh links down to the specific individual source file node documentation required for the current prompt. Use only these structured markdown notes to build your technical understanding of the system architecture before requesting access to or editing individual active code files.