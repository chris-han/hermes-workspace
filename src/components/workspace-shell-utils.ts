export const DESKTOP_SIDEBAR_BACKDROP_CLASS =
  'fixed left-0 bottom-0 top-[var(--titlebar-h,0px)] w-[300px] z-10 bg-black/10 backdrop-blur-[1px]'

export function shouldShowSemantierLogin(
  semantierAuthLoading: boolean,
  semantierAuthenticated: boolean | undefined,
): boolean {
  return !semantierAuthLoading && semantierAuthenticated === false
}

export function shouldAutoRedirectToFeishuLogin(
  feishuOauthEnabled: boolean | undefined,
  semantierAuthenticated: boolean | undefined,
  autoLoginSuppressed: boolean,
): boolean {
  return Boolean(
    feishuOauthEnabled &&
      semantierAuthenticated === false &&
      !autoLoginSuppressed,
  )
}
