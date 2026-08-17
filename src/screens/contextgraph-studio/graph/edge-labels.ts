/** Keep relationship labels readable in every camera orientation. */
export function uprightEdgeLabel(label: string): string {
  return label.replace(/[\u2028\u2029]/g, ' ').trim()
}
