import { describe, expect, it } from "vitest";
import { parseVisitMemory, rememberVisit, serializeVisitMemory, VISIT_MEMORY_MAX } from "@/lib/queue/visit-memory";

describe("visit memory (#8/#9)", () => {
  it("migrates the old single booking object and keeps several refs", () => {
    expect(parseVisitMemory(JSON.stringify({ name: "Asha", phone: "9876500101", ref: "ref-a" }))).toEqual([
      { name: "Asha", phone: "9876500101", ref: "ref-a" },
    ]);
    const first = rememberVisit([], { name: "Asha", phone: "9876500101", ref: "ref-a" });
    const both = rememberVisit(first, { name: "Bea", phone: "9876500102", ref: "ref-b" });
    expect(both.map((row) => row.ref)).toEqual(["ref-b", "ref-a"]);
    const replaced = rememberVisit(both, { name: "Asha2", phone: "9876500101", ref: "ref-c" });
    expect(replaced.map((row) => row.ref)).toEqual(["ref-c", "ref-b"]);
    expect(parseVisitMemory(serializeVisitMemory(both))).toEqual(both);
  });

  it("caps stored visits", () => {
    let rows = [] as ReturnType<typeof rememberVisit>;
    for (let i = 0; i < VISIT_MEMORY_MAX + 3; i += 1) {
      rows = rememberVisit(rows, { name: `G${i}`, phone: `9876501${String(i).padStart(3, "0")}`, ref: `ref-${i}` });
    }
    expect(rows).toHaveLength(VISIT_MEMORY_MAX);
    expect(rows[0].ref).toBe(`ref-${VISIT_MEMORY_MAX + 2}`);
  });
});
