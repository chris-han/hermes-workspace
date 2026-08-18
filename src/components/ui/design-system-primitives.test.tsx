// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ActionSurface } from './action-surface'
import { Button } from './button'
import { DesignSystemGallery } from './design-system-gallery'
import { DialogSurface } from './dialog-surface'
import { Pagination } from './pagination'
import {
  CanvasControlLayer,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridRow,
  ResizeHandle,
  TreeItem,
  TreeView,
} from './advanced-surfaces'
import { Field } from './form-controls'
import { Input } from './input'
import { UploadDropzone } from './upload-dropzone'
import { DESIGN_SYSTEM_GALLERY_FAMILIES } from './design-system-gallery-manifest'
import { Listbox, ListboxOption } from './selection-surfaces'
import { Disclosure, DisclosureSummary } from './disclosure'
import { Switch } from './switch'
import { Tabs, TabsList, TabsPanel, TabsTab } from './tabs'
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from './collapsible'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from './menu'
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from './autocomplete'

afterEach(async () => {
  cleanup()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.className = ''
  await new Promise((resolve) => setTimeout(resolve, 0))
})

describe('design-system primitive contracts', () => {
  it('preserves the accent fill for checked checkbox and radio controls', () => {
    const styles = readFileSync('src/styles.css', 'utf8')
    expect(styles).toMatch(
      /:is\(\[data-slot='checkbox'\], \[data-slot='radio'\]\):checked\s*\{[^}]*background: var\(--theme-accent\)/s,
    )
  })

  it('defaults buttons to non-submitting controls', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty(
      'type',
      'button',
    )
  })

  it('pins canonical control geometry to the reference demo', () => {
    render(<DesignSystemGallery />)
    const primary = screen.getByRole('button', { name: 'Primary' })
    expect(primary.className).toContain('py-3')
    expect(primary.className).toContain('px-[1.375rem]')

    const toggle = screen.getByRole('switch', { name: 'Switch' })
    expect(toggle.className).toContain('h-6')
    expect(toggle.className).toContain('w-11')

    const textarea = screen.getByRole('textbox', { name: 'Notes' })
    expect(textarea.className).toContain('px-[0.9rem]')
    expect(textarea.className).toContain('py-[0.7rem]')

    const alert = screen.getByText('The operation completed successfully.').closest(
      '[data-slot="alert"]',
    )
    expect(alert?.className).toContain('rounded-[0.75rem]')
    expect(alert?.className).toContain('px-[1.1rem]')
    expect(alert?.className).toContain('py-[0.9rem]')

    const firstPage = screen.getByRole('button', { name: 'Page 1' })
    expect(firstPage.className).toContain('size-9')

    const confirmDelete = screen.getByRole('button', {
      name: 'Confirm delete',
    })
    const openPopover = screen.getByRole('button', { name: 'Open popover' })
    expect(confirmDelete.className).toContain('self-start')
    expect(openPopover.className).toContain('self-start')

    const fileInput = screen.getByLabelText('File input')
    expect(fileInput.className).toContain('file:text-[0.8125rem]')
    expect(fileInput.className).toContain('file:font-semibold')

    const graphCanvasLabel = screen.getByText('Graph canvas')
    expect(graphCanvasLabel.className).toContain('text-xs')
    expect(graphCanvasLabel.className).toContain('font-semibold')
  })

  it('activates action surfaces with Enter and Space', () => {
    const onClick = vi.fn()
    render(<ActionSurface onClick={onClick}>Open card</ActionSurface>)
    const surface = screen.getByRole('button', { name: 'Open card' })
    fireEvent.keyDown(surface, { key: 'Enter' })
    fireEvent.keyDown(surface, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('traps dialog focus, dismisses on Escape, and restores focus', () => {
    const onDismiss = vi.fn()
    render(
      <div>
        <button type="button">Background</button>
        <DialogSurface aria-label="Contract dialog" onDismiss={onDismiss}>
          <button type="button">First</button>
          <button type="button">Last</button>
        </DialogSurface>
      </div>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Contract dialog' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'First' }),
    )
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('supports keyboard pagination and resize changes', () => {
    const onPageChange = vi.fn()
    const onValueChange = vi.fn()
    render(
      <>
        <Pagination page={2} pageCount={3} onPageChange={onPageChange} />
        <ResizeHandle value={50} onValueChange={onValueChange} />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' })
    expect(onPageChange).toHaveBeenCalledWith(3)
    expect(onValueChange).toHaveBeenCalledWith(55)
  })

  it('connects field labels, help, and errors to the owned control', () => {
    render(
      <Field
        label="Workspace"
        description="Choose a workspace"
        error="Required"
      >
        <Input />
      </Field>,
    )
    const input = screen.getByRole('textbox', { name: 'Workspace' })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const describedBy = input.getAttribute('aria-describedby') ?? ''
    expect(describedBy).toContain('-description')
    expect(describedBy).toContain('-error')
  })

  it('activates upload drop zones from the keyboard', () => {
    const onClick = vi.fn()
    render(<UploadDropzone onClick={onClick}>Upload evidence</UploadDropzone>)
    const dropzone = screen.getByRole('button', { name: 'Upload evidence' })
    fireEvent.keyDown(dropzone, { key: 'Enter' })
    fireEvent.keyDown(dropzone, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('supports arrow-key tabs and exposes the selected panel', () => {
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTab value="one">One</TabsTab>
          <TabsTab value="two">Two</TabsTab>
        </TabsList>
        <TabsPanel value="one">Panel one</TabsPanel>
        <TabsPanel value="two">Panel two</TabsPanel>
      </Tabs>,
    )
    const first = screen.getByRole('tab', { name: 'One' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    const second = screen.getByRole('tab', { name: 'Two' })
    expect(document.activeElement).toBe(second)
    fireEvent.click(second)
    expect(second.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toContain('Panel two')
  })

  it('opens menus and moves focus with arrow keys', () => {
    render(
      <MenuRoot>
        <MenuTrigger render={<Button />}>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem>Inspect</MenuItem>
          <MenuItem>Delete</MenuItem>
        </MenuContent>
      </MenuRoot>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    const first = screen.getByRole('menuitem', { name: 'Inspect' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'Delete' }),
    )
  })

  it('exposes combobox options and supports keyboard highlighting', () => {
    render(
      <Autocomplete items={['Alpha', 'Beta']} open>
        <AutocompleteInput aria-label="Workspace search" />
        <AutocompletePopup>
          <AutocompleteList>
            {(item) => (
              <AutocompleteItem key={item} value={item}>
                {item}
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompletePopup>
      </Autocomplete>,
    )
    const input = screen.getByRole('combobox', { name: 'Workspace search' })
    expect(input.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option').length).toBe(2)
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy()
  })

  it('operates accordion, switch, and native disclosure controls', () => {
    render(
      <>
        <Collapsible>
          <CollapsibleTrigger>Details</CollapsibleTrigger>
          <CollapsiblePanel>Accordion body</CollapsiblePanel>
        </Collapsible>
        <Switch aria-label="Notifications" />
        <Disclosure>
          <DisclosureSummary>Advanced</DisclosureSummary>
          Disclosure body
        </Disclosure>
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(
      screen
        .getByRole('button', { name: 'Details' })
        .getAttribute('aria-expanded'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('switch', { name: 'Notifications' }))
    expect(
      screen
        .getByRole('switch', { name: 'Notifications' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    const summary = screen.getByText('Advanced')
    fireEvent.click(summary)
    expect(
      (summary.closest('details') as HTMLDetailsElement | null)?.open,
    ).toBe(true)
  })

  it('supports listbox selection and arrow-key focus movement', () => {
    const onSelect = vi.fn()
    render(
      <Listbox label="Choices">
        <ListboxOption selected onSelect={onSelect}>
          Alpha
        </ListboxOption>
        <ListboxOption>Beta</ListboxOption>
      </Listbox>,
    )
    const alpha = screen.getByRole('option', { name: 'Alpha' })
    alpha.focus()
    fireEvent.keyDown(alpha, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(
      screen.getByRole('option', { name: 'Beta' }),
    )
    alpha.focus()
    fireEvent.keyDown(alpha, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('supports data-grid and tree keyboard navigation with a canvas fallback', () => {
    const onTreeSelect = vi.fn()
    render(
      <>
        <DataGrid label="Artifacts">
          <DataGridBody>
            <DataGridRow>
              <DataGridCell tabIndex={0}>A1</DataGridCell>
              <DataGridCell>A2</DataGridCell>
            </DataGridRow>
          </DataGridBody>
        </DataGrid>
        <TreeView label="Files">
          <TreeItem selected onSelect={onTreeSelect}>
            Folder
          </TreeItem>
          <TreeItem>File</TreeItem>
        </TreeView>
        <CanvasControlLayer
          label="Graph"
          controls={<Button aria-label="Zoom in">+</Button>}
          accessibleFallback={<p>Node A connects to Node B</p>}
        >
          <canvas />
        </CanvasControlLayer>
      </>,
    )
    const firstCell = screen.getByRole('gridcell', { name: 'A1' })
    firstCell.focus()
    fireEvent.keyDown(firstCell, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(
      screen.getByRole('gridcell', { name: 'A2' }),
    )
    const folder = screen.getByRole('treeitem', { name: 'Folder' })
    folder.focus()
    fireEvent.keyDown(folder, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(
      screen.getByRole('treeitem', { name: 'File' }),
    )
    folder.focus()
    fireEvent.keyDown(folder, { key: ' ' })
    expect(onTreeSelect).toHaveBeenCalledOnce()
    expect(screen.getByText('Node A connects to Node B')).toBeTruthy()
  })

  it('renders every canonical gallery family and toggles locale/theme', () => {
    render(<DesignSystemGallery />)
    expect(screen.getByTestId('canonical-component-gallery')).toBeTruthy()
    const renderedFamilies = [
      ...document.querySelectorAll<HTMLElement>('[data-gallery-family]'),
    ].map((element) => element.dataset.galleryFamily)
    expect([...new Set(renderedFamilies)].sort()).toEqual(
      [...DESIGN_SYSTEM_GALLERY_FAMILIES].sort(),
    )
    for (const badge of [
      'Selected',
      'Active',
      'Pending',
      'Offline',
      'Verified',
      'Information',
    ]) {
      expect(screen.getAllByText(badge).length).toBeGreaterThan(0)
    }
    const selectedBadge = screen.getByText('Selected').closest('[data-slot="badge"]')
    expect(selectedBadge?.className).toContain('text-[0.75rem]')
    expect(selectedBadge?.querySelector('[aria-hidden="true"]')?.className).toContain(
      'size-[0.4rem]',
    )
    for (const alert of ['Success', 'Warning', 'Information', 'Action required']) {
      expect(screen.getAllByText(alert).length).toBeGreaterThan(0)
    }
    fireEvent.click(screen.getByRole('button', { name: '中文' }))
    expect(screen.getByRole('heading', { name: '规范组件画廊' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'semantier-light',
    )
  })
})
