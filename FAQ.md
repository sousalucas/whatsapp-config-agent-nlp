# FAQ

## Q1) How you interpreted the assignment and scoped your MVP?

A: The first focus was to understand the purpose of this challenge and drawn the goal for it. I have a personal experience trying to configure whatsapp stuff through twilio and whatsapp businness apis, it's really really painful. The tool purposed in this challenge is precious, it keeps the richest usage of techonology to make people's life easier, that's the real purpose. It may seems simple in the challenge specs but it can be extended to many others things.

## Q2) How the agent works — LLM prompt design, tool/API mapping strategy, execution flow?

A: The agent receives a natural language message, sends it to an LLM (Anthropic, Gemini, etc) along with a strict system prompt scoped to WhatsApp/WATI operations and 14 tool definitions with JSON schemas; the LLM responds either with a final answer or a list of tool calls, which the planner classifies as read-only (executed immediately) or destructive (held for user confirmation), and once approved, the executor maps each tool name to the corresponding WATI HTTP API call, appends the results back to the conversation, and loops the LLM until it produces a final end_turn response.


## Q3) How LLMs were utilized and why you made those choices?

A: Even given a flexibility to config any LLM that is preferable, honestly I didn't make any comparison between models, but it would be good to make this and analyze which one would perform better. The main idea is just to give the freedom to choose/config any LLM and map them to WATI api and communicate properly.

## Q4) A breakdown of how you spent your time, what you prioritized, what you intentionally did not build, and what the "V2" roadmap would look like?

A1: First of all assimilating the entire text as a goal, in a macro view, just to keep it inside my mind and give a time to "chew" it. Then start to think in a micro view, writing small tasks (this later helped me to create good prompts for Claude). Then re-ready all this, prioritizing first tasks about the system design, how things would be connects and asking me if I was missing something (should not overengineering of course, but trying to keep "everything" covered). After that, start to interact with Claude and following my annotations (based on specs), creating code, reviewing (by myself) and testing (a bit of myself and automated tests).

A2: I would say next step would be focusing in new scenarios, trying to bring more WATI actions to the agent. Focusing on customers requirements to have more resources to theirs business.

## Q5) Any interesting decisions you made and why?

A: It was not mentioned but I thought TTS/STT features is really great, we can use the power of this transcription to make it simple using voice.