import { ESV_NOTICE, ESV_URL } from "@/core/tokens";

const SPLIT_AT = ESV_NOTICE.indexOf("ESV");
if (SPLIT_AT === -1) {
  throw new Error("ESV_NOTICE no longer contains the word ESV; EsvNotice cannot link it.");
}

/**
 * Crossway's licence requires the notice on every page using the text, with
 * "ESV" linked to www.esv.org. The string itself lives in tokens.ts and is
 * pinned by a test; this only decides where the link goes.
 */
export function EsvNotice() {
  return (
    <p className="esv-notice" data-testid="esv-notice">
      {ESV_NOTICE.slice(0, SPLIT_AT)}
      <a href={ESV_URL} target="_blank" rel="noreferrer">
        ESV
      </a>
      {ESV_NOTICE.slice(SPLIT_AT + "ESV".length)}
    </p>
  );
}
