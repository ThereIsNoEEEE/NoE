# Taste variant

Skill: `/Users/bong/.codex/skills/design-taste-frontend/SKILL.md`.

Reading this as a preserved campus notice product for university students, with a confident warm editorial language. Design variance 4, motion intensity 2, visual density 5. Apply the skill contextually: the existing product layout and real three-card TOP 3 are explicit requirements, so marketing layout prohibitions do not override them.

## Tokens

- Selected dark palette: navy charcoal `#10151c`, text `#f2f5fa`, readable blue tint `#93bbed`.
- Selected light palette: cool white `#f3f6fa`, text `#15283f`, official KMU Blue `#004f9f`.
- Native system sans with tight headline tracking; no new font network requests.
- Card radius 14px; controls 6px; native onboarding dialog 18px.
- Restrained hover feedback with reduced-motion support.

## Preserved

Left navigation, topbar, desktop three-card grid, statistics below it, real poster imagery, notice detail, floating chatbot, backend and recommendation behavior.

## Changed

Official KMU blue/orange palette in both modes, calmer source metadata, stronger headline rhythm, top-cropped full poster images, ruled statistics strip, focused native dialog for first profile setup on the real dashboard background. Native dialog provides focus containment, Escape dismissal, backdrop and mobile scrolling. Save uses existing profile validation and onboarding persistence. Explore/close does not write onboarding completion.

## Preview

`?preview=home` bypasses initial setup for comparison. `?preview=onboarding` opens initial setup even if profile was previously saved. Both can be dismissed; actual default behavior still depends on existing onboarding storage.

## Scroll and chat follow-up

Shared `app/scroll-and-chat.css` adapts `sokind-admin/src/styles/globals.css`'s `scrollbar-minimal`: thin transparent-track bars become visible on hover/focus, with touch support. The chatbot now opens as a modeless bottom-right dock, without a full-screen backdrop or page scroll lock, and remains usable while reading the page.

Bounded Taste review fixes: explicitly scrollable centered native profile dialog, narrow-grid containment, 16px mobile profile inputs to avoid iOS focus zoom, comfortable submit/explore touch targets, and Space-key activation on home notice cards.

## Selected school palette

The user chose Taste (variant 1) with the yellow/orange/green wings of the supplied KMU emblem. Official [KMU UI](https://www.kookmin.ac.kr/comm/menu/user/0a4f7cf187cc3164678352bc3f4575b3/content/index.do) supplies Yellow #FFCE44, Orange #F3953F, Light Green #95C23D and Green #00A470. Blue #004F9F remains a brand token, not the primary interface accent. app/kmu-brand.css owns orange primary actions, green selected/saved states and yellow rank emphasis. Dark surfaces are forest-charcoal, light surfaces white/soft green. Small colored text uses contrast-adjusted shades.

## First-visit popup

Two compact steps: academic information, then interests. Existing validation/save remains. No internal scrolling; custom interests/keywords remain in My Information. Back, dismiss and explore are available. Page layout and chatbot position remain unchanged.
