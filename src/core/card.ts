// Width-aware, theme-tinted cards for Oh My Pi's rows renderer.
import { wrap } from "@oh-my-pi/pi-tui/text/width";
import type { RowsView } from "./api.ts";
import { displayWidth, truncateToWidth } from "../research/research-format.ts";

export type SemanticCardIntent =
  | "neutral"
  | "active"
  | "success"
  | "warning"
  | "danger"
  | "accent";
export interface CardBadge {
  label: string;
  value: string;
  intent?: SemanticCardIntent;
}

export interface CardSection {
  title?: string;
  content: string[] | RowsView;
  divider?: boolean;
}

export interface CardSpec {
  title: string;
  subtitle?: string;
  intent: SemanticCardIntent;
  badges?: CardBadge[];
  sections: CardSection[];
  footerActions?: string[];
}

export interface ThemeHelper {
  isLight?: boolean;
  fg(colorKey: string, text: string): string;
  bg(colorKey: string, text: string): string;
}

export const ROUNDED_BORDER_CHARS = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
};

export interface ResolvedIntentTokens {
  bgToken: string;
  borderToken: string;
  accentToken: string;
}

/**
 * Maps abstract semantic card intent to concrete Oh My Pi theme tokens.
 */
export function resolveIntentTokens(intent: SemanticCardIntent): ResolvedIntentTokens {
  switch (intent) {
    case "active":
      return { bgToken: "toolPendingBg", borderToken: "borderAccent", accentToken: "borderAccent" };
    case "success":
      return { bgToken: "toolSuccessBg", borderToken: "success", accentToken: "success" };
    case "warning":
      return { bgToken: "toolPendingBg", borderToken: "warning", accentToken: "warning" };
    case "danger":
      return { bgToken: "toolErrorBg", borderToken: "error", accentToken: "error" };
    case "accent":
      return { bgToken: "customMessageBg", borderToken: "borderAccent", accentToken: "accent" };
    case "neutral":
    default:
      return { bgToken: "customMessageBg", borderToken: "borderMuted", accentToken: "dim" };
  }
}

/**
 * Fallback ANSI color escapes when theme object is not provided or lacks methods.
 */
function fallbackFg(colorKey: string, text: string): string {
  const map: Record<string, string> = {
    success: "32",
    error: "31",
    warning: "33",
    borderAccent: "36",
    borderMuted: "90",
    accent: "35",
    dim: "90",
    muted: "90",
    text: "0",
  };
  const code = map[colorKey] ?? "0";
  return code === "0" ? text : `\x1b[${code}m${text}\x1b[0m`;
}

/**
 * Normalizes an unknown theme parameter into a guaranteed ThemeHelper.
 */
export function normalizeTheme(theme: unknown): ThemeHelper {
  if (
    theme &&
    typeof theme === "object" &&
    "fg" in theme &&
    typeof (theme as ThemeHelper).fg === "function" &&
    "bg" in theme &&
    typeof (theme as ThemeHelper).bg === "function"
  ) {
    return theme as ThemeHelper;
  }
  return {
    isLight: false,
    fg: fallbackFg,
    bg: (_key: string, text: string) => text,
  };
}

/**
 * A responsive horizontal divider line component that dynamically scales to viewport width.
 */
export class ResponsiveDividerLine implements RowsView {
  constructor(
    public title: string | undefined,
    public colorFn: (text: string) => string,
  ) {}

  render(width: number): string[] {
    const safeWidth = Math.max(0, width);
    if (!this.title) {
      return [this.colorFn("─".repeat(safeWidth))];
    }
    const label = ` ${this.title} `;
    const labelWidth = displayWidth(label);
    if (labelWidth >= safeWidth) {
      return [truncateToWidth(label, safeWidth)];
    }
    const remaining = safeWidth - labelWidth;
    const leftLen = Math.min(3, Math.floor(remaining / 2));
    const rightLen = remaining - leftLen;
    return [
      this.colorFn("─".repeat(leftLen)) +
        label +
        this.colorFn("─".repeat(rightLen)),
    ];
  }
}
/**
 * Component that formats badges atomically into lines based on available width.
 */
class BadgesComponent implements RowsView {
  constructor(
    public badges: Array<{ label: string; value: string; intent?: SemanticCardIntent }>,
    public theme: ThemeHelper,
    public defaultTokens: ResolvedIntentTokens,
  ) {}

  render(width: number): string[] {
    const formattedBadges = this.badges.map((b) => {
      const badgeTokens = b.intent ? resolveIntentTokens(b.intent) : this.defaultTokens;
      const lbl = this.theme.fg("dim", b.label.toUpperCase());
      const val = this.theme.fg(badgeTokens.accentToken, b.value);
      return `[${lbl}: ${val}]`;
    });

    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentLen = 0;

    for (const badge of formattedBadges) {
      const bLen = displayWidth(badge);
      if (currentLine.length === 0) {
        currentLine.push(badge);
        currentLen = bLen;
      } else if (currentLen + 1 + bLen <= width) {
        currentLine.push(badge);
        currentLen += 1 + bLen;
      } else {
        lines.push(currentLine.join(" "));
        currentLine = [badge];
        currentLen = bLen;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(" "));
    }
    return lines;
  }
}

/**
 * Component that formats footer action hints atomically into lines.
 */
class FooterActionsComponent implements RowsView {
  constructor(
    public actions: string[],
    public theme: ThemeHelper,
  ) {}

  render(width: number): string[] {
    const formattedHints = this.actions.map((act) => this.theme.fg("dim", `⟨${act}⟩`));
    const lines: string[] = [];
    let currentLine: string[] = [];
    let currentLen = 0;

    for (const hint of formattedHints) {
      const hLen = displayWidth(hint);
      if (currentLine.length === 0) {
        currentLine.push(hint);
        currentLen = hLen;
      } else if (currentLen + 2 + hLen <= width) {
        currentLine.push(hint);
        currentLen += 2 + hLen;
      } else {
        lines.push(currentLine.join("  "));
        currentLine = [hint];
        currentLen = hLen;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join("  "));
    }
    return lines;
  }
}

/**
 * Component that formats content lines with hanging indents for bullets.
 */
class ContentLinesComponent implements RowsView {
  constructor(public lines: string[]) {}

  render(width: number): string[] {
    const out: string[] = [];
    if (width <= 0) return out;

    for (const line of this.lines) {
      const bullet = line.match(/^(\s*(?:•|-|\*|⚡)\s+)(.*)$/);
      const indent = bullet ? displayWidth(bullet[1]) : 0;
      if (bullet && indent < width) {
        const body = wrap(bullet[2], width - indent);
        for (const [i, row] of body.entries()) {
          out.push((i === 0 ? bullet[1] : " ".repeat(indent)) + row);
        }
      } else {
        out.push(...wrap(line, width));
      }
    }
    return out;
  }
}

export function createTuiCard(spec: CardSpec, themeInput?: unknown): RowsView {
  const theme = normalizeTheme(themeInput);
  const tokens = resolveIntentTokens(spec.intent);
  const paintBorder = (text: string) => theme.fg(tokens.borderToken, text);
  const title = `\x1b[1m${theme.fg(tokens.accentToken, spec.title)}\x1b[0m`;
  const parts: RowsView[] = [
    new ContentLinesComponent(spec.subtitle ? [title, theme.fg("dim", spec.subtitle)] : [title]),
  ];
  const hasBadges = Boolean(spec.badges?.length);
  if (spec.badges?.length) parts.push(new BadgesComponent(spec.badges, theme, tokens));

  let lastWasDivider = false;
  for (const [i, section] of spec.sections.entries()) {
    if (section.divider || i > 0 || hasBadges) {
      if (!lastWasDivider) {
        parts.push(new ResponsiveDividerLine(section.title, paintBorder));
        lastWasDivider = true;
      }
    } else if (section.title) {
      parts.push(new ContentLinesComponent([`\x1b[1m${theme.fg("accent", section.title)}\x1b[0m`]));
      lastWasDivider = false;
    }

    if (!Array.isArray(section.content) || section.content.length > 0) {
      parts.push(Array.isArray(section.content) ? new ContentLinesComponent(section.content) : section.content);
      lastWasDivider = false;
    }
  }
  if (spec.footerActions?.length) {
    parts.push(new ResponsiveDividerLine(undefined, (text) => theme.fg("borderMuted", text)));
    parts.push(new FooterActionsComponent(spec.footerActions, theme));
  }

  return {
    render(width) {
      if (width < 5) return width > 0 ? [truncateToWidth(spec.title, width)] : [];
      const innerWidth = width - 2;
      const contentWidth = innerWidth - 2;
      const border = ROUNDED_BORDER_CHARS;
      const rule = border.horizontal.repeat(innerWidth);
      const side = paintBorder(border.vertical);
      const lines = [paintBorder(border.topLeft + rule + border.topRight)];
      for (const part of parts) {
        for (const row of part.render(contentWidth)) {
          const text = truncateToWidth(row, contentWidth);
          const padding = " ".repeat(Math.max(0, innerWidth - 1 - displayWidth(text)));
          lines.push(side + theme.bg(tokens.bgToken, ` ${text}${padding}`) + side);
        }
      }
      lines.push(paintBorder(border.bottomLeft + rule + border.bottomRight));
      return lines;
    },
  };
}
