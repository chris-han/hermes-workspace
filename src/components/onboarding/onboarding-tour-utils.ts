import { ACTIONS, STATUS } from 'react-joyride'

export function shouldCompleteOnboardingTour(
  action: string,
  status: string,
): boolean {
  const finishedStatuses: Array<string> = [STATUS.FINISHED, STATUS.SKIPPED]
  return finishedStatuses.includes(status) || action === ACTIONS.CLOSE
}
