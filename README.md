# WhatsApp Config Agent NLP

A lightweight AI Agent that lets non-technical users configure WhatsApp Business workflows through natural language. Built on top of the WATI API.

> "Add contact +55 11 98765-4321 named Ana Beatriz, tag as new-customer, and send the welcome_message template"
>
> The agent figures out which WATI APIs to call, in what order, shows you the plan, and executes it on confirmation.

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# Run CLI (default — mock WATI API)
npm start

# Run Web UI
npm run web
# Open http://localhost:3000
```

## Architecture

```
User Input (natural language)
       │
       ▼
┌─────────────┐
│    Agent    │ ← Core orchestrator
│  agent.ts   │
└──────┬──────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  LLM         │────▶│   Planner    │
│  Adapter     │     │  planner.ts  │
│ (Anthropic/  │     └─────┬────────┘
|   Gemini...) │           |
└──────────────┘           │
                           ▼
                   ┌──────────────┐     ┌──────────────┐
                   │   Executor   │────▶│ WATI Client  │
                   │ executor.ts  │     │ (Mock/Real)  │
                   └──────────────┘     └──────────────┘
```

### Core Flow: Plan → Confirm → Execute

1. **User sends** a natural language instruction
2. **Agent forwards** to LLM with system prompt + tool definitions (14 tools)
3. **LLM responds** with tool_use blocks (one or more WATI operations)
4. **Planner** converts tool calls into a human-readable Plan
   - Classifies each step as read-only or destructive
   - Read-only steps (search, list) execute immediately
   - Destructive steps (send, create, update) require confirmation
5. **Plan is shown** to the user in CLI or Web UI
6. **User confirms** → Executor runs each step against WatiClient
7. **Results** are fed back to LLM for summarization
8. **Conversation continues** with full context

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single `WatiClient` interface** | ~10 methods total — splitting by domain would fragment without benefit |
| **No streaming in V1** | Plan-preview flow requires the complete LLM response before display |
| **Anthropic types as canonical format** | Most expressive for tool use; OpenAI adapter translates internally |
| **No database** | State = conversation message array in memory. Acceptable for V1 |
| **JSON locale files, no i18n library** | Agent UI strings only — no plural rules or date formatting needed |

## Project Structure

```
src/
├── index.ts                    # Entry point — --cli or --web mode
├── agent/
│   ├── agent.ts                # Core agent loop + system prompt
│   ├── planner.ts              # Converts LLM tool calls → Plan
│   ├── executor.ts             # Executes plan steps against WATI
│   └── tools.ts                # 14 tool definitions (JSON schemas for LLM)
├── llm/
│   ├── types.ts                # LLMProvider interface
│   ├── factory.ts              # ENV-based provider selection
│   └── anthropic.ts            # Anthropic tool-use adapter
├── wati/
│   ├── types.ts                # WatiClient interface + domain types
│   ├── factory.ts              # ENV-based mock/real selection
│   ├── client.ts               # Real WATI HTTP client (axios)
│   └── mock.ts                 # In-memory mock with seed data
├── i18n/
│   ├── index.ts                # t() translation function
│   ├── en.json                 # English strings
│   └── pt.json                 # Portuguese strings
├── interfaces/
│   ├── cli.ts                  # Readline REPL
│   ├── web.ts                  # Express REST API
│   └── web-public/             # Static chat UI (HTML/CSS/JS)
└── utils/
    └── config.ts               # ENV loading
```

## Configuration

All configuration via environment variables (`.env` file):

```env
# LLM Provider
LLM_PROVIDER=anthropic            # anthropic (more providers planned)
ANTHROPIC_API_KEY=sk-ant-...      # Required
ANTHROPIC_MODEL=claude-sonnet-4-20250514  # Default model

# WATI API
WATI_MODE=mock                     # mock (default) | real
WATI_API_URL=https://live-mt-server.wati.io/YOUR_TENANT
WATI_API_TOKEN=your-bearer-token

# Agent
AGENT_LOCALE=                      # en | pt (auto-detected if empty)
WEB_PORT=3000
```

## Adapters & Extensibility

### LLM Provider

The `LLMProvider` interface (`src/llm/types.ts`) defines a single `chat()` method. To add a new provider:

1. Create `src/llm/your-provider.ts` implementing `LLMProvider`
2. Add a case to `src/llm/factory.ts`
3. Set `LLM_PROVIDER=your-provider` in `.env`

### WATI API (Mock ↔ Real)

Toggle with `WATI_MODE=mock` or `WATI_MODE=real`:

- **Mock** (`src/wati/mock.ts`): In-memory with 5 seed contacts, 5 templates, 3 operators. All operations logged with `[MOCK]` prefix.
- **Real** (`src/wati/client.ts`): Axios-based HTTP client mapping 1:1 to WATI endpoints.

### Multi-Language

- Set `AGENT_LOCALE=pt` to force Portuguese, or leave empty for auto-detection
- The LLM detects the user's language and calls the internal `set_language` tool
- Add a new locale: create `src/i18n/xx.json` and register it in `src/i18n/index.ts`
- In the web UI, select the language via the `lang` query parameter (e.g. `/?lang=pt`)

## Demo Scenario: New Client Onboarding

Try this in the CLI or Web UI:

```
> Add contact +55 11 98765-4321 named Ana Beatriz, tag as new-customer, and send the welcome_message template
```

Expected plan:
```
📋 Here's what I'm planning to do:
  1. ⚠️  Add contact "Ana Beatriz" (5511987654321)
  2. ⚠️  Add tag "new-customer" to 5511987654321
  3. ⚠️  Send template "welcome_message" to 5511987654321

This plan includes actions that modify data. Proceed? (yes/no)
```

Portuguese works too:
```
> Adicionar contato +55 11 98765-4321 chamado Ana Beatriz, marcar como novo-cliente e enviar o template boas_vindas
```

## Agent Tools

The agent exposes 14 tools to the LLM, mapped to WATI API domains:

| Tool | Domain | Destructive |
|------|--------|:-----------:|
| `search_contacts` | Contacts | No |
| `get_contact_info` | Contacts | No |
| `add_contact` | Contacts | Yes |
| `update_contact_attributes` | Contacts | Yes |
| `add_tag` | Tags | Yes |
| `remove_tag` | Tags | Yes |
| `get_templates` | Templates | No |
| `send_template_message` | Messages | Yes |
| `send_session_message` | Messages | Yes |
| `send_broadcast` | Broadcasts | Yes |
| `get_operators` | Operators | No |
| `assign_operator` | Operators | Yes |
| `assign_ticket` | Operators | Yes |
| `set_language` | Internal | No |

Read-only tools execute automatically. Destructive tools require user confirmation.

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Type checking
npm run typecheck
```

**34 tests** covering:
- Mock WATI client (contact CRUD, tags, templates, operators)
- Planner (plan building, destructive detection, step descriptions)
- Executor (step execution, plan orchestration, error handling)
- i18n (locale switching, variable replacement, fallbacks)

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | Node.js + TypeScript | Type safety, modern async/await |
| LLM | Anthropic Claude (tool use) | Best-in-class tool calling |
| HTTP | Axios | Reliable for API integration |
| Web | Express | Minimal, no build step needed |
| Tests | Vitest | Fast, TypeScript-native |
| Dev runner | tsx | Direct TS execution, no build |

**4 runtime dependencies. No framework overhead.**
