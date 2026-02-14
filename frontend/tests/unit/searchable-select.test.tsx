// @vitest-environment happy-dom

import { useState } from "react";
import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SearchableSelect from "../../components/SearchableSelect";

const options = [
  { value: "1", label: "Clean Code", keywords: "martin" },
  { value: "2", label: "Refactoring", keywords: "fowler" },
  { value: "3", label: "DDD", keywords: "evans" },
];

function SingleSelectHarness() {
  const [value, setValue] = useState("");
  return (
    <div>
      <SearchableSelect label="Book" value={value} onChange={setValue} options={options} />
      <output data-testid="single-value">{value}</output>
    </div>
  );
}

function MultiSelectHarness() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <div>
      <SearchableSelect
        label="Books"
        value={value}
        onChange={setValue}
        options={options}
        multiple
      />
      <output data-testid="multi-value">{value.join(",")}</output>
    </div>
  );
}

describe("SearchableSelect", () => {
  test("single-select searches and picks option", async () => {
    const user = userEvent.setup();
    render(<SingleSelectHarness />);

    const input = screen.getByPlaceholderText("Search and select...");
    await user.type(input, "clean");
    await user.click(screen.getByRole("button", { name: "Clean Code" }));

    expect(screen.getByTestId("single-value").textContent).toBe("1");
    expect((input as HTMLInputElement).value).toBe("Clean Code");
  });

  test("multi-select toggles values and supports clear", async () => {
    const user = userEvent.setup();
    render(<MultiSelectHarness />);

    const input = screen.getByPlaceholderText("Search and select...");
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Clean Code" }));
    await user.click(screen.getByRole("button", { name: "Refactoring" }));

    expect(screen.getByTestId("multi-value").textContent).toBe("1,2");
    const chipButtons = screen
      .getAllByRole("button")
      .filter((element) => element.className.includes("combo-chip"));
    expect(chipButtons).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByTestId("multi-value").textContent).toBe("");
  });
});
