// @vitest-environment happy-dom

import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ActionModal from "../../components/ActionModal";

describe("ActionModal", () => {
  test("does not render when closed", () => {
    render(
      <ActionModal open={false} title="Loan Modal" onClose={vi.fn()}>
        <div>Body</div>
      </ActionModal>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("supports overlay click, inner click, and escape close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ActionModal open title="Loan Modal" subtitle="Issue loan" onClose={onClose}>
        <button type="button">Inside Action</button>
      </ActionModal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Inside Action" }));
    expect(onClose).toHaveBeenCalledTimes(0);

    await user.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

