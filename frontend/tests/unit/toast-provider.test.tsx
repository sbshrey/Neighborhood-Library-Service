// @vitest-environment happy-dom

import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ToastProvider, { useToast } from "../../components/ToastProvider";

function ToastHarness() {
  const { showToast } = useToast();
  return (
    <>
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
      <button
        type="button"
        onClick={() =>
          showToast({
            title: "Info title",
          })
        }
      >
        Trigger Default Toast
      </button>
    </>
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

  test("defaults to info type and auto-dismisses", async () => {
    const user = userEvent.setup();
    const timeoutSpy = vi.spyOn(window, "setTimeout");

    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Trigger Default Toast" }));
    expect(screen.getByTestId("toast-info")).toBeTruthy();
    expect(screen.queryByText("Book created")).toBeNull();
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 4500);

    const matchingCall = timeoutSpy.mock.calls.find((call) => call[1] === 4500);
    const dismissCallback = matchingCall?.[0] as (() => void) | undefined;
    expect(typeof dismissCallback).toBe("function");
    dismissCallback?.();
    await waitFor(() => expect(screen.queryByText("Info title")).toBeNull());
  });

  test("throws when useToast is used outside provider", () => {
    function BadHarness() {
      useToast();
      return null;
    }
    expect(() => render(<BadHarness />)).toThrow("useToast must be used within ToastProvider");
  });
});
