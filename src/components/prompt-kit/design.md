# prompt-kit — Design Notes

## The `borderless-textarea` pattern

### What it is

A reusable opt-out slot for textareas that should render flat — no
border, no ring, no focus glow. The first consumer is the chat
composer (`PromptInputTextarea`), but the slot is intentionally generic
so any future "this textarea lives inside an already-active container"
case (command palette, inline editor, search bar) can drop it in.

### Why opt out at all

The shared `Textarea` (and the `[data-slot='textarea']` rules in
`styles.css`) is the right default for forms: an accent border on
focus and a 4 px accent-subtle ring give keyboard users a clear
focus signal.

That same styling becomes visual noise when the textarea is already
inside an active container. The chat composer's parent panel is the
focus region — there is no second focus to indicate. Painting another
border + glow tells the user nothing useful and breaks the clean
premium feel of the composer.

### The rule we follow

**A shared base component's styling owns the default. A component that
needs to opt out of that default opts out by switching its `data-slot`,
not by stacking `!important` utilities.**

### Why not `!important`

A working "kill every border and highlight" override ends up looking
like:

```tsx
className={cn(
  '... !border-0 !bg-transparent !shadow-none !outline-none !ring-0 ' +
  'focus:!border-transparent focus-visible:!border-transparent ' +
  'focus:!shadow-none focus-visible:!shadow-none ' +
  'focus:!ring-0 focus-visible:!ring-0 ...',
  className,
)}
```

This is brittle for three reasons:

1. **Specificity arms race.** Any later global rule that targets
   `[data-slot='textarea']` with comparable or higher specificity
   (e.g. `[data-theme='...'] [data-slot='textarea']:focus-visible`)
   beats plain utility classes. You can confirm by reading the global
   rule above this comment in `styles.css` — accent border + 4 px glow
   kept reappearing despite `border-0` and `shadow-none`. The next
   time someone tightens a selector in `styles.css`, the chat composer
   regresses silently.
2. **One-off divergence.** Other textareas in the app (settings,
   profile, forms) still need the accent focus indicator. The chat
   composer is the outlier, but the `!important` chain doesn't signal
   that — it just looks like an over-defensive override on a normal
   form control.
3. **Maintenance tax.** Every new global focus style (e.g. an
   `outline-offset`, a `transition`) needs another `focus:!something`
   appended to this list.

### The right move: dedicated `data-slot`

The shared `Textarea` component hard-codes `data-slot="textarea"`.
Consumers that need the flat treatment pass
`data-slot="borderless-textarea"` via `{...props}`. Because `{...props}`
spreads AFTER the hard-coded attribute on the textarea element, the
override wins.

Now the global rules

```css
:is([data-theme='semantier'], [data-theme='semantier-light'])
  :is([data-slot='textarea'], [data-slot='file-input'], [data-slot='native-select']) {
  border: 1.5px solid var(--theme-border);
  ...
}

:is([data-theme='semantier'], [data-theme='semantier-light'])
  :is([data-slot='textarea'], [data-slot='file-input'], [data-slot='native-select']):focus-visible {
  border-color: var(--theme-accent);
  box-shadow: 0 0 0 4px var(--theme-accent-subtle);
}
```

never match the borderless element. The element is invisible to the
global form rules.

We then declare the borderless style at the same theme selector but on
the new slot, so the rule is theme-scoped and inherits the
`[data-theme='...']` gating:

```css
:is([data-theme='semantier'], [data-theme='semantier-light'])
  [data-slot='borderless-textarea'] {
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  box-shadow: none;
  outline: none;
  font-weight: inherit;
}

:is([data-theme='semantier'], [data-theme='semantier-light'])
  [data-slot='borderless-textarea']:focus,
:is([data-theme='semantier'], [data-theme='semantier-light'])
  [data-slot='borderless-textarea']:focus-visible {
  border: 0;
  box-shadow: none;
  outline: none;
}
```

Specificity of the override is `(0, 2, 0)` — same as the base rule but
declared later, and the base rule's selector never matches the
borderless slot anyway. No `!important` involved.

### Specificity math

| Selector                                                                  | Specificity |
| ------------------------------------------------------------------------- | ----------- |
| `.border-0` (Tailwind utility)                                            | `(0, 1, 0)` |
| `:is([data-theme='semantier']) [data-slot='textarea']` (base rule)        | `(0, 2, 0)` |
| `:is([data-theme='semantier']) [data-slot='borderless-textarea']` (override) | `(0, 2, 0)` |

Tailwind utilities alone lose to the themed base rule. Adding `!`
prefixes can win, but at the cost of the three problems above. The
dedicated-slot approach wins at equal specificity because the base
selector simply doesn't match.

### Component className after the refactor

```tsx
<Textarea
  ...
  className={cn(
    'min-h-[28px] w-full resize-none pl-4 pr-1 py-2 md:py-0 ' +
    'text-base placeholder:text-primary-500',
    className,
  )}
  data-slot="borderless-textarea"
  ...
/>
```

The className carries only what's component-specific (sizing, padding,
placeholder color). All "flat by design" decisions live in `styles.css`
next to the rest of the theme system, where future designers will find
them — and where a new consumer (command palette, inline editor) can
opt in by passing the same `data-slot`.

### When to use this pattern

Reach for `data-slot="borderless-textarea"` when:

- The textarea lives inside an already-active container (chat
  composer, command palette, inline editor, search bar) and the
  default focus indicator would be noise rather than signal.
- The override would otherwise require `!important` or a long
  `cn(...)` chain to defeat higher-specificity global rules.
- The opt-out is **stable design intent**, not a one-time hack — the
  chat composer will always be flat.

Don't reach for it when:

- The override is a single property tweak (just use a class).
- The opt-out is temporary or experimental — use a comment, don't
  invent a slot.
- You want a different *style* of border, not no border — reach for a
  new variant (e.g. `data-slot='textarea-outline'`) instead of
  overloading this one.