export function normalizeBranchTitle(title: string | undefined): string {
  const value = title?.trim() || 'New Session'
  return value.startsWith('⎇ ') ? value : `⎇ ${value}`
}
