import { describe, expect, it } from 'vitest'

import { canonicalBodyFromCurationMarkdown } from './studio-shell'

describe('canonicalBodyFromCurationMarkdown', () => {
  it('removes derived wiki title and provenance before extraction', () => {
    expect(canonicalBodyFromCurationMarkdown([
      '# source.docx',
      '',
      '> Curation material only.',
      '> Source file: wiki/uploads/source.docx',
      '> Parser method: docx_ooxml',
      '',
      'Cisco must be reviewed.',
    ].join('\n'))).toBe('Cisco must be reviewed.')
  })
})
