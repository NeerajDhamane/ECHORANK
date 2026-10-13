import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";

describe("CSV export safety", () => {
  it("neutralizes spreadsheet formulas and quotes CSV separators", () => {
    expect(escapeCsvCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(escapeCsvCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(escapeCsvCell("-2")).toBe("'-2");
    expect(escapeCsvCell("@name")).toBe("'@name");
    expect(toCsv([["name", "value"], ["A, B", "line\nnext"]])).toBe('name,value\r\n"A, B","line\nnext"');
  });
});
