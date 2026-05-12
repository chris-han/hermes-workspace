import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SMB_ORGANIZATION_ID,
  DEFAULT_SMB_ORGANIZATION_NAME,
  ensureDefaultSmbOrganization,
  upsertOrganizationAssociation,
} from './organization-membership'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('organization membership helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses org_smb_cn as the SMB default organization id', () => {
    expect(DEFAULT_SMB_ORGANIZATION_ID).toBe('org_smb_cn')
    expect(DEFAULT_SMB_ORGANIZATION_NAME).toBe('SMB Analytics Dataset')
  })

  it('switches directly when the organization is already a known membership', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          organization: null,
          memberships: [
            {
              organization_id: 'org_smb_cn',
              organization_name: 'SMB Analytics Dataset',
              membership_status: 'active',
            },
          ],
          members: [],
          audit_events: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          organization: {
            organization_id: 'org_smb_cn',
            organization_name: 'SMB Analytics Dataset',
            membership_status: 'active',
          },
          memberships: [],
          members: [],
          audit_events: [],
        }),
      )

    await upsertOrganizationAssociation(
      {
        organizationId: 'org_smb_cn',
        createIfMissing: false,
      },
      fetchMock,
    )

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/me',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/switch',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ organization_id: 'org_smb_cn' }),
      }),
    )
  })

  it('creates the SMB default organization when it is not registered yet', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          organization: null,
          memberships: [],
          members: [],
          audit_events: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'organization not found' }, 404),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          organization: {
            organization_id: 'org_smb_cn',
            organization_name: 'SMB Analytics Dataset',
            membership_status: 'active',
          },
          memberships: [
            {
              organization_id: 'org_smb_cn',
              organization_name: 'SMB Analytics Dataset',
              membership_status: 'active',
            },
          ],
          members: [],
          audit_events: [],
        }),
      )

    await ensureDefaultSmbOrganization(fetchMock)

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/join',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ organization_id: 'org_smb_cn' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/organizations/join',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          organization_id: 'org_smb_cn',
          organization_name: 'SMB Analytics Dataset',
          create: true,
        }),
      }),
    )
  })
})
