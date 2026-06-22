import { describe, it, expect } from "vitest";
import { resultToJson } from "./sql";

describe("sql.js", () => {
  describe("resultToJson", () => {
    it("returns empty array for empty result", () => {
      expect(resultToJson([])).toEqual([]);
    });

    it("converts single row", () => {
      const result = [
        {
          columns: ["id", "name"],
          values: [[1, "Selene"]],
        },
      ];
      expect(resultToJson(result)).toEqual([{ id: 1, name: "Selene" }]);
    });

    it("converts multiple rows", () => {
      const result = [
        {
          columns: ["id", "name"],
          values: [
            [1, "Selene"],
            [2, "Bitcoin"],
          ],
        },
      ];
      expect(resultToJson(result)).toEqual([
        { id: 1, name: "Selene" },
        { id: 2, name: "Bitcoin" },
      ]);
    });

    it("preserves null values", () => {
      const result = [
        {
          columns: ["id", "memo"],
          values: [[1, null]],
        },
      ];
      expect(resultToJson(result)).toEqual([{ id: 1, memo: null }]);
    });

    it("preserves zero and empty string", () => {
      const result = [
        {
          columns: ["amount", "label"],
          values: [[0, ""]],
        },
      ];
      expect(resultToJson(result)).toEqual([{ amount: 0, label: "" }]);
    });

    it("handles many columns", () => {
      const result = [
        {
          columns: ["txid", "amount", "address", "height", "timestamp"],
          values: [["abc123", 50000, "bitcoincash:qr...", 800000, 1700000000]],
        },
      ];
      const json = resultToJson(result);
      expect(json[0].txid).toBe("abc123");
      expect(json[0].amount).toBe(50000);
      expect(json[0].height).toBe(800000);
    });

    it("handles single column", () => {
      const result = [
        {
          columns: ["count"],
          values: [[42]],
        },
      ];
      expect(resultToJson(result)).toEqual([{ count: 42 }]);
    });
  });
});
