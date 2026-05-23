# Plan: Migrate NIA Realtime Provider from OpenAI to ElevenLabs Agents

**Date:** 2026-05-22 11:23
**Inspired by:** https://elevenlabs.io/docs/eleven-agents/guides/quickstarts/java-script

## Goal

Replace the OpenAI Realtime API (WebRTC + data channels) with ElevenLabs Agents (`@elevenlabs/client` / `Conversation.startSession()`) as the sole realtime voice provider. Remove all OpenAI-specific realtime code and dependencies.

## Current Context

NIA is a Tauri/React desktop app for voice conversations with an AI assistant. It currently:

1. **Connects** via manual RTCPeerConnection to `api.openai.com/v1/realtime`
2. **Communicates** over a data channel (`oai-events`) with ~15+ event types
3. **Manages** its own VAD, STT, and TTS via OpenAI + optional ElevenLabs TTS overlays
4. **Supports custom tools** via OpenAI function calling (VTube Studio expressions, Firecrawl URL fetching)
5. **Tracks** per-token usage + cost via OpenAI's usage response
6. **Saves** session transcripts and costs to a local SQLite DB
7. **Configures** all agent behavior (voice, language, system prompt, model selection) locally in the settings

### Core Complexity Source

The `useRealtimeChat.ts` hook is **1071 lines** because it manually handles:
- WebRTC offer/answer/SDP exchange
- STUN server config
- Data channel lifecycle
- OpenAI-specific event routing (`conversation.item.*`, `response.*`, `input_audio_buffer.*`, `response.function_call_arguments.*`)
- ElevenLabs TTS streaming as a workaround (because OpenAI TTS quality was insufficient)
- Conditional logic toggling between OpenAI TTS and ElevenLabs TTS mid-conversation

## Proposed Approach: ElevenLabs Agents

### Key Discovery: ElevenLabs Supports Everything NIA Needs

**From the client tools documentation:**
- ElevenLabs Agents support **Client Tools** - functions executed in the browser/desktop app when the agent triggers them
- This directly maps to the **VTube Studio expression changes** and **Firecrawl URL fetching** currently implemented as OpenAI function calls
- Client tools can optionally **wait for response** and feed data back into the conversation

**From the JS quickstart:**
```javascript
import { Conversation } from '@elevenlabs/client';

conversation = await Conversation.startSession({
    agentId: 'YOUR_AGENT_ID',
    onConnect: () => { /* connected */ },
    onDisconnect: () => { /* disconnected */ },
    onError: (error) => { /* error */ },
    onModeChange: (mode) => {
        // mode.mode === 'speaking' | 'listening'
    },
});
```

The API is drastically simpler:
- No manual WebRTC
- No data channels
- No event routing
- No separate TTS layer
- Agent handles STT, LLM, TTS end-to-end
- Voice and behavior configured on ElevenLabs dashboard

### Functionality Parity Analysis

| Feature | Current (OpenAI Realtime) | ElevenLabs Agents | Parity? |
|---------|--------------------------|-------------------|---------|
| Voice conversation | WebRTC + DataChannel | Conversation.startSession() | ✓ Full |
| VAD (Voice Activity Detection) | OpenAI handles (input_audio_buffer) | Built-in | ✓ Full |
| Live user transcript | conversation.item.input_audio_transcription.* | onModeChange + client tools | ✓ Near-full |
| Live agent transcript | response.audio_transcript.* | onModeChange | ✓ Near-full |
| VTube Studio expressions | OpenAI function calling | Client Tools | ✓ Full |
| Firecrawl URL fetching | OpenAI function calling | Client Tools or Server Tools | ✓ Full |
| Custom system prompt | session.update tools config | ElevenLabs Dashboard | ~ Partial (dashboard only) |
| Language selection | Injected into session instructions | Configured on agent dashboard | ~ Partial (dashboard only) |
| Voice selection | OpenAI voices (alloy/echo/etc.) | ElevenLabs voices via agent config | ✓ Different set |
| Text input support | conversation.item.create with role:user | `@elevenlabs/client` supports text | ~ Need to verify |
| Session cost tracking | Token-based ($/1M tokens) | Subscription/minutes-based | ✗ Different model |
| Session transcript saving | SQLite via manual `response.done` handler | Conversation Analysis dashboard | ~ Dashboard has it, but local DB needs rework |
| Microphone/speaker selection | navigator.mediaDevices | navigator.mediaDevices | ✓ Unchanged |
| Audio visualizers | MediaRecorder on user/agent streams | Same approach works | ✓ Unchanged |
| Dark mode | Theme toggle | Theme toggle | ✓ Unchanged |
| OpenAI-specific TTS | separate ElevenLabs TTS overlay | Agent handles its own TTS | ✓ Removes complexity |
| Model selection (gpt-realtime/*) | UI dropdown | Configured on agent dashboard | ✗ Removed |
| ElevenLabs TTS separate service | Streaming WebSocket TTS | No longer needed | ✓ Can be removed |

### Key Observations

1. **The ElevenLabs TTS service** (`src/services/elevenlabs.ts`, 425 lines) was a *workaround* for poor OpenAI Realtime audio quality. With ElevenLabs Agents, the agent's own voice output IS ElevenLabs quality — this entire service becomes unnecessary.

2. **Session cost tracking** cannot use token-based accounting anymore. ElevenLabs is subscription-based (e.g., $5, $22, $99/mo) plus per-minute overage. We could track session duration instead of tokens.

3. **Configuration moves to the dashboard**: Voice, language, system prompt, and tools are configured on the ElevenLabs agent dashboard, not in NIA's settings UI. The local config becomes primarily for API keys and device preferences.

4. **`@elevenlabs/client`** is the package needed for `Conversation` — it is *separate* from `@elevenlabs/elevenlabs-js` (currently used for TTS). May need both or just the new one.

## Step-by-Step Plan

### Phase 1: Exploration & Prerequisites (Before Code Changes)

1. **Create an ElevenLabs agent** on dashboard with desired voice, language, and system prompt
2. **Test the JS quickstart** with the agent ID to confirm `Conversation.startSession()` works in the Tauri context
3. **Install `@elevenlabs/client`** — `npm install @elevenlabs/client`
4. **Verify client tool API** works for VTube Studio by registering a simple test tool

### Phase 2: Rewrite `useRealtimeChat.ts`

This is the big one. The hook goes from ~1071 lines to an estimated 300-400 lines.

**What changes:**
- Remove all OpenAI WebRTC setup (lines 744-1001)
- Remove OpenAI event handler (`handleServerEvent`, lines 591-713)
- Remove OpenAI session.update with tool definitions (lines 845-931)
- Remove OpenAI-specific settings loading (`getOpenAISettings`, `apiKey`, etc.)
- Remove ElevenLabs TTS streaming (`initializeStreamingTTS`, `handleStreamingTextChunk`, `finishStreamingTTS`, lines 509-589)
- Remove `handleTTSPlayback` OpenAI/ElevenLabs toggle (lines 470-507)
- Remove `handleFunctionCall` OpenAI event (lines 358-422)
- Remove `sendClientEvent` data channel helper (lines 211-217)
- Remove `sendTextMessage` OpenAI conversation.item.create (lines 1014-1043)
- Remove token usage state (`tokenUsage`, `setTokenUsage`)
- Remove model selection state (`selectedModel`, `setSelectedModel`)
- Remove `peerConnection`, `dataChannel`, `audioEl` refs
- Remove `elevenlabsAudio`, `isStreamingTTS`, `streamingBuffer` state
- Remove `getOpenAISettings` import and usage

**What gets added:**
- `Conversation.startSession()` in `handleConnect`
- `conversation.endSession()` in `handleDisconnect`
- `ClientTools` registration for VTube Studio and Firecrawl
- `onConnect` callback → `setIsConnected(true)`
- `onDisconnect` callback → `setIsConnected(false)`
- `onModeChange` callback → update live transcript display
- `onMessage` / transcript callback → update `conversationLog` and live transcript
- ElevenLabs API key loading from settings instead of OpenAI API key
- Agent ID loading from settings

**What stays:**
- Microphone/speaker device selection
- Volume/mute controls
- Audio visualizer recording (user side)
- Conversation log state
- Live transcript state
- Session recording (reworked for duration-based)

### Phase 3: Update Configuration UI

Two config files exist. Both need updating.

**`src/pages/Configuration.tsx`** (535 lines, has ElevenLabs TTS UI):
- Replace "OpenAI API Key" field with "ElevenLabs API Key" field
- Replace "OpenAI Voice" selection with "ElevenLabs Agent ID" field
- Remove OpenAI voice test (`testVoice`, stopAudio)
- Keep ElevenLabs voice test (may need rework — agents don't work like TTS)
- Remove "AI Model" dropdown (gpt-realtime / gpt-realtime-mini)
- Remove "TTS Provider" toggle (no longer needed — agent has built-in TTS)
- Remove "System Prompt" textarea (configured on dashboard)
- Remove "Pricing Information" card for OpenAI
- Remove "Validate API Key" button for OpenAI
- Remove "OpenAI API Key" status chips
- Keep: "ElevenLabs API Key", "Conversation Language", Dark Mode, Firecrawl API Key
- Add: "Agent ID" text field
- Update `handleSave` to save new settings shape

**`src/components/Configuration.tsx`** (329 lines, simpler OpenAI-only config):
- This file appears to be the original / simpler version
- Probably superseded by `src/pages/Configuration.tsx`
- Should verify which is actually used in `App.tsx` — `src/pages/Configuration.tsx` is imported

### Phase 4: Update `db.ts` Settings Schema

**`src/db.ts`** (176 lines):
- `Settings` interface: Remove `apiKey`, `voice`, `prompt`, `model`, `ttsProvider`
- Add: `elevenlabsAgentId`, `elevenlabsApiKey` (existing)
- Rename `OpenAISettings` type → `ElevenLabsSettings` (or remove and generalize)
- Update `getSettings()` parsing to reflect new keys
- Update `getOpenAISettings()` → rename to `getRealtimeSettings()`

### Phase 5: Update `db/sessions.ts`

**`src/db/sessions.ts`** (187 lines):
- `Session` interface: Remove token fields (`inputAudioTokens`, `outputAudioTokens`, `inputTextTokens`, `outputTextTokens`, `total_cost`)
- Replace `model` field with `agent_id` string
- Remove `calculateSessionCost()` function
- Session cost tracking becomes session *duration* tracking (ElevenLabs subscriptions)
- Update `saveSession()` to match new schema

### Phase 6: Update `SessionCostTracker.tsx`

**`src/components/SessionCostTracker.tsx`** (132 lines):
- Remove all token-based pricing tables
- Replace with duration-only display (elapsed time)
- Remove "Tokens Used" display
- ElevenLabs cost is subscription-based; tracking per-session cost isn't meaningful
- Show a simplified "Session Time" + duration counter

### Phase 7: Clean Up ElevenLabs TTS Service

**`src/services/elevenlabs.ts`** (425 lines):
- This service was built for streaming TTS overlay on OpenAI audio
- With ElevenLabs Agents handling their own TTS, this entire service can be **removed**
- Exception: keep it if you want a standalone "test voice" feature in config
- But testing a voice directly (TTS) is different from testing an agent (conversational)

### Phase 8: Update Tauri Permissions

**`src-tauri/capabilities/default.json`**:
- Remove `https://api.openai.com/v1/realtime*` URL permission
- Add `https://api.elevenlabs.io/*` URL permission
- Keep `https://api.firecrawl.dev/*`

### Phase 9: Update `package.json`

- Remove `@openai/agents` dependency
- Add `@elevenlabs/client` dependency
- Keep `@elevenlabs/elevenlabs-js` if test-voice feature is retained
- Remove any other OpenAI-specific packages

### Phase 10: Remove/Archive Docs

- Remove or archive `docs/REALTIME_SETUP.md`
- Remove or archive `docs/openai_realtime.md`
- Remove or archive `docs/new_openai_docs.md`
- Remove or archive `docs/openai_repo_reference.md`
- Remove or archive `docs/openai_server_events.md`
- Remove or archive `docs/node_example.js`
- Remove or archive `docs/webrtc_react_example.jsx`
- Keep `docs/elevenlabs_docs.md` (already exists)

### Phase 11: UI Page Updates

**`src/pages/RealtimeChat.tsx`** (226 lines):
- Update props from `useRealtimeChat` (remove `tokenUsage`, `selectedModel`, `sessionStartTime`, `audioEl`, `sendTextMessage`)
- Remove `MessageInput` component (text input handled differently? Or keep it)
- Remove `SessionCostTracker` (or use the simplified version)
- Update API key warning to say ElevenLabs instead of OpenAI
- Remove OpenAI-specific text
- Audio element ref no longer needed (agent stream handled internally)

## Files Likely to Change

| File | Change Type | Est. Lines |
|------|-------------|-----------|
| `src/hooks/useRealtimeChat.ts` | **Major rewrite** | ~450 lines (was 1071) |
| `src/pages/Configuration.tsx` | **Major rewrite** | ~300 lines (was 535) |
| `src/pages/RealtimeChat.tsx` | Moderate rewrite | ~180 lines (was 226) |
| `src/db.ts` | Moderate rewrite | ~60 lines (was 176) |
| `src/db/sessions.ts` | Moderate rewrite | ~120 lines (was 187) |
| `src/services/elevenlabs.ts` | **Remove** (or keep for TTS test) | 0-425 |
| `src/components/SessionCostTracker.tsx` | **Remove** or simplify | 0-132 |
| `src/components/Configuration.tsx` | **Remove** (superseded) | 0-329 |
| `src-tauri/capabilities/default.json` | Update URLs | ~20 lines |
| `package.json` | Update deps | ~2 lines |
| `docs/*` | Remove 6+ OpenAI docs | 0 lines |

## Risks, Tradeoffs, and Open Questions

### Risks
1. **ElevenLabs `Conversation.startSession()` vs Tauri's WebView**: Need to verify that the `@elevenlabs/client` SDK works within Tauri's WebView context (may need specific CSP/permissions)
2. **Audio output device selection**: Currently done via `audioEl.current.setSinkId()`. The `Conversation` class manages its own audio output internally — may need to investigate if we can control the output device
3. **Transcript streaming** for live display: OpenAI provides granular events for streaming transcripts. ElevenLabs `onModeChange` may provide less granularity for partial/hypothetical transcripts
4. **Text input alongside voice**: The current UI has a text input field (`MessageInput`). Need to verify `Conversation` supports text input alongside audio, or if it's voice-only
5. **Agent behavior reconfiguration**: System prompt changes currently happen in-app. With dashboard-based config, changing agent behavior requires returning to the ElevenLabs dashboard

### Tradeoffs
1. **Configuration moves to dashboard**: Simpler client, but less power-user flexibility
2. **Cost tracking becomes duration-based**: More predictable pricing (subscription) but less granular per-session visibility
3. **Lose model selection flexibility**: ElevenLabs chooses which LLM powers the agent (configurable on dashboard, but not in-app)
4. **Significant code deletion**: ~1500+ lines of hooks/services removed, simplifying maintenance

### Open Questions
1. Does `@elevenlabs/client` support configurable **audio output device** (setSinkId)?
2. Does the `Conversation` class support **text input** or is it voice-only?
3. Does `Conversation` emit events for **streaming transcript text** (for live display), or only `onModeChange`?
4. Can we provide **dynamic system prompt** or is it locked to dashboard config?
5. What is the pricing for ElevenLabs Agents vs. OpenAI Realtime for this use case?
6. Does the `@elevenlabs/client` package work in a Tauri WebView (no node.js APIs needed)?

## Verification Steps

1. **Build**: `npm run build` succeeds with no TypeScript errors
2. **Tauri dev**: `npm run tauri dev` launches without errors
3. **Connect**: "Connect and Talk" button triggers `Conversation.startSession()` and connects to ElevenLabs agent
4. **Voice chat**: Speak and hear the agent respond in the configured voice/language
5. **VTube Studio**: Saying "change expression" triggers the VTube Studio client tool
6. **URL fetching**: Asking the agent to "fetch a URL" triggers the Firecrawl client tool
7. **Live transcripts**: As agent speaks, text appears in the "Agent" transcript panel
8. **Session saving**: After disconnect, the session appears in the Sessions view
9. **Configuration**: Setting ElevenLabs API key and Agent ID persists and works
10. **Old features removed**: No remaining references to OpenAI API key, model selection, or TTS provider toggles
