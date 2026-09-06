import { expect, test } from "vitest";
import {
  CIRCLING_CODES,
  GROUP_ORDER,
  RELATIONSHIPS,
  relationship,
  type RelGroup,
} from "./relationships";

test("there are exactly 18 relationships", () => {
  expect(RELATIONSHIPS).toHaveLength(18);
});

test("the four headings appear in Piper's order", () => {
  expect(GROUP_ORDER).toEqual(["coordinate", "restatement", "distinct", "contrary"]);
});

test("each group holds the counts Piper's chart holds", () => {
  const count = (g: RelGroup) => RELATIONSHIPS.filter((r) => r.group === g).length;
  expect(count("coordinate")).toBe(3);
  expect(count("restatement")).toBe(5);
  expect(count("distinct")).toBe(8);
  expect(count("contrary")).toBe(2);
});

test("definitions are the cheat sheet's wording verbatim", () => {
  expect(relationship("S").definition).toBe(
    "Each proposition makes its own independent contribution to a whole."
  );
  expect(relationship("AcPur").definition).toBe("An action and its intended result.");
  expect(relationship("SitR").definition).toBe(
    "A situation and its surprising or counter-intuitive response."
  );
});

test("coordinate relationships take two or more members, the rest take two", () => {
  for (const code of ["S", "P", "A"] as const) {
    expect(relationship(code).minMembers).toBe(2);
    expect(relationship(code).maxMembers).toBeNull();
  }
  expect(relationship("G").minMembers).toBe(2);
  expect(relationship("G").maxMembers).toBe(2);
});

test("Bilateral takes exactly three members", () => {
  expect(relationship("BL").minMembers).toBe(3);
  expect(relationship("BL").maxMembers).toBe(3);
});

test("only Ac-Pur, Ac-Res and Sit-R require a circled member", () => {
  expect([...CIRCLING_CODES].sort()).toEqual(["AcPur", "AcRes", "SitR"]);
  const requiring = RELATIONSHIPS.filter((r) => r.requiresCircle).map((r) => r.code).sort();
  expect(requiring).toEqual(["AcPur", "AcRes", "SitR"]);
});

test("Ground and Inference carry Piper's page 34 warning", () => {
  const warning =
    "Piper, p. 34: do not mix these two up. In Ground the conclusion comes first; in Inference it comes second.";
  expect(relationship("G").warning).toBe(warning);
  expect(relationship("Inf").warning).toBe(warning);
  expect(RELATIONSHIPS.filter((r) => r.warning).map((r) => r.code)).toEqual(["G", "Inf"]);
});

test("codes are unique and relationship() throws on an unknown code", () => {
  expect(new Set(RELATIONSHIPS.map((r) => r.code)).size).toBe(18);
  // @ts-expect-error deliberately outside RelCode
  expect(() => relationship("XX")).toThrow(/unknown relationship/);
});
