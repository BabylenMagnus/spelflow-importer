# Product

## Register

product

## Users

Two equally important profiles:

**Developer**: works in GitHub/GitLab all day, captures individual issues into Spelflow mid-flow. Uses the extension solo, without switching context. Expects it to feel like a natural extension of the IDE ecosystem — precise, fast, no ceremony.

**Team lead / PM**: collects issues from multiple sources, reviews the basket, routes tasks into the right project. Evaluates the review tab like a mini-triage workspace — needs clarity on what's in the queue and where it's going.

Both users already use Spelflow (Hub) daily. The extension is a bridge: it should feel like part of Hub, not a third-party tool grafted onto GitHub.

## Product Purpose

A Chrome extension that captures GitHub and GitLab issues into Hub's import basket. The user browses an issue, clicks one button, and the task lands in their Spelflow workspace with title, body, and labels intact. The review tab lets them select destination workspace + project and import in batch.

Success: the user captures an issue in under 3 seconds without losing their reading flow. The captured issue appears in Hub correctly categorized.

## Brand Personality

Hub-native. Precise. Quiet confidence.

The extension is a satellite of Hub — it speaks the same visual language. Not a standalone product, not a GitHub skin. Someone who uses Hub daily should open the popup and feel immediately at home: same teal, same IBM Plex Sans, same restrained density.

Three words: **Precise. Native. Unobtrusive.**

## Anti-references

- **GitHub UI mimicry** — green `#2da44e` button, GitHub's font stack, GitHub's gray palette. The extension currently looks like GitHub. It should look like Hub.
- **Cheap Chrome extensions** — gradient backgrounds, loud badges, Bootstrap-style buttons, heavy drop shadows, toy-like color schemes.
- **Dark hacker aesthetic** — terminal green, overly dense monospace UI, DevTools-imitating layouts.
- **Enterprise SaaS bloat** — multi-step wizards, settings panels, dashboards inside a popup. The popup is 240px wide; every element earns its place.

## Design Principles

1. **Hub-native first** — every visual token comes from the Hub design system (OKLCH teal, IBM Plex Sans, surface/border tokens). Someone looking at the extension and the Hub app should see the same design language.
2. **One action at a time** — the popup has one primary action. The review tab has one primary action. No competing CTAs.
3. **State is the UI** — the popup changes entirely based on connection state (disconnected / connected+empty / connected+basket). Each state is a complete, purposeful screen, not a partially hidden form.
4. **Feedback is instant** — capture confirmation, import progress, and errors are visible within 200ms. No spinners that block the next action.
5. **Unobtrusive on the host page** — the inject button (Capture to Spelflow) must not fight the host page's layout. It sits at a fixed position, appears when needed, and does not overlay critical content.

## Accessibility & Inclusion

WCAG AA minimum. Focus states use Hub's `--brand` outline (2px, offset 2px). Extension popup is keyboard-navigable. All status changes announced via `aria-live` for screen readers. `prefers-reduced-motion` respected for transition animations.
