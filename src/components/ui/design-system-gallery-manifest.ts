const DESIGN_SYSTEM_GALLERY_FAMILIES = [
  'alert-dialog',
  'autocomplete',
  'badge',
  'breadcrumb',
  'button',
  'canvas-control-layer',
  'checkbox-radio-switch',
  'command',
  'data-grid',
  'dialog-sheet',
  'disclosure-accordion',
  'empty-loading-error',
  'field-input',
  'file-input-upload-dropzone',
  'link',
  'listbox',
  'menu',
  'controlled-select-datalist',
  'pagination',
  'popover-preview-card',
  'progress',
  'resize-split-panel',
  'scroll-area',
  'segmented-control',
  'table',
  'tabs',
  'textarea',
  'toast',
  'tooltip',
  'tree-view',
] as const

type DesignSystemGalleryFamily = (typeof DESIGN_SYSTEM_GALLERY_FAMILIES)[number]

export { DESIGN_SYSTEM_GALLERY_FAMILIES }
export type { DesignSystemGalleryFamily }
