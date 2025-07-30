import { test, expect } from '@playwright/test'

test.describe('Note Management with Newlines', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user',
            email: 'test@example.com',
            name: 'Test User',
          }
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
          },
        }),
      });
    });

    await page.route('**/api/boards/test-board', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          board: {
            id: 'test-board',
            name: 'Test Board',
            description: 'A test board',
          },
        }),
      });
    });

    await page.route('**/api/boards', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          boards: [
            {
              id: 'test-board',
              name: 'Test Board',
              description: 'A test board',
            },
          ],
        }),
      });
    });

    await page.route('**/api/boards/test-board/notes', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notes: [],
          }),
        });
      } else if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            note: {
              id: 'new-note-id',
              content: postData.content || '',
              color: '#fef3c7',
              done: false,
              isChecklist: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              user: {
                id: 'test-user',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          }),
        });
      }
    });

    await page.route('**/api/boards/test-board/notes/new-note-id', async (route) => {
      if (route.request().method() === 'PUT') {
        const postData = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            note: {
              id: 'new-note-id',
              content: postData.content || '',
              color: '#fef3c7',
              done: false,
              isChecklist: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              user: {
                id: 'test-user',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          }),
        });
      }
    });
  });

  test('should create a note with multiline content and verify database state', async ({ page }) => {
    let noteCreated = false;
    let noteData: { content: string } | null = null;
    let getNotesRequested = false;
    let postNotesRequested = false;

    await page.route('**/api/boards/test-board/notes', async (route) => {
      if (route.request().method() === 'GET') {
        getNotesRequested = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notes: [] }),
        });
      } else if (route.request().method() === 'POST') {
        noteCreated = true;
        postNotesRequested = true;
        const postData = await route.request().postDataJSON();
        noteData = postData;
        
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            note: {
              id: 'new-note-id',
              content: postData.content,
              color: '#fef3c7',
              done: false,
              isChecklist: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              user: {
                id: 'test-user',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          }),
        });
      }
    });

    await page.goto('/boards/test-board');

    await page.waitForTimeout(500);
    expect(getNotesRequested).toBe(true);
    await expect(page.locator('text=No notes yet')).toBeVisible();

    await page.click('button:has-text("Add Your First Note")');
    expect(noteCreated).toBe(true);
    expect(noteData).not.toBeNull();
    expect(noteData!.content).toBe('');

    const multilineContent = 'Line 1\nLine 2\nLine 3\n\nNew paragraph\nAnother line';
    const textarea = page.locator('textarea[placeholder*="Enter note content"]');
    await textarea.fill(multilineContent);

    await textarea.press('Control+Enter');
    
    await page.waitForTimeout(500);

    expect(noteCreated).toBe(true);
    expect(postNotesRequested).toBe(true);
    expect(noteData).not.toBeNull();
    expect(noteData!.content).toBe('');

  });

  test('should preserve newlines when editing notes', async ({ page }) => {
    let noteCreated = false;
    let noteUpdated = false;
    let capturedCreateData: { content: string } | null = null;
    let capturedUpdateData: { content: string } | null = null;

    await page.route('**/api/boards/test-board/notes', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notes: [] }),
        });
      } else if (route.request().method() === 'POST') {
        noteCreated = true;
        const postData = await route.request().postDataJSON();
        capturedCreateData = postData;
        
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            note: {
              id: 'new-note-id',
              content: postData.content || '',
              color: '#fef3c7',
              done: false,
              isChecklist: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              user: {
                id: 'test-user',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          }),
        });
      }
    });

    await page.route('**/api/boards/test-board/notes/new-note-id', async (route) => {
      if (route.request().method() === 'PUT') {
        noteUpdated = true;
        const putData = await route.request().postDataJSON();
        capturedUpdateData = putData;
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            note: {
              id: 'new-note-id',
              content: putData.content || '',
              color: '#fef3c7',
              done: false,
              isChecklist: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              user: {
                id: 'test-user',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          }),
        });
      }
    });
    
    await page.goto('/boards/test-board');
    await page.waitForTimeout(500);

    await page.click('button:has-text("Add Your First Note")');
    
    expect(noteCreated).toBe(true);
    expect(capturedCreateData).not.toBeNull();
    expect(capturedCreateData!.content).toBe('');

    const textarea = page.locator('textarea[placeholder*="Enter note content"]');
    const contentWithNewlines = 'First paragraph\n\nSecond paragraph after empty line\n\n\nThird paragraph after multiple empty lines';
    await textarea.fill(contentWithNewlines);
    
    await textarea.press('Control+Enter');
    await page.waitForTimeout(500);
    
    expect(noteUpdated).toBe(true);
    expect(capturedUpdateData).not.toBeNull();
    expect(capturedUpdateData!.content).toBe(contentWithNewlines);

    await page.hover('.group');
    await page.click('button:has(.w-3.h-3)');
    
    const editTextarea = page.locator('textarea[placeholder*="Enter note content"]');
    await expect(editTextarea).toHaveValue(contentWithNewlines);

    const textareaValue = await editTextarea.inputValue();
    expect(textareaValue).toBe(contentWithNewlines);
    expect(textareaValue.split('\n')).toHaveLength(6);
  });

  test('should handle creating notes with newlines in content', async ({ page }) => {
    await page.goto('/boards/test-board');
    
    await page.click('button:has-text("Add Your First Note")');
    
    const textarea = page.locator('textarea[placeholder*="Enter note content"]');
    await textarea.fill('Line 1\nLine 2\nLine 3');
    
    await textarea.press('Control+Enter');
    
    await page.hover('.group');
    await page.click('button:has(.w-3.h-3)');
    
    const editTextarea = page.locator('textarea[placeholder*="Enter note content"]');
    await expect(editTextarea).toHaveValue('Line 1\nLine 2\nLine 3');
  });

  test('should display empty state when no notes exist', async ({ page }) => {
    await page.goto('/boards/test-board');
    
    await expect(page.locator('text=No notes yet')).toBeVisible();
    await expect(page.locator('button:has-text("Add Your First Note")')).toBeVisible();
  });
});
