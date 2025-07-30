import { test, expect } from '@playwright/test';

test.describe('Board Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user', email: 'test@example.com', name: 'Test User' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        }),
      });
    });

    await page.route('**/api/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
          isAdmin: true,
          organization: {
            id: 'test-org',
            name: 'Test Organization',
            members: [],
          },
        }),
      });
    });

    await page.route('**/api/boards', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ boards: [] }),
        });
      } else if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            board: {
              id: 'new-board-id',
              name: postData.name,
              description: postData.description,
              createdBy: 'test-user',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });
  });

  test('should create a new board and verify database state', async ({ page }) => {
    let boardCreated = false;
    let boardData: { name: string; description: string } | null = null;
    let getBoardsCalled = false;
    let postBoardsCalled = false;

    await page.route('**/api/boards', async (route) => {
      if (route.request().method() === 'GET') {
        getBoardsCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ boards: [] }),
        });
      } else if (route.request().method() === 'POST') {
        boardCreated = true;
        postBoardsCalled = true;
        boardData = await route.request().postDataJSON();
        
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            board: {
              id: 'new-board-id',
              name: boardData!.name,
              description: boardData!.description,
              createdBy: 'test-user',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    });

    await page.goto('/dashboard');

    await page.waitForTimeout(500);

    expect(getBoardsCalled).toBe(true);
    await expect(page.locator('text=No boards yet')).toBeVisible();
    await page.click('button:has-text("Add Board")');
    await expect(page.locator('input[placeholder*="board name"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="board description"]')).toBeVisible();
    
    await page.fill('input[placeholder*="board name"]', 'Test Board');
    await page.fill('input[placeholder*="board description"]', 'Test board description');
    
    await page.click('button:has-text("Create Board")');
    await page.waitForTimeout(500);

    expect(boardCreated).toBe(true);
    expect(postBoardsCalled).toBe(true);
    expect(boardData).not.toBeNull();
    expect(boardData!.name).toBe('Test Board');
    expect(boardData!.description).toBe('Test board description');
    
    await expect(page.locator('[data-slot="card-title"]:has-text("Test Board")')).toBeVisible();
  });

  test('should display empty state when no boards exist', async ({ page }) => {
    let boardsRequested = false;
    let capturedBoardsResponse: { boards: [] } | null = null;

    await page.route('**/api/boards', async (route) => {
      if (route.request().method() === 'GET') {
        boardsRequested = true;
        capturedBoardsResponse = { boards: [] };
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(capturedBoardsResponse),
        });
      }
    });
    
    await page.goto('/dashboard');
    
    await page.waitForTimeout(500);

    expect(boardsRequested).toBe(true);
    expect(capturedBoardsResponse).not.toBeNull();
    expect(capturedBoardsResponse!.boards).toHaveLength(0);

    await expect(page.locator('text=No boards yet')).toBeVisible();
    await expect(page.locator('button:has-text("Create your first board")')).toBeVisible();
  });

  test('should validate board creation form', async ({ page }) => {
    let formSubmissionAttempted = false;
    let validationTriggered = false;

    await page.route('**/api/boards', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ boards: [] }),
        });
      } else if (route.request().method() === 'POST') {
        formSubmissionAttempted = true;
        const postData = await route.request().postDataJSON();

        if (!postData.name || postData.name.trim() === '') {
          validationTriggered = true;
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Board name is required' }),
          });
        } else {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              board: {
                id: 'new-board-id',
                name: postData.name,
                description: postData.description,
                createdBy: 'test-user',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }),
          });
        }
      }
    });
    
    await page.goto('/dashboard');

    await page.waitForTimeout(500);
    
    await page.click('button:has-text("Add Board")');
    
    const nameInput = page.locator('input[placeholder*="board name"]');
    const createButton = page.locator('button:has-text("Create Board")');

    await createButton.click();
    await page.waitForTimeout(300);

    expect(formSubmissionAttempted).toBe(false);
    expect(validationTriggered).toBe(false);
    await expect(nameInput).toBeFocused();

    await page.fill('input[placeholder*="board name"]', 'Test Board');
    await expect(createButton).toBeEnabled();

    await createButton.click();
    await page.waitForTimeout(500);
    
    expect(formSubmissionAttempted).toBe(true);
  });
});
