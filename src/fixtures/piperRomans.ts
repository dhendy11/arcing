// John Piper's own arc of Romans 12:1-2 from Biblical Exegesis, pp. 21-23:
// his four propositions, his labels, his circles. This is the ONLY sanctioned
// sample passage. Never use Ephesians in a fixture; that is Drew's own
// weekly series and an app-generated arc of it would pollute the practice.
//
// The diagram on p. 23 reads: Pu circled over 1, a stroke over 2a, + over 2b,
// Pu circled over 2c, Ac in the arc over 2a-2b, Ac in the arc over 2a-2c, no
// symbol on the outer arc. In this app's data model that is three arcs:
// NegPos(2a, 2b), then AcPur(that, 2c) with 2c circled, then AcPur(1, that)
// with 1 circled.
import { createArc, setCircled } from "@/core/arcTree";
import { newArcDoc } from "@/core/doc";
import { splitAt } from "@/core/split";
import type { ArcDoc } from "@/core/types";

export const PIPER_ROMANS_REFERENCE = "Romans 12:1-2";

export const PIPER_ROMANS_TEXT =
  "I beseech you by the mercies of God, brothers, to present your bodies to God as a living, holy, acceptable sacrifice which is your spiritual service of worship. And do not be conformed to this age but be transformed by the renewing of your mind, in order that you might approve what the will of God is, namely, the good, the acceptable, and the perfect.";

/** The first word of propositions 2, 3 and 4, used to find the split points. */
export const PIPER_SPLIT_WORDS = ["And do not", "but be transformed", "in order that"] as const;

export function piperRomansDoc(): ArcDoc {
  let doc = newArcDoc({
    id: "2026-09-05-romans-12-1-2",
    reference: PIPER_ROMANS_REFERENCE,
    canonical: PIPER_ROMANS_REFERENCE,
    source: "paste",
    text: PIPER_ROMANS_TEXT,
    verses: [],
    now: new Date("2026-09-05T15:00:00Z"),
  });

  for (const phrase of PIPER_SPLIT_WORDS) {
    doc = splitAt(doc, doc.passage.text.indexOf(phrase));
  }

  doc = createArc(doc, [{ kind: "prop", ref: "p2" }, { kind: "prop", ref: "p3" }], "NegPos");
  doc = createArc(doc, [{ kind: "arc", ref: "a1" }, { kind: "prop", ref: "p4" }], "AcPur");
  doc = setCircled(doc, "a2", 1);
  doc = createArc(doc, [{ kind: "prop", ref: "p1" }, { kind: "arc", ref: "a2" }], "AcPur");
  doc = setCircled(doc, "a3", 0);
  return doc;
}
