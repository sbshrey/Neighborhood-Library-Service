// @vitest-environment happy-dom

import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ToastProvider, { useToast } from "../../components/ToastProvider";

function ToastHarness() {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        showToast({
          type: "success",
          title: "Saved",
          description: "Book created",
          durationMs: 5000,
        })
      }
    >
      Trigger Toast
    </button>
  );
}

describe("ToastProvider", () => {
  test("renders and dismisses toast", async () => {
    const user = userEvent.setup();
    const timeoutSpy = vi.spyOn(window, "setTimeout");

    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Trigger Toast" }));
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText("Book created")).toBeTruthy();
    expect(timeoutSpy).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close toast" }));
    expect(screen.queryByText("Saved")).toBeNull();
  });
});
