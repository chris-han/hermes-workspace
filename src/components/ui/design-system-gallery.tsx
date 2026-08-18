import { useState } from 'react'

import {
  CanvasControlLayer,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHead,
  DataGridHeader,
  DataGridRow,
  ResizeHandle,
  SplitPanel,
  TreeItem,
  TreeView,
} from './advanced-surfaces'
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Progress,
} from './status'
import { Button } from './button'
import {
  Checkbox,
  Datalist,
  Field,
  FileInput,
  Radio,
  Textarea,
} from './form-controls'
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from './collapsible'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import { Disclosure, DisclosureSummary } from './disclosure'
import { Input } from './input'
import { Link } from './link'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from './menu'
import { Pagination } from './pagination'
import { Switch } from './switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'
import { Tabs, TabsList, TabsPanel, TabsTab } from './tabs'
import {
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from './tooltip'
import { UploadDropzone } from './upload-dropzone'
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
} from './autocomplete'
import {
  Command,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from './command'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from './sheet'
import { ThreeDotsSpinner } from './three-dots-spinner'
import { BrailleSpinner } from './braille-spinner'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'
import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from './navigation-surfaces'
import {
  ControlledSelect,
  Listbox,
  ListboxGroup,
  ListboxOption,
  SegmentedControl,
} from './selection-surfaces'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from './popover'
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from './preview-card'
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from './scroll-area'
import { Toaster, toast } from './toast'

const copy = {
  en: {
    title: 'Canonical component gallery',
    subtitle:
      'Every shared interaction family, rendered from production primitives.',
    controls: 'Controls',
    forms: 'Forms and selection',
    overlays: 'Navigation and overlays',
    data: 'Data and advanced surfaces',
  },
  zh: {
    title: '规范组件画廊',
    subtitle: '所有共享交互组件均由生产级原语渲染。',
    controls: '控件',
    forms: '表单与选择',
    overlays: '导航与浮层',
    data: '数据与高级界面',
  },
} as const

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-section border border-[var(--theme-border)] bg-[var(--theme-card)] p-6">
      <h2 className="mb-5 text-xl font-semibold text-[var(--theme-text)]">
        {title}
      </h2>
      <div className="grid gap-6">{children}</div>
    </section>
  )
}

const gallerySelectOptions = [
  { value: 'one', label: 'Option one' },
  { value: 'two', label: 'Option two' },
]

function DesignSystemGallery() {
  const [locale, setLocale] = useState<'en' | 'zh'>('en')
  const [page, setPage] = useState(2)
  const [split, setSplit] = useState(50)
  const [enabled, setEnabled] = useState(true)
  const [selection, setSelection] = useState('alpha')
  const [segment, setSegment] = useState('comfortable')
  const [controlledSelect, setControlledSelect] = useState('one')
  const text = copy[locale]

  function toggleTheme() {
    const root = document.documentElement
    const dark = root.getAttribute('data-theme') !== 'semantier-light'
    const theme = dark ? 'semantier-light' : 'semantier'
    root.setAttribute('data-theme', theme)
    root.classList.toggle('dark', theme === 'semantier')
    root.classList.toggle('light', theme === 'semantier-light')
    root.style.setProperty(
      'color-scheme',
      theme === 'semantier' ? 'dark' : 'light',
    )
  }

  return (
    <main
      className="min-h-screen bg-[var(--theme-bg)] p-4 text-[var(--theme-text)] sm:p-8"
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      data-testid="canonical-component-gallery"
    >
      <header className="mx-auto mb-8 flex max-w-6xl flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="accent">Semantier DS</Badge>
          <h1 className="mt-3 text-3xl font-bold">{text.title}</h1>
          <p className="mt-2 text-[var(--theme-muted)]">{text.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={toggleTheme}>
            Theme
          </Button>
          <Button
            variant="secondary"
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
          >
            {locale === 'en' ? '中文' : 'English'}
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6">
        <Section title={text.controls}>
          <div
            className="flex flex-wrap items-center gap-3"
            data-gallery-family="button"
          >
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Danger</Button>
            <Button disabled>Disabled</Button>
            <Button aria-busy="true" disabled>
              <ThreeDotsSpinner /> Loading
            </Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add">
              +
            </Button>
          </div>
          <div className="flex flex-wrap gap-2" data-gallery-family="badge">
            <Badge tone="accent">
              <span
                aria-hidden="true"
                className="size-[0.4rem] rounded-full bg-current"
              />
              Selected
            </Badge>
            <Badge tone="success">
              <span
                aria-hidden="true"
                className="size-[0.4rem] rounded-full bg-current"
              />
              Active
            </Badge>
            <Badge tone="warning">
              <span
                aria-hidden="true"
                className="size-[0.4rem] rounded-full bg-current"
              />
              Pending
            </Badge>
            <Badge tone="danger">
              <span
                aria-hidden="true"
                className="size-[0.4rem] rounded-full bg-current"
              />
              Offline
            </Badge>
            <Badge tone="neutral">
              <span aria-hidden="true" className="text-xs leading-none">
                ✓
              </span>
              Verified
            </Badge>
            <Badge tone="info">
              <span
                aria-hidden="true"
                className="size-[0.4rem] rounded-full bg-current"
              />
              Information
            </Badge>
          </div>
          <div
            className="grid gap-3 sm:grid-cols-2"
            data-gallery-family="progress"
          >
            <Progress value={64} label="Deterministic progress" />
            <Progress label="Indeterminate progress" />
          </div>
          <div
            className="grid gap-3 sm:grid-cols-2"
            data-gallery-family="empty-loading-error"
          >
            <Alert tone="success" title="Success">
              The operation completed successfully.
            </Alert>
            <Alert tone="warning" title="Warning">
              Review this item before continuing.
            </Alert>
            <Alert tone="info" title="Information">
              A non-blocking status message.
            </Alert>
            <Alert tone="danger" title="Action required">
              An assertive error state.
            </Alert>
            <EmptyState
              title="Nothing here"
              action={<Button size="sm">Create item</Button>}
            >
              Add the first governed item.
            </EmptyState>
            <div className="grid content-start gap-3">
              <LoadingState label="Loading records" />
              <ErrorState
                action={
                  <Button size="sm" variant="outline">
                    Retry
                  </Button>
                }
              >
                The request could not be completed.
              </ErrorState>
            </div>
          </div>
          <div className="flex items-center gap-3" data-gallery-family="toast">
            <Button
              variant="outline"
              onClick={() => toast('Gallery notification', { type: 'success' })}
            >
              Show toast
            </Button>
            <Toaster />
          </div>
        </Section>

        <Section title={text.forms}>
          <div
            className="grid gap-4 sm:grid-cols-2"
            data-gallery-family="field-input"
          >
            <Field label="Name" description="Shared field help">
              <Input placeholder="Semantier" />
            </Field>
            <Field label="Invalid field" error="A value is required">
              <Input aria-invalid="true" />
            </Field>
            <Field label="Required field" required>
              <Input required />
            </Field>
            <Field label="Disabled field">
              <Input disabled value="Unavailable" readOnly />
            </Field>
            <Field label="Controlled select">
              <ControlledSelect
                label="Controlled select"
                value={controlledSelect}
                options={gallerySelectOptions}
                onValueChange={setControlledSelect}
              />
            </Field>
            <Field label="Notes">
              <Textarea placeholder="Write a note" required />
            </Field>
            <Field label="Disabled notes">
              <Textarea disabled value="Unavailable" readOnly />
            </Field>
            <div
              className="grid gap-3"
              data-gallery-family="checkbox-radio-switch"
            >
              <label className="flex items-center gap-2">
                <Checkbox defaultChecked /> Checkbox
              </label>
              <label className="flex items-center gap-2">
                <Radio name="gallery-radio" defaultChecked /> Radio
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} /> Switch
              </label>
            </div>
            <div
              className="grid gap-2"
              data-gallery-family="file-input-upload-dropzone"
            >
              <UploadDropzone className="p-4" onClick={() => undefined}>
                Drop files or press Enter to browse
              </UploadDropzone>
              <UploadDropzone className="p-4" dragActive>
                Release to upload
              </UploadDropzone>
              <UploadDropzone className="p-4" invalid>
                Upload failed
              </UploadDropzone>
              <UploadDropzone className="p-4" disabled>
                Upload disabled
              </UploadDropzone>
            </div>
          </div>
          <div
            className="grid gap-3 sm:grid-cols-3"
            aria-label="HTML input type states"
          >
            {(
              [
                'email',
                'password',
                'search',
                'number',
                'date',
                'range',
                'time',
                'url',
                'tel',
              ] as const
            ).map((type) => (
              <Field key={type} label={type}>
                <Input type={type} />
              </Field>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="File input">
              <FileInput multiple />
            </Field>
            <Field label="Suggested value">
              <Input list="gallery-suggestions" placeholder="Type A" />
            </Field>
            <Datalist id="gallery-suggestions">
              <option value="Alpha" />
              <option value="Beta" />
            </Datalist>
            <span
              data-gallery-family="controlled-select-datalist"
              className="sr-only"
            >
              Controlled selection controls
            </span>
            <span data-gallery-family="textarea" className="sr-only">
              Textarea states
            </span>
          </div>
          <Listbox label="Workspace choices" data-gallery-family="listbox">
            <ListboxGroup label="Available workspaces">
              {['alpha', 'beta', 'gamma'].map((value) => (
                <ListboxOption
                  key={value}
                  selected={selection === value}
                  onSelect={() => setSelection(value)}
                >
                  {value}
                </ListboxOption>
              ))}
              <ListboxOption disabled>Unavailable</ListboxOption>
            </ListboxGroup>
          </Listbox>
          <div data-gallery-family="segmented-control">
            <SegmentedControl
              label="Density"
              value={segment}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'spacious', label: 'Spacious', disabled: true },
              ]}
              onValueChange={setSegment}
            />
          </div>
        </Section>

        <Section title={text.overlays}>
          <Tabs defaultValue="first" data-gallery-family="tabs">
            <TabsList variant="underline">
              <TabsTab value="first">First</TabsTab>
              <TabsTab value="second">Second</TabsTab>
              <TabsTab value="disabled" disabled>
                Disabled
              </TabsTab>
            </TabsList>
            <TabsPanel
              value="first"
              className="rounded-card bg-[var(--theme-card2)] p-4"
            >
              First panel
            </TabsPanel>
            <TabsPanel
              value="second"
              className="rounded-card bg-[var(--theme-card2)] p-4"
            >
              Second panel
            </TabsPanel>
          </Tabs>
          <div className="flex flex-wrap gap-3">
            <div data-gallery-family="menu">
              <MenuRoot>
                <MenuTrigger render={<Button variant="outline" />}>
                  Open menu
                </MenuTrigger>
                <MenuContent>
                  <MenuItem>Inspect</MenuItem>
                  <MenuItem className="text-red-600">Delete</MenuItem>
                </MenuContent>
              </MenuRoot>
            </div>
            <div data-gallery-family="dialog-sheet">
              <DialogRoot>
                <DialogTrigger render={<Button variant="outline" />}>
                  Open dialog
                </DialogTrigger>
                <DialogContent>
                  <div className="p-7">
                    <DialogTitle>Accessible dialog</DialogTitle>
                    <DialogDescription>
                      Focus is trapped and Escape closes this surface.
                    </DialogDescription>
                    <DialogClose render={<Button className="mt-4" />}>
                      Close
                    </DialogClose>
                  </div>
                </DialogContent>
              </DialogRoot>
              <div data-gallery-family="tooltip">
                <TooltipProvider>
                  <TooltipRoot>
                    <TooltipTrigger render={<Button variant="ghost" />}>
                      Focus or hover
                    </TooltipTrigger>
                    <TooltipContent>Keyboard-accessible tooltip</TooltipContent>
                  </TooltipRoot>
                </TooltipProvider>
              </div>
              <Sheet>
                <SheetTrigger render={<Button variant="outline" />}>
                  Open sheet
                </SheetTrigger>
                <SheetContent>
                  <SheetTitle>Workspace sheet</SheetTitle>
                  <SheetDescription>
                    A keyboard-operable secondary surface.
                  </SheetDescription>
                  <SheetClose render={<Button className="mt-4" />}>
                    Close
                  </SheetClose>
                </SheetContent>
              </Sheet>
            </div>
            <AlertDialogRoot>
              <AlertDialogTrigger
                render={<Button variant="destructive" />}
                className="self-start"
                data-gallery-family="alert-dialog"
              >
                Confirm delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <div className="grid gap-3 p-5">
                  <AlertDialogTitle>Delete artifact?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone.
                  </AlertDialogDescription>
                  <div className="flex justify-end gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Delete</AlertDialogAction>
                  </div>
                </div>
              </AlertDialogContent>
            </AlertDialogRoot>
            <Popover>
              <PopoverTrigger
                render={<Button variant="outline" />}
                className="self-start"
                data-gallery-family="popover-preview-card"
              >
                Open popover
              </PopoverTrigger>
              <PopoverContent>
                <p>Interactive contextual content.</p>
                <PopoverClose render={<Button size="sm" className="mt-3" />}>
                  Close
                </PopoverClose>
              </PopoverContent>
            </Popover>
            <PreviewCard>
              <PreviewCardTrigger render={<Link href="#gallery-table" />}>
                Preview link
              </PreviewCardTrigger>
              <PreviewCardPopup>
                Non-interactive preview content.
              </PreviewCardPopup>
            </PreviewCard>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div data-gallery-family="autocomplete">
              <Autocomplete items={['Alpha', 'Beta', 'Gamma']}>
                <AutocompleteInput
                  aria-label="Choose a workspace"
                  placeholder="Search workspaces"
                />
                <AutocompletePopup>
                  <AutocompleteList>
                    {(item) => (
                      <AutocompleteItem key={item} value={item}>
                        {item}
                      </AutocompleteItem>
                    )}
                  </AutocompleteList>
                </AutocompletePopup>
              </Autocomplete>
            </div>
            <div data-gallery-family="command">
              <Command items={['Open file', 'Start task', 'Review evidence']}>
                <CommandPanel>
                  <CommandInput
                    aria-label="Command search"
                    placeholder="Type a command"
                  />
                  <CommandList>
                    <CommandGroup>
                      <CommandGroupLabel>Commands</CommandGroupLabel>
                      <CommandItem value="Open file">Open file</CommandItem>
                      <CommandItem value="Start task">Start task</CommandItem>
                      <CommandItem value="Review evidence">
                        Review evidence
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </CommandPanel>
              </Command>
            </div>
          </div>
          <div
            data-gallery-family="disclosure-accordion"
            className="grid gap-3"
          >
            <Collapsible>
              <CollapsibleTrigger>Animated accordion</CollapsibleTrigger>
              <CollapsiblePanel contentClassName="rounded-card bg-[var(--theme-card2)] p-3">
                Accordion content
              </CollapsiblePanel>
            </Collapsible>
            <Disclosure>
              <DisclosureSummary>Native disclosure</DisclosureSummary>
              <div className="px-4 pb-4">Disclosure content</div>
            </Disclosure>
          </div>
          <Breadcrumb data-gallery-family="breadcrumb">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Workspace</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbCurrent>Gallery</BreadcrumbCurrent>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex gap-4" data-gallery-family="link">
            <Link href="#gallery-table">Inline link</Link>
            <Link href="#gallery-table" variant="navigation">
              Navigation link
            </Link>
            <Link href="https://example.com" variant="external" target="_blank">
              External link
            </Link>
          </div>
        </Section>

        <Section title={text.data}>
          <div id="gallery-table" data-gallery-family="table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow aria-selected="true">
                  <TableCell>Alpha</TableCell>
                  <TableCell>
                    <Badge tone="success">Ready</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Beta</TableCell>
                  <TableCell>
                    <Badge tone="warning">Pending</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div data-gallery-family="pagination">
              <Pagination
                className="mt-4"
                page={page}
                pageCount={4}
                onPageChange={setPage}
              />
            </div>
          </div>
          <DataGrid label="Example data grid" data-gallery-family="data-grid">
            <DataGridHeader>
              <DataGridRow>
                <DataGridHead>Artifact</DataGridHead>
                <DataGridHead>Owner</DataGridHead>
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody>
              <DataGridRow aria-selected="true">
                <DataGridCell tabIndex={0}>Audit package</DataGridCell>
                <DataGridCell>Runtime</DataGridCell>
              </DataGridRow>
            </DataGridBody>
          </DataGrid>
          <TreeView label="Example tree" data-gallery-family="tree-view">
            <TreeItem expanded selected>
              Workspace
            </TreeItem>
            <TreeItem level={2}>Artifact</TreeItem>
          </TreeView>
          <div
            className="flex h-24 rounded-card border border-[var(--theme-border)]"
            data-gallery-family="resize-split-panel"
          >
            <div className="grid flex-1 place-items-center">{split}%</div>
            <ResizeHandle value={split} onValueChange={setSplit} />
            <div className="grid flex-1 place-items-center">{100 - split}%</div>
          </div>
          <SplitPanel
            className="h-24"
            value={split}
            onValueChange={setSplit}
            primary={
              <div className="grid h-full place-items-center">Primary</div>
            }
            secondary={
              <div className="grid h-full place-items-center">Secondary</div>
            }
          />
          <div data-gallery-family="canvas-control-layer">
            <CanvasControlLayer
              label="Example graph"
              controls={
                <>
                  <Button size="icon-sm" aria-label="Zoom in">
                    +
                  </Button>
                  <Button size="icon-sm" aria-label="Zoom out">
                    −
                  </Button>
                </>
              }
              accessibleFallback={
                <ul>
                  <li>Node A connects to Node B</li>
                </ul>
              }
            >
              <div className="grid h-40 place-items-center bg-[var(--theme-card2)]">
                <span className="rounded-full bg-[var(--theme-accent)] px-4 py-2 text-xs leading-[1.5] font-semibold text-[var(--theme-accent-foreground)]">
                  Graph canvas
                </span>
              </div>
            </CanvasControlLayer>
          </div>
          <ScrollAreaRoot className="h-24" data-gallery-family="scroll-area">
            <ScrollAreaViewport>
              <div className="grid gap-2 p-2">
                {Array.from({ length: 12 }, (_, index) => (
                  <div key={index}>Scrollable row {index + 1}</div>
                ))}
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar>
              <ScrollAreaThumb />
            </ScrollAreaScrollbar>
          </ScrollAreaRoot>
          <div className="flex items-center gap-3" aria-live="polite">
            <ThreeDotsSpinner /> <BrailleSpinner label="Loading gallery" />{' '}
            Loading state
          </div>
        </Section>
      </div>
    </main>
  )
}

export { DesignSystemGallery }
