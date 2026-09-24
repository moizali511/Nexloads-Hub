/**
 * Integration adapters — implement provider-specific clients here.
 * UI and RPCs must not hard-code vendor APIs.
 */

export const integrationRegistry = {
  voip: {
    ringcentral: { status: 'not_configured', connect: null },
    callcom: { status: 'not_configured', connect: null },
  },
  email: { gmail: { status: 'not_configured' } },
  calendar: { google: { status: 'not_configured' } },
  loadboards: { generic: { status: 'not_configured' } },
}

export function getIntegration(providerKey) {
  for (const group of Object.values(integrationRegistry)) {
    if (group[providerKey]) return group[providerKey]
  }
  return null
}
