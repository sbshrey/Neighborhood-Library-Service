// @vitest-environment happy-dom

import { useState } from "react";
import { describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

function SingleWithInitialHarness() {
  const [value, setValue] = useState("2");
  return (
    <div>
      <SearchableSelect label="Book" value={value} onChange={setValue} options={options} />
      <output data-testid="single-value-initial">{value}</output>
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

  test("single-select keyboard controls and outside click reset", async () => {
    const user = userEvent.setup();
    render(<SingleWithInitialHarness />);

    const input = screen.getByPlaceholderText("Search and select...");
    expect((input as HTMLInputElement).value).toBe("Refactoring");

    await user.type(input, " clean");
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("Refactoring");

    await user.click(input);
    await user.clear(input);
    await user.type(input, "ddd");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("single-value-initial").textContent).toBe("3");

    await user.clear(input);
    await user.type(input, "xyz-no-match");
    expect(screen.getByText("No matches found.")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect((input as HTMLInputElement).value).toBe("");
  });

  test("multi-select chip removal and escape behavior", async () => {
    const user = userEvent.setup();
    render(<MultiSelectHarness />);

    const input = screen.getByPlaceholderText("Search and select...");
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Clean Code" }));
    await user.click(screen.getByRole("button", { name: "Refactoring" }));

    const chipButtons = screen
      .getAllByRole("button")
      .filter((element) => element.className.includes("combo-chip"));
    await user.click(chipButtons[0]);
    expect(screen.getByTestId("multi-value").textContent).toBe("2");

    await user.type(input, "ddd");
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("ddd");
  });
});
