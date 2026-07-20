import { expect, test, type Page } from '@playwright/test';
import type { StudentParentLinkInvitationResponse } from '../src/types/api';

const GENERATED_AT = '2026-07-17T03:30:00Z';
const TRANSPARENT_AVATAR =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const invitations: StudentParentLinkInvitationResponse[] = [
  invitation('parent-accept', 'Phu huynh A', 'mother', 'pending', false),
  invitation('parent-reject', 'Phu huynh B', 'father', 'pending', false),
  invitation('parent-expired', 'Phu huynh C', 'guardian', 'expired', true),
];

interface RequestMetrics {
  acceptRequests: number;
  rejectRequests: number;
}

function invitation(
  parentId: string,
  parentName: string,
  relationship: StudentParentLinkInvitationResponse['relationship'],
  status: StudentParentLinkInvitationResponse['status'],
  expired: boolean,
): StudentParentLinkInvitationResponse {
  return {
    parentId,
    parentName,
    parentEmail: `${parentId}@example.com`,
    avatarUrl: TRANSPARENT_AVATAR,
    relationship,
    note: 'Can theo doi tien do hoc tap.',
    status,
    invitedAt: expired ? '2026-07-01T03:30:00Z' : '2026-07-17T03:00:00Z',
    expiresAt: expired ? '2026-07-08T03:30:00Z' : '2026-07-24T03:00:00Z',
    expired,
    respondedAt: expired ? '2026-07-08T03:31:00Z' : null,
    unlinkRequestedById: null,
    unlinkRequestedByRole: null,
    unlinkRequestedAt: null,
    sensitiveDataConsentGranted: false,
    sensitiveDataConsentUpdatedAt: null,
  };
}

async function mockStudentParentLinkApi(page: Page): Promise<RequestMetrics> {
  const metrics: RequestMetrics = { acceptRequests: 0, rejectRequests: 0 };

  await page.addInitScript(() => {
    localStorage.setItem('bee-academy-auth', JSON.stringify({
      state: {
        isLoggedIn: true,
        user: {
          id: 'student-1',
          name: 'Hoc sinh Nguyen',
          email: 'student@example.com',
          role: 'student',
        },
        accessToken: 'e2e-access-token',
        refreshToken: null,
        linkedStudents: [],
      },
      version: 0,
    }));
  });

  await page.route(/\/api\/system\/status(?:\?.*)?$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse({ maintenanceMode: false, maintenanceUntil: null }),
    });
  });

  await page.route(/\/api\/notifications(?:\?.*)?$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse({ unreadCount: 0, notifications: [] }),
    });
  });

  await page.route(/\/api\/student\/parent-link-invitations\/linked-parents(?:\?.*)?$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse([]),
    });
  });

  await page.route(/\/api\/student\/parent-link-invitations\/parent-accept\/accept$/, async route => {
    metrics.acceptRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse({
        ...invitations[0],
        status: 'active',
        respondedAt: GENERATED_AT,
      }),
    });
  });

  await page.route(/\/api\/student\/parent-link-invitations\/parent-reject\/reject$/, async route => {
    metrics.rejectRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse({
        ...invitations[1],
        status: 'rejected',
        respondedAt: GENERATED_AT,
      }),
    });
  });

  await page.route(/\/api\/student\/parent-link-invitations(?:\?.*)?$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse(invitations),
    });
  });

  return metrics;
}

function apiResponse(data: unknown): string {
  return JSON.stringify({
    success: true,
    message: 'OK',
    data,
    timestamp: GENERATED_AT,
  });
}

test('UC28: student accepts, rejects, and still sees expired parent-link invitations', async ({ page }) => {
  const metrics = await mockStudentParentLinkApi(page);

  await page.goto('/notifications');

  await expect(page.getByTestId('parent-link-invitation-parent-accept')).toBeVisible();
  await expect(page.getByTestId('parent-link-invitation-parent-reject')).toBeVisible();
  await expect(page.getByTestId('parent-link-invitation-parent-expired')).toBeVisible();
  await expect(page.getByTestId('parent-link-expired-parent-expired')).toContainText('Yeu cau da het han');
  await expect(page.getByTestId('accept-parent-link-parent-expired')).toBeDisabled();
  await expect(page.getByTestId('reject-parent-link-parent-expired')).toBeDisabled();

  await page.getByTestId('accept-parent-link-parent-accept').click();
  await expect(page.getByTestId('parent-link-invitation-parent-accept')).toHaveCount(0);
  expect(metrics.acceptRequests).toBe(1);

  await page.getByTestId('reject-parent-link-parent-reject').click();
  await expect(page.getByTestId('parent-link-invitation-parent-reject')).toHaveCount(0);
  expect(metrics.rejectRequests).toBe(1);
});
