# Superpowers Glossary Capability Design

## Goal

Extend `dsh-superpowers-zh` from a skill bundle into a local DSH capability plugin. It maintains global and workspace glossary terms, exposes a Web management tab and narrow model CRUD tools, and deterministically supplies matching definitions to the model for the current turn.

## Scope

The plugin keeps the existing eight bundled engineering skills. It adds glossary storage and management only. It does not change DSH core, install a database server, use embeddings, or modify the system prompt.

## Data model

Use one SQLite file under DSH home, for example `$DSH_HOME/superpowers/glossary.sqlite`.

```text
terms
- id TEXT primary key (UUID)
- scope TEXT: global | workspace
- workspace TEXT nullable; required for workspace scope
- name TEXT not null
- aliases_json TEXT not null
- definition TEXT not null
- created_at TEXT not null
- updated_at TEXT not null
```

A global term has `workspace = NULL`. A workspace term is keyed by its canonical workspace path. The database is created with restrictive permissions by the root-run service.

## Resolution and injection

Before an agent turn is assembled, load global terms plus the selected workspace's terms. Match `name` and every alias by exact substring inclusion in the latest user text. Resolve duplicates by term identity and apply workspace precedence when the same matched phrase is defined in both scopes. Inject only a compact `【术语说明】` block into the current user message. Never alter the system prompt.

No match leaves the user message unchanged. The matcher has no LLM, embedding, or network dependency. English word boundaries are intentionally deferred; short aliases can cause false positives and may later gain boundary checks.

## Web UI

Add a `Superpowers` settings section with `Global` and `Current workspace` tabs. Each tab lists name, aliases, definition, and actions: create, edit, delete. Workspace rows additionally offer `Promote to global`; global rows offer `Move to workspace`. Moving changes scope rather than creating a duplicate.

The UI is local to the DSH origin and calls only plugin host routes. Every mutation uses same-origin POST/PUT/DELETE protections and validates bounded text fields.

## Model tools

Register four explicit tools:

- `glossary_list(scope?)`
- `glossary_upsert(name, aliases, definition, scope?)`
- `glossary_delete(id)`
- `glossary_move(id, scope)`

`glossary_upsert` defaults to the current workspace. Writing a global term requires `scope: global` explicitly. Tool results return the stored entry. The model receives no arbitrary SQL, filesystem path, or command execution capability.

## Boundaries and recovery

The plugin is a DSH bundle with host, client and skill surfaces. Updates require the existing DSH restart action. SQLite corruption or a failed write returns a clear tool/API error and preserves the previous database transaction. A service restart retains terms and sessions.

## Verification

1. Global terms match in any workspace.
2. Workspace terms match only in their workspace.
3. A conflicting workspace phrase takes precedence over global.
4. Two aliases of one term inject one definition.
5. No hit changes no message text.
6. Web CRUD and promotion/demotion persist after a DSH restart.
7. Model tools validate inputs and cannot access arbitrary files or shell commands.
