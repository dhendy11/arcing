// Copy, colour and type constants pinned by the spec. Values here are the
// single source; globals.css repeats them as CSS variables because CSS
// cannot import TypeScript, and tokens.test.ts is what keeps them honest.
export const COLORS = {
  paper: "#faf8f5",
  ink: "#1c1917",
  accent: "#1d4ed8",
  destructive: "#b91c1c",
} as const;

// The spec asks for an amber ring on a missing circle but names no hex.
// This is the one added value; see the plan's decisions list.
export const AMBER = "#b45309";

export const BASE_FONT_PX = 17;
export const MIN_TARGET_PX = 44;

export const FONT_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
export const FONT_SERIF = 'Georgia, "Times New Roman", serif';

// Crossway's licence condition, quoted exactly. Do not reword, do not wrap
// it in extra punctuation, do not shorten it.
export const ESV_NOTICE =
  "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

export const ESV_URL = "https://www.esv.org";
