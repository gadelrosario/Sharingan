# Animations

## Timing

- Micro interaction: `120ms`
- Standard transition: `150ms`
- Panel transition: `200ms`
- Major state change: `250ms`

## Easing

Use:

`ease`

or:

`cubic-bezier(0.2, 0.8, 0.2, 1)`

## Allowed Uses

- Button hover
- Card selection
- Panel expansion
- Recommendation updates
- Confidence changes
- Status indicators

## Avoid

- Repeated pulsing
- Large bouncing motions
- Long page-entry animations
- Motion that delays a live draft decision
- Flashing effects

## Reduced Motion

All nonessential motion should respect:

`prefers-reduced-motion`
