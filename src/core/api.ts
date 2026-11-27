// Minimal structural contracts for the subset of the omp ExtensionAPI this
// package uses. The runtime passes the full API, which is a structural
// superset, so these stay assignable both ways without depending on the
// `@oh-my-pi/pi-coding-agent` type package.

/** ANSI rows accepted by the host's custom message and tool renderers. */
export interface RowsView {
  render(width: number): string[];
}

export interface CustomOverlayComponent extends RowsView {
  handleInput?(data: string): void;
  dispose?(): void;
}

export interface CustomUiHost {
  requestRender(): void;
  size(): { readonly columns: number; readonly rows: number };
}

export type CustomOverlayFactory<T> = (
  ui: CustomUiHost,
  theme: unknown,
  keybindings: unknown,
  done: (result: T) => void,
) => CustomOverlayComponent | Promise<CustomOverlayComponent>;

export interface CommandContext {
  /** True when an interactive UI is available; false in --headless / CI modes. */
  hasUI?: boolean;
  ui?: {
    notify?(message: string, level?: string): void;
    setStatus?(key: string, text: string | undefined): void;
    input?(
      prompt: string,
      placeholder?: string,
      dialogOptions?: unknown,
    ): Promise<string | undefined>;
    editor?(
      title: string,
      prefill?: string,
      dialogOptions?: unknown,
      editorOptions?: { promptStyle?: boolean },
    ): Promise<string | undefined>;
    select?(
      title: string,
      options: Array<{ label: string; description?: string; value?: string } | string>,
      dialogOptions?: unknown,
    ): Promise<string | undefined>;
    /**
     * Launch a modal overlay component. The runtime mounts the component,
     * drives `render`/`handleInput`, and resolves once the component returns
     * `undefined` (user dismissed) or the action it returned.
     */
    custom?<T>(
      factory: CustomOverlayFactory<T>,
      options?: {
        overlay?: boolean;
        fullscreen?: boolean;
      },
    ): Promise<T>;
  };
 }

export interface CommandHandlerDef {
  description?: string;
  getArgumentCompletions?: (
    argumentPrefix: string,
  ) => Array<{ value: string; label: string; description?: string }> | null;
  handler: (args: string, ctx: CommandContext) => Promise<void> | void;
}

/** Shape accepted by `pi.sendMessage` for a custom message entry. */
export interface CustomMessagePayload {
  customType?: string;
  content?: string;
  display?: boolean;
  details?: unknown;
  attribution?: "user" | "agent";
}

export interface SendMessageOptions {
  deliverAs?: "steer" | "followUp" | "nextTurn" | "aside";
  triggerTurn?: boolean;
}


/** Minimal view of the `tool_call` event (pre-exec, may block or revise). */
export interface ToolCallEvent {
  toolName: string;
  input: Record<string, unknown>;
}

/** Minimal view of the `context` event (messages about to hit the LLM). */
export interface ContextEvent {
  messages: unknown[];
}

export interface ContextEventResult {
  messages?: unknown[];
}

/**
 * Minimal view of the `before_agent_start` event. The runtime builds the
 * system prompt fresh every turn and passes it as an array of blocks; each
 * handler sees the array chained from the previous handler's result
 * (`extensions/runner.ts` `emitBeforeAgentStart`). Extensions append blocks
 * to the tail and never rewrite earlier ones (AGENTS.md §8 prefix stability).
 */
export interface BeforeAgentStartEvent {
  prompt: string;
  systemPrompt: string[];
}

export interface BeforeAgentStartEventResult {
  systemPrompt?: string[];
  message?: CustomMessagePayload;
}

/** Narrow an `unknown` before_agent_start payload; `undefined` if malformed. */
export function asBeforeAgentStartEvent(event: unknown): BeforeAgentStartEvent | undefined {
  if (!event || typeof event !== "object" || !("systemPrompt" in event)) return undefined;
  const blocks = event.systemPrompt;
  if (!Array.isArray(blocks) || !blocks.every((b): b is string => typeof b === "string")) return undefined;
  const prompt = "prompt" in event && typeof event.prompt === "string" ? event.prompt : "";
  return { prompt, systemPrompt: blocks };
}

/**
 * Minimal view of the `ExtensionContext` the runtime passes as the second
 * argument to every `pi.on(...)` handler. Task subagents get their own
 * context with `hasUI: false`; `sessionManager.getSessionId()` changes on
 * `/new`, resume, and fork (none of which re-run the extension factory or
 * emit `session_start`). See docs/state-machines.md §0.
 */
export interface EventContext {
  cwd?: string;
  hasUI?: boolean;
  ui?: CommandContext["ui"];
  sessionManager?: { getSessionId?(): string };
}

/** Narrow an `unknown` handler context to the fields this package reads. */
export function asEventContext(ctx: unknown): EventContext {
  return ctx && typeof ctx === "object" ? (ctx as EventContext) : {};
}

/** Session id of the session that emitted the event, when the runtime exposes it. */
export function sessionIdOf(ctx: unknown): string | undefined {
  const id = asEventContext(ctx).sessionManager?.getSessionId?.();
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

export interface ContentBlock {
  type: string;
  text: string;
}

export interface ToolResult {
  content: ContentBlock[];
  details?: unknown;
}

/** Minimal view of a `registerTool` definition. */
export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute(
    toolCallId: string,
    params: unknown,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: { cwd: string; hasUI?: boolean; ui?: unknown; abort?: (() => void) | undefined },
  ): Promise<ToolResult>;
  renderCall?(
    args: Record<string, unknown>,
    options: { expanded: boolean },
    theme: unknown,
  ): unknown;
  renderResult?(
    result: ToolResult,
    options: { expanded: boolean },
    theme: unknown,
    args?: Record<string, unknown>,
  ): unknown;
}

/** Minimal zod/v4 chain used to author tool parameter schemas. */
export interface ZodLike {
  object(shape: Record<string, unknown>): unknown;
  enum(values: readonly string[]): { default(value: string): unknown; optional(): unknown };
  string(): { optional(): unknown };
  array(item: unknown): { min(n: number): unknown };
  record(keyType: unknown, valueType?: unknown): { optional(): unknown };
  number(): { int(): { min(n: number): { max(n: number): { optional(): unknown } } } };
  boolean(): { optional(): unknown };
}

/** The subset of the omp ExtensionAPI this package registers against. */
export interface ExtensionApi {
  registerCommand(name: string, def: CommandHandlerDef): void;
  sendUserMessage(content: string, options?: { deliverAs?: string }): Promise<unknown>;
  sendMessage(message: CustomMessagePayload, options?: SendMessageOptions): void;
  on(event: string, handler: (event: unknown, ctx?: unknown) => unknown): void;
  registerTool(def: ToolDefinition): void;
  registerMessageRenderer(
    customType: string,
    renderer: (message: unknown, options: unknown, theme: unknown) => unknown,
  ): void;
  zod: ZodLike;
}
