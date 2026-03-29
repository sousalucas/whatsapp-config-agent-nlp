# WhatsApp Config Agent NLP

A lightweight AI Agent that lets non-technical users configure WhatsApp Business workflows through natural language. Built on top of the WATI API.

> "Add contact +55 11 98765-4321 named Ana Beatriz, tag as new-customer, and send the welcome_message template"
>
> The agent figures out which WATI APIs to call, in what order, shows you the plan, and executes it on confirmation.

## Live Demo

Hosted at: https://whatsapp-configuration-agent-nlp.onrender.com

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
│   ├── factory.ts              # ENV-based provider selection (anthropic | gemini | mock)
│   ├── anthropic.ts            # Anthropic tool-use adapter
│   ├── gemini.ts               # Google Gemini adapter
│   └── mock.ts                 # Pattern-matched mock LLM (for CLI e2e tests)
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
│   ├── web.ts                  # Express REST API (createWebApp + startWeb)
│   └── web-public/             # Static chat UI (HTML/CSS/JS)
└── utils/
    └── config.ts               # ENV loading

tests/                          # Unit tests (Vitest)
├── mock-wati.test.ts
├── planner.test.ts
├── executor.test.ts
├── i18n.test.ts
└── errors.test.ts

e2e/                            # E2E tests
├── playwright.config.ts        # Playwright config (Chromium, API + Web UI)
├── fixtures/
│   ├── mock-llm.ts             # Queue-based MockLLMProvider
│   ├── test-server.ts          # Starts Express on random port per test
│   ├── llm-scenarios.ts        # Pre-built LLM response sequences
│   └── playwright-fixtures.ts  # Custom Playwright fixtures
├── api/                        # API e2e tests (no browser)
│   ├── health.spec.ts
│   ├── chat.spec.ts
│   ├── confirm.spec.ts
│   └── locale.spec.ts
├── web-ui/                     # Browser e2e tests (Chromium)
│   ├── elements.spec.ts
│   ├── chat.spec.ts
│   ├── language.spec.ts
│   └── confirmation.spec.ts
└── cli/                        # CLI e2e tests (Vitest + execa)
    └── cli.spec.ts
```

## Configuration

All configuration via environment variables (`.env` file):

```env
# LLM Provider
LLM_PROVIDER=anthropic            # anthropic | gemini | mock (mock = no API key, for e2e tests)
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

## Voice Input & Output

The Web UI supports voice interaction via the browser-native Web Speech API — no extra dependencies or API keys needed.

### Speech-to-Text (Voice Input)

Click the **🎤 microphone button** (next to Send) to speak a command. Your speech is transcribed in real-time and sent through the same pipeline as typed text.

- Uses `SpeechRecognition` / `webkitSpeechRecognition`
- Shows a live transcript and pulsing red indicator while recording
- Automatically stops after one utterance
- Language follows the UI locale (`en-US` / `pt-BR`)

### Text-to-Speech (Voice Output)

Click the **🔇 speaker toggle** (in the header) to enable reading agent responses aloud.

- Uses `SpeechSynthesis` (browser-native)
- Speaks text responses and plan confirmations
- Strips HTML tags and emojis for clean audio
- Toggle off at any time to stop and disable

### Browser Support

Both features use the Web Speech API, which is best supported in Chrome and Edge. On unsupported browsers, the mic and speaker buttons are automatically hidden — the text-based UI remains fully functional.

### Edge Cases Handled

- Microphone permission denied → friendly error message in chat
- Network unavailable (Chrome sends audio to Google servers) → error message
- Language change while recording → recording stops cleanly, speech cancelled
- Mic disabled during loading state and plan confirmation

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

The project has two layers of tests: unit tests (Vitest) and end-to-end tests (Playwright + Vitest).

### Unit Tests

```bash
# Run all unit tests
npm test

# Watch mode
npm run test:watch
```

**41 tests** covering:
- Mock WATI client (contact CRUD, tags, templates, operators)
- Planner (plan building, destructive detection, step descriptions)
- Executor (step execution, plan orchestration, error handling)
- i18n (locale switching, variable replacement, fallbacks)

### E2E Tests

E2E tests use **Playwright** for the Web UI and API, and **Vitest + execa** for the CLI. All tests run against a mock LLM and mock WATI client — no API keys needed.

```bash
# Run all e2e tests (API + Web UI + CLI)
npm run test:e2e

# Run individual suites
npm run test:e2e:api      # 12 API endpoint tests (Playwright)
npm run test:e2e:web      # 17 Web UI browser tests (Playwright/Chromium)
npm run test:e2e:cli      # 6 CLI interaction tests (Vitest + execa)
```

**35 e2e tests** covering:

| Suite | Tool | Tests |
|-------|------|------:|
| API: `/api/chat`, `/api/confirm`, `/api/locale`, `/api/health` | Playwright | 12 |
| Web UI: elements, chat, language switching, plan confirm/reject | Playwright (Chromium) | 17 |
| CLI: exit, greeting, read-only queries, confirm/reject flow | Vitest + execa | 6 |

#### E2E Architecture

- **`e2e/fixtures/mock-llm.ts`** — queue-based `MockLLMProvider` (enqueue scripted responses per test)
- **`e2e/fixtures/test-server.ts`** — starts Express on a random port; each test gets an isolated server
- **`e2e/fixtures/llm-scenarios.ts`** — pre-built response sequences (greeting, list contacts, send template)
- **`e2e/fixtures/playwright-fixtures.ts`** — Playwright custom fixture wiring server + mock LLM per test
- **`LLM_PROVIDER=mock`** — pattern-matched mock LLM for CLI subprocess tests (no API key needed)

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | Node.js + TypeScript | Type safety, modern async/await |
| LLM | Anthropic Claude (tool use) | Best-in-class tool calling |
| HTTP | Axios | Reliable for API integration |
| Web | Express | Minimal, no build step needed |
| Tests | Vitest + Playwright | Unit tests + full e2e coverage |
| Dev runner | tsx | Direct TS execution, no build |

**4 runtime dependencies. No framework overhead.**

## FAQ

See [FAQ.md](FAQ.md) for common questions and troubleshooting.
