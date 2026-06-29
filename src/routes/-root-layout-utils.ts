export function getRootLayoutMode(
  onboardingComplete: string | null,
): 'onboarding' | 'workspace' {
  return onboardingComplete === 'true' ? 'workspace' : 'onboarding'
}
