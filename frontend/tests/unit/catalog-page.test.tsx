// @vitest-environment happy-dom

import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const catalogMocks = vi.hoisted(() => ({
  getBooks: vi.fn(),
  queryBooks: vi.fn(),
  createBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../lib/api", () => ({
  getBooks: catalogMocks.getBooks,
  queryBooks: catalogMocks.queryBooks,
  createBook: catalogMocks.createBook,
  updateBook: catalogMocks.updateBook,
  deleteBook: catalogMocks.deleteBook,
}));

vi.mock("../../components/ToastProvider", () => ({
  useToast: () => ({ showToast: catalogMocks.showToast }),
}));

import CatalogPage from "../../app/catalog/page";

describe("CatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    catalogMocks.getBooks.mockResolvedValue([
      {
        id: 1,
        title: "Clean Code",
        author: "Robert C. Martin",
        subject: "Programming",
        rack_number: "A-1",
        isbn: "9780132350884",
        copies_total: 3,
        copies_available: 2,
      },
      {
        id: 2,
        title: "Refactoring",
        author: "Martin Fowler",
        subject: "Programming",
        rack_number: "A-2",
        isbn: "9780201485677",
        copies_total: 2,
        copies_available: 1,
      },
    ]);
    catalogMocks.queryBooks.mockResolvedValue([
      {
        id: 1,
        title: "Clean Code",
        author: "Robert C. Martin",
        subject: "Programming",
        rack_number: "A-1",
        isbn: "9780132350884",
        copies_total: 3,
        copies_available: 2,
      },
    ]);
    catalogMocks.createBook.mockResolvedValue({ id: 11 });
    catalogMocks.updateBook.mockResolvedValue({ id: 1 });
    catalogMocks.deleteBook.mockResolvedValue(undefined);
  });

  test("loads rows and summary stats", async () => {
    render(<CatalogPage />);

    await waitFor(() => expect(catalogMocks.queryBooks).toHaveBeenCalled());
    expect(await screen.findByText("Catalog & Inventory")).toBeTruthy();
    expect(screen.getByText("Clean Code")).toBeTruthy();
    expect(screen.getByText("Total Titles")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
  });

  test("validates published year client-side before create", async () => {
    const user = userEvent.setup();
    render(<CatalogPage />);

    await user.click(screen.getByTestId("book-open-create"));
    await user.type(screen.getByTestId("book-title"), "ABC");
    await user.type(screen.getByTestId("book-author"), "XYZ");
    fireEvent.change(screen.getByTestId("book-year"), { target: { value: "2201" } });
    fireEvent.submit(screen.getByTestId("book-form"));

    expect(catalogMocks.createBook).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(catalogMocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Invalid published year",
        })
      )
    );
  });

  test("creates new book and refreshes page data", async () => {
    const user = userEvent.setup();
    render(<CatalogPage />);

    await user.click(screen.getByTestId("book-open-create"));
    await user.type(screen.getByTestId("book-title"), "Domain-Driven Design");
    await user.type(screen.getByTestId("book-author"), "Eric Evans");
    await user.clear(screen.getByTestId("book-copies"));
    await user.type(screen.getByTestId("book-copies"), "4");
    await user.click(screen.getByTestId("book-submit"));

    await waitFor(() => expect(catalogMocks.createBook).toHaveBeenCalledTimes(1));
    expect(catalogMocks.createBook).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Domain-Driven Design",
        author: "Eric Evans",
        copies_total: 4,
      })
    );
    expect(catalogMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Book created successfully",
      })
    );
  });

  test("validates copies before create", async () => {
    const user = userEvent.setup();
    render(<CatalogPage />);

    await user.click(screen.getByTestId("book-open-create"));
    await user.type(screen.getByTestId("book-title"), "New Book");
    await user.type(screen.getByTestId("book-author"), "Author");
    fireEvent.change(screen.getByTestId("book-copies"), { target: { value: "0" } });
    fireEvent.submit(screen.getByTestId("book-form"));

    expect(catalogMocks.createBook).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(catalogMocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Total copies must be 1 or higher",
        })
      )
    );
  });

  test("edits existing book", async () => {
    const user = userEvent.setup();
    render(<CatalogPage />);

    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    await user.click(screen.getByText("Edit"));
    await user.clear(screen.getByTestId("book-title"));
    await user.type(screen.getByTestId("book-title"), "Clean Code 2");
    await user.clear(screen.getByTestId("book-subject"));
    await user.type(screen.getByTestId("book-subject"), " Software ");
    await user.clear(screen.getByTestId("book-rack-number"));
    await user.type(screen.getByTestId("book-rack-number"), " A-10 ");
    await user.click(screen.getByTestId("book-submit"));

    await waitFor(() => expect(catalogMocks.updateBook).toHaveBeenCalled());
    expect(catalogMocks.updateBook).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        title: "Clean Code 2",
        subject: "Software",
        rack_number: "A-10",
      })
    );
    expect(catalogMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Book updated successfully",
      })
    );
  });

  test("deletes book when confirm is accepted", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.fn(() => true);
    (window as any).confirm = confirmSpy;
    render(<CatalogPage />);

    await waitFor(() => expect(screen.getByText("Delete")).toBeTruthy());
    await user.click(screen.getByText("Delete"));

    await waitFor(() => expect(catalogMocks.deleteBook).toHaveBeenCalledWith(1));
    expect(catalogMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Book deleted successfully",
      })
    );
  });

  test("does not delete book when confirm is rejected", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.fn(() => false);
    (window as any).confirm = confirmSpy;
    render(<CatalogPage />);

    await waitFor(() => expect(screen.getByText("Delete")).toBeTruthy());
    await user.click(screen.getByText("Delete"));
    expect(catalogMocks.deleteBook).not.toHaveBeenCalled();
  });

  test("refresh button shows success toast and no-row state renders", async () => {
    const user = userEvent.setup();
    catalogMocks.queryBooks.mockResolvedValue([]);
    render(<CatalogPage />);

    await waitFor(() =>
      expect(screen.getByText("No books match the active filters and search input.")).toBeTruthy()
    );
    await user.click(screen.getByText("Refresh"));
    await waitFor(() =>
      expect(catalogMocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "Catalog refreshed",
        })
      )
    );
  });

  test("handles load-page API error", async () => {
    catalogMocks.queryBooks.mockRejectedValueOnce(new Error("db down"));
    render(<CatalogPage />);

    await waitFor(() =>
      expect(catalogMocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Unable to load books",
          description: "db down",
        })
      )
    );
  });
});
