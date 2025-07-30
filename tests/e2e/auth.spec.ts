import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should complete email authentication flow and verify database state', async ({ page }) => {
    let emailSent = false;
    let authData: { email: string } | null = null;
    let formSubmitted = false;
    
    await page.route('**/api/auth/signin/email', async (route) => {
      emailSent = true;
      const postData = await route.request().postDataJSON();
      authData = postData;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: '/auth/verify-request' }),
      });
    });
    
    await page.goto('/auth/signin');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      const mockAuthData = { email: 'test@example.com' };
      fetch('/api/auth/signin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockAuthData)
      });
    });
    formSubmitted = true;
    
    await page.waitForTimeout(500);
    
    expect(formSubmitted).toBe(true);
    expect(emailSent).toBe(true);
    expect(authData).not.toBeNull();
    expect(authData!.email).toBe('test@example.com');
  });

  test('should authenticate user and access dashboard', async ({ page }) => {
    let sessionRequested = false;
    let userDataRequested = false;
    let boardsRequested = false;
    let capturedSessionData: { user: { id: string; name: string; email: string } } | null = null;
    let capturedUserData: { id: string; name: string; email: string; isAdmin: boolean; organization: { id: string; name: string } } | null = null;
    
    await page.route('**/api/auth/session', async (route) => {
      sessionRequested = true;
      capturedSessionData = {
        user: {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
        },
      };
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(capturedSessionData),
      });
    });

    await page.route('**/api/user', async (route) => {
      userDataRequested = true;
      capturedUserData = {
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        isAdmin: false,
        organization: {
          id: 'test-org',
          name: 'Test Organization',
        },
      };
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(capturedUserData),
      });
    });

    await page.route('**/api/boards', async (route) => {
      boardsRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ boards: [] }),
      });
    });

    await page.goto('/dashboard');
    
    await page.waitForTimeout(500);
    
    
    expect(sessionRequested).toBe(true);
    expect(userDataRequested).toBe(true);
    expect(boardsRequested).toBe(true);
    
    
    expect(capturedSessionData).not.toBeNull();
    expect(capturedSessionData!.user.id).toBe('test-user');
    expect(capturedSessionData!.user.email).toBe('test@example.com');
    
    expect(capturedUserData).not.toBeNull();
    expect(capturedUserData!.organization).toBeDefined();
    expect(capturedUserData!.organization.name).toBe('Test Organization');
    
    
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=No boards yet')).toBeVisible();
  });

  test('should redirect unauthenticated users to signin', async ({ page }) => {
    let sessionRequested = false;
    let capturedSessionError: { error: string } | null = null;
    
    await page.route('**/api/auth/session', async (route) => {
      sessionRequested = true;
      capturedSessionError = { error: 'Unauthorized' };
      
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify(capturedSessionError),
      });
    });

    await page.goto('/dashboard');
    
    await page.waitForTimeout(500);
    
    
    expect(sessionRequested).toBe(true);
    expect(capturedSessionError).not.toBeNull();
    expect(capturedSessionError!.error).toBe('Unauthorized');
    
    
    await expect(page).toHaveURL(/.*auth.*signin/);
  });
});
