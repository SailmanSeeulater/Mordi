/* The four goal categories, and the mark each one uses.
   Kept out of the form component so the dashboard can draw the same mark on a
   goal pass without importing a component module for a constant. */

const catIcon = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export const CATEGORY_ICONS = {
  fitness: (
    <svg {...catIcon}>
      <path d="M6 7v10M18 7v10M3 12h18" />
    </svg>
  ),
  sleep: (
    <svg {...catIcon}>
      <path d="M20 14.5A8 8 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
    </svg>
  ),
  productivity: (
    <svg {...catIcon}>
      <path d="M12 3v3.5M12 21v-3.5M3 12h3.5M21 12h-3.5" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  health: (
    <svg {...catIcon}>
      <path d="M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z" />
    </svg>
  ),
};

export const CATEGORY_OPTIONS = [
  { value: '', label: 'No category' },
  { value: 'fitness', label: 'Fitness', icon: CATEGORY_ICONS.fitness },
  { value: 'sleep', label: 'Sleep', icon: CATEGORY_ICONS.sleep },
  { value: 'productivity', label: 'Productivity', icon: CATEGORY_ICONS.productivity },
  { value: 'health', label: 'Health', icon: CATEGORY_ICONS.health },
];
