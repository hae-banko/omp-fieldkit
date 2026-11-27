// Unit tests for Unified Native TUI Card Engine (SPEC-003 / ADR-0007).

import {
  createTuiCard,
  normalizeTheme,
  resolveIntentTokens,
  ResponsiveDividerLine,
  type CardSpec,
  type ThemeHelper,
} from "../src/core/card.ts";
import { displayWidth } from "../src/research/research-format.ts";
import { fail } from "./test-utils.ts";

export function runCardTests(): void {
  console.log("Running card engine test suite...");

  // 1. resolveIntentTokens mappings
  const activeTokens = resolveIntentTokens("active");
  if (activeTokens.bgToken !== "toolPendingBg" || activeTokens.borderToken !== "borderAccent") {
    fail(`resolveIntentTokens("active") unexpected: ${JSON.stringify(activeTokens)}`);
  }

  const successTokens = resolveIntentTokens("success");
  if (successTokens.bgToken !== "toolSuccessBg" || successTokens.borderToken !== "success") {
    fail(`resolveIntentTokens("success") unexpected: ${JSON.stringify(successTokens)}`);
  }

  const dangerTokens = resolveIntentTokens("danger");
  if (dangerTokens.bgToken !== "toolErrorBg" || dangerTokens.borderToken !== "error") {
    fail(`resolveIntentTokens("danger") unexpected: ${JSON.stringify(dangerTokens)}`);
  }

  const warningTokens = resolveIntentTokens("warning");
  if (warningTokens.bgToken !== "toolPendingBg" || warningTokens.borderToken !== "warning") {
    fail(`resolveIntentTokens("warning") unexpected: ${JSON.stringify(warningTokens)}`);
  }

  const neutralTokens = resolveIntentTokens("neutral");
  if (neutralTokens.bgToken !== "customMessageBg" || neutralTokens.borderToken !== "borderMuted") {
    fail(`resolveIntentTokens("neutral") unexpected: ${JSON.stringify(neutralTokens)}`);
  }

  // 2. normalizeTheme safe fallbacks
  const fallback = normalizeTheme(undefined);
  if (typeof fallback.fg !== "function" || typeof fallback.bg !== "function") {
    fail("normalizeTheme(undefined) failed to provide fg/bg functions");
  }
  const sampleFg = fallback.fg("success", "OK");
  if (!sampleFg.includes("OK")) {
    fail(`normalizeTheme fallback fg failed to contain text: ${sampleFg}`);
  }

  // 3. ResponsiveDividerLine rendering
  const dividerNoTitle = new ResponsiveDividerLine(undefined, (t) => `[${t}]`);
  const outNoTitle = dividerNoTitle.render(20);
  if (!outNoTitle[0].includes("────")) {
    fail(`dividerNoTitle failed to render horizontal dashes: ${outNoTitle[0]}`);
  }

  const dividerWithTitle = new ResponsiveDividerLine("DETAILS", (t) => t);
  const outWithTitle = dividerWithTitle.render(40);
  if (!outWithTitle[0].includes(" DETAILS ")) {
    fail(`dividerWithTitle failed to render centered title: ${outWithTitle[0]}`);
  }

  // 4. createTuiCard rendering with full feature spec
  const bgCalls: string[] = [];
  const fgCalls: string[] = [];
  const mockTheme: ThemeHelper = {
    isLight: false,
    fg(colorKey: string, text: string): string {
      fgCalls.push(colorKey);
      return `\x1b[32m${text}\x1b[39m`;
    },
    bg(colorKey: string, text: string): string {
      bgCalls.push(colorKey);
      return `\x1b[42m${text}\x1b[49m`;
    },
  };

  const spec: CardSpec = {
    title: "COUNCIL VERDICT",
    subtitle: "Software Presets · 3 Personas",
    intent: "success",
    badges: [
      { label: "mode", value: "quick", intent: "active" },
      { label: "status", value: "consensus", intent: "success" },
    ],
    sections: [
      {
        title: "CONSENSUS INVARIANTS",
        content: ["- Use stdlib before dependencies", "- Enforce type guards at seams"],
      },
      {
        title: "CUSTOM COMPONENT SLOT",
        content: { render: () => ["Telemetry: [████░░░░] 50%"] },
        divider: true,
      },
    ],
    footerActions: ["Enter: /implement", "Esc: dismiss"],
  };

  const card = createTuiCard(spec, mockTheme);
  const rendered80 = card.render(80);

  // Check top border, title, badges, sections, footer, and bottom border
  if (rendered80.length < 6) {
    fail(`createTuiCard rendered fewer lines than expected: ${rendered80.length}`);
  }

  // Top border contains rounded corner glyphs
  if (!rendered80[0].includes("╭") || !rendered80[0].includes("╮")) {
    fail(`createTuiCard top border missing rounded glyphs: ${rendered80[0]}`);
  }

  // Bottom border contains rounded corner glyphs
  const lastLine = rendered80[rendered80.length - 1];
  if (!lastLine.includes("╰") || !lastLine.includes("╯")) {
    fail(`createTuiCard bottom border missing rounded glyphs: ${lastLine}`);
  }

  // Verified background tinting was invoked with intent token
  if (!bgCalls.includes("toolSuccessBg")) {
    fail(`createTuiCard failed to call theme.bg with "toolSuccessBg", called: ${bgCalls.join(", ")}`);
  }

  // Verified border coloring was invoked with success token
  if (!fgCalls.includes("success")) {
    fail(`createTuiCard failed to call theme.fg with "success", called: ${fgCalls.join(", ")}`);
  }

  for (const width of [0, 1, 4, 5, 20, 120]) {
    const rows = card.render(width);
    if (rows.some((row) => displayWidth(row) > width)) {
      fail(`createTuiCard overflowed its ${width}-column viewport`);
    }
    if (width >= 5 && displayWidth(rows[0]) !== width) {
      fail(`createTuiCard top border did not fill ${width} columns`);
    }
  }

  console.log("Card engine tests complete.");
}
