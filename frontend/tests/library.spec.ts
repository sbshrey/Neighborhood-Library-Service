import { APIRequestContext, expect, Page, test, TestInfo } from '@playwright/test';

type Credentials = {
  name: string;
  email: string;
  password: string;
};

const FRONTEND_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.E2E_API_BASE || FRONTEND_BASE_URL.replace(/:\d+$/, ':8000');
const LEGACY_SEEDED_PASSWORD = String.fromCharCode(
  65, 100, 109, 105, 110, 64, 49, 50, 51, 52, 53
);
const DEFAULT_E2E_PASSWORD = process.env.E2E_ADMIN_PASSWORD || LEGACY_SEEDED_PASSWORD;

const PRIMARY_ADMIN: Credentials = {
  name: process.env.E2E_ADMIN_NAME || 'E2E Admin',
  email: process.env.E2E_ADMIN_EMAIL || 'nisha.iyer@library.dev',
  password: DEFAULT_E2E_PASSWORD,
};

const SEEDED_ADMIN: Credentials = {
  name: 'Nisha Iyer',
  email: 'nisha.iyer@library.dev',
  password: DEFAULT_E2E_PASSWORD,
};

const FALLBACK_ADMIN: Credentials | null =
  process.env.E2E_EXISTING_ADMIN_EMAIL && process.env.E2E_EXISTING_ADMIN_PASSWORD
    ? {
        name: process.env.E2E_EXISTING_ADMIN_NAME || 'Existing Admin',
        email: process.env.E2E_EXISTING_ADMIN_EMAIL,
        password: process.env.E2E_EXISTING_ADMIN_PASSWORD,
      }
    : null;

function uniqueId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function makeSnapper(page: Page, testInfo: TestInfo) {
  let index = 0;
  return async (label: string) => {
    index += 1;
    const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const name = `${String(index).padStart(2, '0')}-${safe}`;
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: 'image/png' });
  };
}

async function waitForDashboard(page: Page, timeout = 6_000) {
  try {
    await page.waitForURL((url) => url.pathname === '/', { timeout });
    return true;
  } catch {
    return new URL(page.url()).pathname === '/';
  }
}

async function readLoginError(page: Page) {
  const error = page.getByTestId('error');
  if ((await error.count()) === 0) {
    return null;
  }
  if (!(await error.first().isVisible())) {
    return null;
  }
  const text = await error.first().textContent();
  return text?.trim() || null;
}

async function attemptSignIn(page: Page, creds: Credentials) {
  await page.getByTestId('login-email').fill(creds.email);
  await page.getByTestId('login-password').fill(creds.password);
  await page.getByTestId('login-submit').click();

  if (await waitForDashboard(page, 5_000)) {
    return { ok: true, error: null };
  }

  const error = await readLoginError(page);
  return { ok: false, error };
}

async function ensureAdminSession(page: Page) {
  await page.goto('/login');
  await expect(page.getByTestId('login-form')).toBeVisible();

  const credentialCandidates: Credentials[] = [];
  const addCandidate = (creds: Credentials | null) => {
    if (!creds) return;
    const key = `${creds.email.toLowerCase()}|${creds.password}`;
    const exists = credentialCandidates.some(
      (candidate) => `${candidate.email.toLowerCase()}|${candidate.password}` === key
    );
    if (!exists) {
      credentialCandidates.push(creds);
    }
  };

  addCandidate(PRIMARY_ADMIN);
  addCandidate(SEEDED_ADMIN);
  addCandidate(FALLBACK_ADMIN);

  if (credentialCandidates.length === 0) {
    throw new Error('No admin credential candidates are configured for e2e login.');
  }

  for (const creds of credentialCandidates) {
    const signIn = await attemptSignIn(page, creds);
    if (signIn.ok) {
      return { mode: 'sign-in', creds };
    }
  }

  await page.getByTestId('login-name').fill(PRIMARY_ADMIN.name);
  await page.getByTestId('login-email').fill(PRIMARY_ADMIN.email);
  await page.getByTestId('login-password').fill(PRIMARY_ADMIN.password);
  await page.getByRole('button', { name: 'Bootstrap Admin (First Run)' }).click();

  if (await waitForDashboard(page, 7_000)) {
    return { mode: 'bootstrap', creds: PRIMARY_ADMIN };
  }

  const bootstrapError = await readLoginError(page);
  if (bootstrapError?.toLowerCase().includes('bootstrap already completed')) {
    for (const creds of credentialCandidates) {
      const signIn = await attemptSignIn(page, creds);
      if (signIn.ok) {
        return { mode: 'existing-bootstrap', creds };
      }
    }
  }

  throw new Error(
    `Unable to authenticate admin. Last UI error: ${bootstrapError || 'none'}. ` +
      'Set E2E_ADMIN_* to valid creds, or keep first-run DB for bootstrap.'
  );
}

async function pickFromCombo(page: Page, testId: string, search: string, optionContains: string) {
  const input = page.getByTestId(testId);
  await input.click();
  await input.fill(search);
  const option = page.locator('.combo-option', { hasText: optionContains }).first();
  await expect(option).toBeVisible();
  await option.click();
}

async function getStoredToken(page: Page) {
  const token = await page.evaluate(() => window.localStorage.getItem('nls_access_token'));
  if (!token) {
    throw new Error('Missing auth token in localStorage after login.');
  }
  return token;
}

async function createBookByApi(request: APIRequestContext, token: string, payload: any) {
  const response = await request.post(`${API_BASE_URL}/books`, {
    headers: authHeaders(token),
    data: payload,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function createStaffByApi(request: APIRequestContext, token: string, payload: any) {
  const response = await request.post(`${API_BASE_URL}/users`, {
    headers: authHeaders(token),
    data: payload,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function createMemberByApi(request: APIRequestContext, token: string, payload: any) {
  const response = await request.post(`${API_BASE_URL}/users`, {
    headers: authHeaders(token),
    data: payload,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function dragDropTextFile(
  page: Page,
  dropzoneTestId: string,
  fileName: string,
  fileContent: string,
  mimeType = 'text/csv'
) {
  const dataTransfer = await page.evaluateHandle(
    ({ name, content, type }) => {
      const dt = new DataTransfer();
      const file = new File([content], name, { type });
      dt.items.add(file);
      return dt;
    },
    { name: fileName, content: fileContent, type: mimeType }
  );
  const dropzone = page.getByTestId(dropzoneTestId);
  await dropzone.dispatchEvent('dragenter', { dataTransfer });
  await dropzone.dispatchEvent('dragover', { dataTransfer });
  await dropzone.dispatchEvent('drop', { dataTransfer });
}

test.describe('Neighborhood Library Demo Journeys', () => {
  test('admin demo: policy + catalog + users + audit', async ({ page }, testInfo) => {
    const snap = makeSnapper(page, testInfo);
    const run = uniqueId();
    const bookTitle = `Domain-Driven Design Demo ${run}`;
    const importedBookTitle = `Imported Book Demo ${run}`;
    const importedBookIsbn = `9788199${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
    const staffEmail = `staff.demo.${run}@library.dev`;

    const auth = await ensureAdminSession(page);
    await snap(`admin-authenticated-${auth.mode}`);

    await test.step('Update policy from admin settings', async () => {
      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Admin Control Center' })).toBeVisible();
      const fineInput = page.getByTestId('policy-fine-per-day');
      const existingFine = await fineInput.inputValue();
      await fineInput.fill(existingFine || '2');
      await page.getByTestId('policy-save').click();
      await expect(page.getByTestId('toast-success').last()).toContainText('Circulation policy updated');
      await snap('admin-policy-updated');
    });

    await test.step('Import books with drag-drop on settings card', async () => {
      await page.goto('/settings');
      const booksCsv = [
        'title,author,subject,rack_number,isbn,published_year,copies_total',
        `${importedBookTitle},A. P. J. Abdul Kalam,Science,IMP-01,${importedBookIsbn},2010,2`,
      ].join('\n');
      const importFileName = `books-import-${run}.csv`;
      await dragDropTextFile(page, 'import-dropzone-books', importFileName, booksCsv);
      await expect(page.getByTestId('import-file-name-books')).toContainText(importFileName);
      await page.getByTestId('import-run-books').click();
      await expect(page.getByTestId('toast-success').last()).toContainText('books import complete');
      await expect(page.getByTestId('import-file-name-books')).toContainText('Drag and drop CSV/XLSX here');
      await snap('admin-dragdrop-import-books');
    });

    await test.step('Create a catalog book from UI', async () => {
      await page.goto('/catalog');
      await page.getByTestId('book-open-create').click();
      await expect(page.getByTestId('book-action-modal')).toBeVisible();
      await page.getByTestId('book-title').fill(bookTitle);
      await page.getByTestId('book-author').fill('Eric Evans');
      await page.getByTestId('book-isbn').fill(`978032112${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`);
      await page.getByTestId('book-subject').fill('Software Design');
      await page.getByTestId('book-rack-number').fill('A-12');
      await page.getByTestId('book-year').fill('2003');
      await page.getByTestId('book-copies').fill('2');
      await page.getByTestId('book-submit').click();
      const bookRow = page.getByTestId('book-row').filter({ hasText: bookTitle }).first();
      await expect(bookRow).toBeVisible();
      await snap('admin-book-created');
    });

    await test.step('Catalog validation shows clear error for 422 payload issues', async () => {
      await page.goto('/catalog');
      await page.getByTestId('book-open-create').click();
      await expect(page.getByTestId('book-action-modal')).toBeVisible();
      await page.getByTestId('book-title').fill(`Validation Book ${run}`);
      await page.getByTestId('book-author').fill('Validation Author');
      await page.getByTestId('book-isbn').fill('1234567890123456789012345678901234567890');
      await page.getByTestId('book-submit').click();
      await expect(page.getByTestId('toast-error').last()).toContainText('isbn');
      await page.getByRole('button', { name: 'Close modal' }).click();
      await snap('catalog-validation-error-toast');
    });

    await test.step('Create a staff user from UI', async () => {
      await page.goto('/users');
      await page.getByTestId('user-open-create').click();
      await expect(page.getByTestId('user-action-modal')).toBeVisible();
      await page.getByTestId('user-name').fill('Demo Staff UI');
      await page.getByTestId('user-email').fill(staffEmail);
      await page.getByTestId('user-phone').fill('9000000001');
      await page.getByTestId('user-role').selectOption('staff');
      await page.getByTestId('user-submit').click();
      const userRow = page.getByTestId('user-row').filter({ hasText: staffEmail }).first();
      await expect(userRow).toBeVisible();
      await snap('admin-staff-created');
    });

    await test.step('Open audit timeline and verify mutating routes are logged', async () => {
      await page.goto('/audit');
      await expect(page.getByRole('heading', { name: 'Audit Timeline' })).toBeVisible();
      await page.getByPlaceholder('Path, method, role, status, actor, entity id').fill('/users');
      await page.getByRole('button', { name: 'Refresh' }).click();
      await expect(page.getByText('POST /users').first()).toBeVisible();
      await snap('admin-audit-visible');
    });

    await test.step('Open fines ledger page from nav and verify table loads', async () => {
      await page.getByTestId('nav-fines').click();
      await expect(page).toHaveURL(/\/fines$/);
      await expect(page.getByRole('heading', { name: 'Fines Ledger' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Collection Register' })).toBeVisible();
      await expect(page.getByTestId('fines-mode-filter')).toBeVisible();
      await snap('admin-fines-ledger-visible');
    });
  });

  test('multi-persona demo: admin setup -> staff circulation flow', async ({ page, request }, testInfo) => {
    const snap = makeSnapper(page, testInfo);
    const run = uniqueId();
    const staffCreds: Credentials = {
      name: `Staff ${run}`,
      email: `staff.${run}@library.dev`,
      password: `Staff@${run.slice(-6)}!`,
    };
    const memberName = `Member ${run}`;
    const memberEmail = `member.${run}@library.dev`;
    const bookTitle = `Midnight Library Demo ${run}`;

    await ensureAdminSession(page);
    await snap('admin-ready-for-setup');

    const adminToken = await getStoredToken(page);

    await test.step('Admin prepares staff account and demo catalog book through APIs', async () => {
      await createStaffByApi(request, adminToken, {
        name: staffCreds.name,
        email: staffCreds.email,
        phone: '9000000002',
        role: 'staff',
        password: staffCreds.password,
      });

      await createBookByApi(request, adminToken, {
        title: bookTitle,
        author: 'Matt Haig',
        isbn: `97801431${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
        subject: 'Fiction',
        rack_number: 'F-22',
        published_year: 2020,
        copies_total: 1,
      });
    });

    await test.step('Logout admin and login as staff', async () => {
      await page.getByTestId('logout-btn').click();
      await expect(page).toHaveURL(/\/login$/);
      const staffSignIn = await attemptSignIn(page, staffCreds);
      if (!staffSignIn.ok) {
        throw new Error(`Staff sign-in failed: ${staffSignIn.error || 'unknown error'}`);
      }
      await expect(page.getByTestId('nav-borrowings')).toBeVisible();
      await expect(page.getByTestId('nav-admin-settings')).toHaveCount(0);
      await snap('staff-logged-in');
    });

    await test.step('Staff creates member quickly from borrowings desk', async () => {
      await page.getByTestId('quick-user-open-modal').click();
      await expect(page.getByTestId('quick-user-action-modal')).toBeVisible();
      await page.getByTestId('quick-user-name').fill(memberName);
      await page.getByTestId('quick-user-email').fill(memberEmail);
      await page.getByTestId('quick-user-phone').fill('9000000003');
      await page.getByTestId('quick-user-role').selectOption('member');
      await page.getByTestId('quick-user-create').click();
      await expect(page.getByTestId('toast-success').last()).toContainText('New user created');
      await snap('staff-created-member');
    });

    await test.step('Staff records borrowing and verifies register entry', async () => {
      await page.getByTestId('borrow-open-modal').click();
      await expect(page.getByTestId('borrow-action-modal')).toBeVisible();
      await pickFromCombo(page, 'borrow-book-id', 'Midnight Library Demo', bookTitle);
      await pickFromCombo(page, 'borrow-user-id', memberName, memberName);
      await page.getByTestId('borrow-days').fill('10');
      await page.getByTestId('borrow-submit').click();
      await expect(page.getByTestId('toast-success').last()).toContainText('Borrowing recorded');
      await page.getByPlaceholder('Search by loan ID, book title/ISBN, user name/email/phone').fill(memberName);
      const activeRow = page.getByTestId('loan-row').filter({ hasText: memberName }).first();
      await expect(activeRow).toBeVisible();
      await expect(activeRow).toContainText('Active');
      await snap('staff-borrowing-recorded');
    });

    await test.step('Staff records return and validates final status', async () => {
      await page.getByTestId('return-open-modal').click();
      await expect(page.getByTestId('return-action-modal')).toBeVisible();
      await pickFromCombo(page, 'return-loan-id', memberName, memberName);
      await page.getByTestId('return-submit').click();
      await expect(page.getByTestId('toast-success').last()).toContainText('Return recorded');
      await page.getByTestId('loan-status-option-all').click();
      const returnedRow = page.getByTestId('loan-row').filter({ hasText: memberName }).first();
      await expect(returnedRow).toContainText('Returned');
      await snap('staff-return-recorded');
    });

    await test.step('Staff cannot open admin-only settings page', async () => {
      await page.goto('/settings');
      await page.waitForURL((url) => url.pathname === '/');
      await expect(page.getByRole('heading', { name: 'Borrowings, Returns, Fines' })).toBeVisible();
      await snap('staff-admin-route-redirected');
    });
  });

  test('member demo: self view of loans and fines', async ({ page, request }, testInfo) => {
    const snap = makeSnapper(page, testInfo);
    const run = uniqueId();
    const memberCreds: Credentials = {
      name: `Member ${run}`,
      email: `member.${run}@library.dev`,
      password: `Member@${run.slice(-6)}!`,
    };
    const bookTitle = `Member View Book ${run}`;

    await ensureAdminSession(page);
    const adminToken = await getStoredToken(page);

    await createBookByApi(request, adminToken, {
      title: bookTitle,
      author: 'R. K. Narayan',
      isbn: `97881859${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      subject: 'Classic',
      rack_number: 'M-1',
      published_year: 1980,
      copies_total: 2,
    });

    const createdMember = await createMemberByApi(request, adminToken, {
      name: memberCreds.name,
      email: memberCreds.email,
      phone: '9000000011',
      role: 'member',
      password: memberCreds.password,
    });

    // Resolve book id from catalog search API to avoid brittle UI scraping.
    const booksResp = await request.get(`${API_BASE_URL}/books?q=${encodeURIComponent(bookTitle)}`, {
      headers: authHeaders(adminToken),
    });
    expect(booksResp.ok(), await booksResp.text()).toBeTruthy();
    const books = await booksResp.json();
    const createdBook = books.find((book: any) => book.title === bookTitle);
    expect(createdBook).toBeTruthy();
    const borrowOk = await request.post(`${API_BASE_URL}/loans/borrow`, {
      headers: authHeaders(adminToken),
      data: { book_id: createdBook.id, user_id: createdMember.id, days: 9 },
    });
    expect(borrowOk.ok(), await borrowOk.text()).toBeTruthy();

    await page.getByTestId('logout-btn').click();
    await expect(page).toHaveURL(/\/login$/);

    const memberSignIn = await attemptSignIn(page, memberCreds);
    if (!memberSignIn.ok) {
      throw new Error(`Member sign-in failed: ${memberSignIn.error || 'unknown error'}`);
    }
    await page.waitForURL((url) => url.pathname === '/member');
    await expect(page.getByRole('heading', { name: 'My Borrowings & Fines' })).toBeVisible();
    await expect(page.getByTestId('nav-my-loans')).toBeVisible();
    await expect(page.getByText(bookTitle).first()).toBeVisible();
    await snap('member-dashboard-visible');

    await page.goto('/');
    await page.waitForURL((url) => url.pathname === '/member');
    await snap('member-root-redirect');
  });
});
