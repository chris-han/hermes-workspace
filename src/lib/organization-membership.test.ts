import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SMB_ORGANIZATION_ID,
  DEFAULT_SMB_ORGANIZATION_NAME,
  ensureDefaultSmbOrganization,
  updateOrganizationMaterializationPolicy,
  updateOrganizationMemberRole,
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
    expect(DEFAULT_SMB_ORGANIZATION_NAME).toBe('北京索阳科技有限公司')
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
              organization_name: '北京索阳科技有限公司',
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
            organization_name: '北京索阳科技有限公司',
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
            organization_name: '北京索阳科技有限公司',
            membership_status: 'active',
          },
          memberships: [
            {
              organization_id: 'org_smb_cn',
              organization_name: '北京索阳科技有限公司',
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
          organization_name: '北京索阳科技有限公司',
          create: true,
        }),
      }),
    )
  })

  it('updates materialization policy through organization endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        organization: {
          organization_id: 'org_smb_cn',
          t6_materialization_policy: {
            default_mode: 'AUTO',
          },
        },
        memberships: [],
        members: [],
        audit_events: [],
      }),
    )

    await updateOrganizationMaterializationPolicy(
      {
        default_mode: 'AUTO',
        auto_allowed_claim_classes: ['invoice.low_risk'],
      },
      fetchMock,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/organizations/materialization-policy',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          default_mode: 'AUTO',
          auto_allowed_claim_classes: ['invoice.low_risk'],
        }),
      }),
    )
  })

  it('updates member role through organization endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        organization: {
          organization_id: 'org_smb_cn',
        },
        memberships: [],
        members: [],
        audit_events: [],
      }),
    )

    await updateOrganizationMemberRole(
      {
        userId: 'user-1',
        memberRole: 'admin',
      },
      fetchMock,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/organizations/member-role',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 'user-1', member_role: 'admin' }),
      }),
    )
  })
})
