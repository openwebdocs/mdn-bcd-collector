import { assert, getSpec } from "./utils.js";
import { type Section } from "./types.js";
import type { getEarlyErrors } from "./index.js";

const $ = await getSpec();

type EarlyErrorRecord = Awaited<ReturnType<typeof getEarlyErrors>>;

export function collectEarlyErrors(toc: Section[]): EarlyErrorRecord {
  const earlyErrorIDs = [];

  (function findEarlyErrorIDs(sections: Section[]) {
    for (const section of sections) {
      if (section.title === "Static Semantics: Early Errors")
        earlyErrorIDs.push(section.id);
      findEarlyErrorIDs(section.children);
    }
  })(toc);

  const earlyErrors: EarlyErrorRecord = {};

  $(earlyErrorIDs.map((id) => `#${id}`).join(", ")).each((_, el) => {
    const children = $(el).children().get();
    assert(children[0]!.tagName === "h1");
    children.shift();
    const grammars = children
      .entries()
      .filter(([, e]) => e.tagName === "emu-grammar")
      .map(([index]) => index)
      .toArray();
    for (const [i, grammar] of grammars.entries()) {
      const grammarText = $(children[grammar]).text().trim();
      const items = grammarText.split("\n\n").flatMap((t) => {
        const line = t.split(/::?/);
        assert(line.length === 2, t);
        return line[1]!
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .flatMap((rhs) => ({ lhs: line[0]!.trim(), rhs }));
      });
      const content = children
        .slice(grammar + 1, grammars[i + 1])
        .flatMap((e) => {
          if (e.tagName === "ul")
            return e.children.map((c) => $(c).text().trim()).filter(Boolean);
          if (e.tagName === "emu-note") return `Note: ${$(e).text().trim()}`;
          return $(e).text().trim();
        });
      items.forEach(({ lhs, rhs }) => {
        earlyErrors[lhs] ??= {};
        earlyErrors[lhs]![rhs] ??= [];
        earlyErrors[lhs]![rhs]!.push(...content);
      });
    }
  });
  return earlyErrors;
}
