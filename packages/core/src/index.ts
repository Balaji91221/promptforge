// @promptforge/core — public surface.
export { refine, MIN_CHARS_FOR_REWRITE, isDeflection } from "./prompt-helper/index.js";
export type { LlmCall, RefineOutput, RefineStatus, RefineOptions } from "./prompt-helper/index.js";
export { META_PROMPT, META_PROMPT_VERSION, buildUserTurn } from "./prompt-helper/meta-prompt.js";
export type { AttachmentNote } from "./prompt-helper/meta-prompt.js";
export { parseResult, extractJson, ParseError } from "./prompt-helper/parser.js";
export { TEMPLATES, preClassify, hintForIntent } from "./prompt-helper/templates.js";
export { PROVIDERS, buildLlmCall, defaultConfig, testProvider } from "./prompt-helper/providers.js";
export type { ProviderId, ProviderSpec, ModelOption, LlmConfig, ConnTest } from "./prompt-helper/providers.js";
export { ruleTrim } from "./optimizer/trim.js";
export {
  shouldCompress,
  detectPaste,
  compressPayload,
  assemblePrompt,
  MIN_TOKENS_TO_COMPRESS,
} from "./optimizer/compress.js";
export type {
  CompressDecision,
  CompressOutcome,
  CompressedPayload,
  PasteContext,
  PayloadCompressor,
} from "./optimizer/compress.js";
export { splitPaste, looksLikeJsonArray, MIN_PAYLOAD_ITEMS } from "./optimizer/paste.js";
export type { PasteSplit } from "./optimizer/paste.js";
export {
  buildHeadroomCompress,
  headroomHealth,
  acceptCompression,
  isLoopbackUrl,
  HEADROOM_DEFAULTS,
  HEADROOM_TOKENIZER_MODEL,
  MIN_SAVED_RATIO,
} from "./optimizer/headroom.js";
export type { HeadroomConfig, HeadroomHealth, AcceptDecision, CompressStats } from "./optimizer/headroom.js";
export {
  builtinCompress,
  compressBuiltin,
  crushJsonArray,
  parseJsonArray,
  routeContent,
  csvCell,
} from "./optimizer/crusher.js";
export type { ContentType } from "./optimizer/crusher.js";
export { estimateTokens, tokenDelta } from "./metering/tokenizer.js";
export {
  EventStore,
  InMemoryBackend,
  type KeyValueBackend,
} from "./shared/store.js";
export { ConfigLoader, type RemoteConfig } from "./shared/config-loader.js";
