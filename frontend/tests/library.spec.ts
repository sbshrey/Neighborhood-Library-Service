import { test, expect } from '@playwright/test';

const ADMIN_NAME = 'E2E Admin';
const ADMIN_EMAIL = 'admin-e2e@example.test';
const ADMIN_PASSWORD = 'e2e-only-not-secret';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(ADMIN_EMAIL);
  await page.getByTestId('login-password').fill(ADMIN_PASSWORD);
  await page.getByTestId('login-submit').click();
  try {
    await expect(page).toHaveURL('/', { timeout: 3000 });
  } catch {
    await page.getByTestId('login-name').fill(ADMIN_NAME);
    await page.getByRole('button', { name: 'Bootstrap Admin (First Run)' }).click();
    await expect(page).toHaveURL('/');
  }
}

test.describe('Neighborhood Library UI', () => {
  test('create book, create user, borrow and return', async ({ page }) => {
    await login(page);
    await page.goto('/catalog');

    await page.getByTestId('book-title').fill('Test Driven Development');
    await page.getByTestId('book-author').fill('Kent Beck');
    await page.getByTestId('book-isbn').fill('9780321146533');
    await page.getByTestId('book-year').fill('2002');
    await page.getByTestId('book-copies').fill('1');
    await page.getByTestId('book-submit').click();

    const bookRow = page.getByTestId('book-row').filter({ hasText: 'Test Driven Development' });
    await expect(bookRow).toHaveCount(1);
    const bookId = await bookRow.getAttribute('data-book-id');
    expect(bookId).not.toBeNull();

    await page.goto('/users');
    await page.getByTestId('user-name').fill('Grace Hopper');
    await page.getByTestId('user-email').fill('grace@example.com');
    await page.getByTestId('user-phone').fill('555-0101');
    await page.getByTestId('user-role').selectOption('staff');
    await page.getByTestId('user-submit').click();

    const userRow = page.getByTestId('user-row').filter({ hasText: 'Grace Hopper' });
    await expect(userRow).toHaveCount(1);
    const userId = await userRow.getAttribute('data-user-id');
    expect(userId).not.toBeNull();

    await page.goto('/loans');
    await page.getByTestId('borrow-book-id').selectOption(bookId!);
    await page.getByTestId('borrow-user-id').selectOption(userId!);
    await page.getByTestId('borrow-days').fill('7');
    await page.getByTestId('borrow-submit').click();

    const loanRow = page.getByTestId('loan-row').filter({ hasText: `Book ${bookId}` });
    await expect(loanRow).toHaveCount(1);
    const loanId = await loanRow.getAttribute('data-loan-id');
    expect(loanId).not.toBeNull();

    await page.getByTestId('return-loan-id').selectOption(loanId!);
    await page.getByTestId('return-submit').click();

    await expect(loanRow).toContainText('Returned');
  });

  test('shows error when borrowing unavailable book', async ({ page }) => {
    await login(page);
    await page.goto('/catalog');

    await page.getByTestId('book-title').fill('Clean Code');
    await page.getByTestId('book-author').fill('Robert C. Martin');
    await page.getByTestId('book-copies').fill('1');
    await page.getByTestId('book-submit').click();

    const bookRow = page.getByTestId('book-row').filter({ hasText: 'Clean Code' });
    await expect(bookRow).toHaveCount(1);
    const bookId = await bookRow.getAttribute('data-book-id');

    await page.goto('/users');
    await page.getByTestId('user-name').fill('Ada Lovelace');
    await page.getByTestId('user-submit').click();
    const userRow = page.getByTestId('user-row').filter({ hasText: 'Ada Lovelace' });
    await expect(userRow).toHaveCount(1);
    const userId = await userRow.getAttribute('data-user-id');

    await page.goto('/loans');
    await page.getByTestId('borrow-book-id').selectOption(bookId!);
    await page.getByTestId('borrow-user-id').selectOption(userId!);
    await page.getByTestId('borrow-submit').click();

    await page.getByTestId('borrow-book-id').selectOption(bookId!);
    await page.getByTestId('borrow-user-id').selectOption(userId!);
    await page.getByTestId('borrow-submit').click();

    const errorToast = page.getByTestId('toast-error').last();
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('Book is not currently available');
  });
});
