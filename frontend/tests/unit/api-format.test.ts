import { describe, expect, test } from "vitest";

import { formatApiErrorDetail } from "../../lib/api";

describe("formatApiErrorDetail", () => {
  test("returns string detail directly", () => {
    expect(formatApiErrorDetail("Book not found")).toBe("Book not found");
  });

  test("formats pydantic-style detail array", () => {
    const detail = [
      { loc: ["body", "isbn"], msg: "String should have at most 32 characters" },
      { loc: ["body", "published_year"], msg: "Input should be less than or equal to 2100" },
    ];

    expect(formatApiErrorDetail(detail)).toBe(
      "isbn: String should have at most 32 characters | published_year: Input should be less than or equal to 2100"
    );
  });

  test("limits output to first 3 messages and appends suffix", () => {
    const detail = [
      { loc: ["body", "a"], msg: "err-a" },
      { loc: ["body", "b"], msg: "err-b" },
      { loc: ["body", "c"], msg: "err-c" },
      { loc: ["body", "d"], msg: "err-d" },
    ];

    expect(formatApiErrorDetail(detail)).toBe("a: err-a | b: err-b | c: err-c (and more)");
  });

  test("returns undefined for unsupported detail", () => {
    expect(formatApiErrorDetail({ foo: "bar" })).toBeUndefined();
    expect(formatApiErrorDetail(null)).toBeUndefined();
  });
});
