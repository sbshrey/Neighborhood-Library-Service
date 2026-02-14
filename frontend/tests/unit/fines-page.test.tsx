// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const finesMocks = vi.hoisted(() => ({
  queryFinePayments: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  queryFinePayments: finesMocks.queryFinePayments,
}));

vi.mock("../../components/ToastProvider", () => ({
  useToast: () => ({ showToast: finesMocks.showToast }),
}));

import FinesLedgerPage from "../../app/fines/page";

const ledgerRows = [
  {
    id: 1,
    loan_id: 10,
    user_id: 5,
    amount: 15,
    payment_mode: "upi",
    reference: "UPI-REF-1",
    notes: null,
    collected_at: "2026-02-14T10:00:00Z",
    created_at: "2026-02-14T10:00:00Z",
    book_id: 7,
    book_title: "Gitanjali",
    book_author: "Rabindranath Tagore",
    book_isbn: "9789355203465",
    user_name: "Aditya Rao",
    user_email: "aditya@library.dev",
    user_phone: "9999999999",
  },
  {
    id: 2,
    loan_id: 11,
    user_id: 6,
    amount: 20,
    payment_mode: "cash",
    reference: "CASH-1",
    notes: null,
    collected_at: "2026-02-14T11:00:00Z",
    created_at: "2026-02-14T11:00:00Z",
    book_id: 8,
    book_title: "Malgudi Days",
    book_author: "R. K. Narayan",
    book_isbn: "9788185986016",
    user_name: "Nisha Iyer",
    user_email: "nisha@library.dev",
    user_phone: "8888888888",
  },
];

describe("FinesLedgerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finesMocks.queryFinePayments.mockResolvedValue(ledgerRows);
  });

  test("renders fine ledger rows and aggregates", async () => {
    render(<FinesLedgerPage />);

    await waitFor(() => expect(finesMocks.queryFinePayments).toHaveBeenCalled());
    expect(await screen.findByText("Fines Ledger")).toBeTruthy();
    expect(screen.getByText("Gitanjali")).toBeTruthy();
    expect(screen.getByText("Malgudi Days")).toBeTruthy();
    expect(screen.getByText("₹35.00")).toBeTruthy();
  });

  test("passes search text to API query", async () => {
    const user = userEvent.setup();
    render(<FinesLedgerPage />);

    await user.type(
      screen.getByPlaceholderText("Payment ID, loan, user name/email/phone, title, ISBN, reference"),
      "aditya"
    );

    await waitFor(() => {
      const lastCall = finesMocks.queryFinePayments.mock.calls.at(-1)?.[0];
      expect(lastCall).toEqual(expect.objectContaining({ q: "aditya" }));
    });
  });

  test("shows toast on API error", async () => {
    finesMocks.queryFinePayments.mockRejectedValueOnce(new Error("ledger down"));
    render(<FinesLedgerPage />);

    await waitFor(() =>
      expect(finesMocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Unable to load fines ledger",
        })
      )
    );
  });

  test("refresh button emits success toast", async () => {
    const user = userEvent.setup();
    render(<FinesLedgerPage />);

    await waitFor(() => expect(finesMocks.queryFinePayments).toHaveBeenCalled());
    await user.click(screen.getByText("Refresh"));
    await waitFor(() =>
      expect(finesMocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "Fines ledger refreshed",
        })
      )
    );
  });

  test("renders empty-state when no ledger rows returned", async () => {
    finesMocks.queryFinePayments.mockResolvedValueOnce([]);
    render(<FinesLedgerPage />);

    await waitFor(() =>
      expect(screen.getByText("No fine payment records found.")).toBeTruthy()
    );
  });

  test("next/previous pagination drives skip correctly", async () => {
    const user = userEvent.setup();
    const pageOneRows = Array.from({ length: 20 }, (_, i) => ({
      ...ledgerRows[0],
      id: i + 1,
      loan_id: 100 + i,
    }));
    finesMocks.queryFinePayments.mockImplementation(async (params?: { skip?: number }) => {
      if ((params?.skip || 0) === 0) return pageOneRows;
      return [];
    });

    render(<FinesLedgerPage />);

    await waitFor(() => expect(screen.getByText("Next")).toBeTruthy());
    await user.click(screen.getByText("Next"));
    await waitFor(() => {
      const lastCall = finesMocks.queryFinePayments.mock.calls.at(-1)?.[0];
      expect(lastCall).toEqual(expect.objectContaining({ skip: 20 }));
    });

    await user.click(screen.getByText("Previous"));
    await waitFor(() => {
      const lastCall = finesMocks.queryFinePayments.mock.calls.at(-1)?.[0];
      expect(lastCall).toEqual(expect.objectContaining({ skip: 0 }));
    });
  });
});
