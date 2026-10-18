/* Goal icons and categories.

   Every goal shows an icon: the one chosen for it, else its category's, else
   the thumbtack. The icons are drawn here, all on one 24 grid at one 1.9
   stroke, and kept out of the form component so the dashboard, the Goals page
   and Together can draw the same mark without importing a component module.

   ICON_KEYS is also the list the backend accepts (Icons.KEYS in
   backend/src/main/java/com/mordi/backend/service/Icons.java). Add a key in
   both places, or not at all. */

const iconSvg = {
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

/* Each icon's drawing, and the name a screen reader gives it in the picker. */
const DRAWN = [
  [
    'thumbtack',
    'Thumbtack',
    <path d="M8.5 3.5h7M10 3.5v5L7 12.5h10l-3-4v-5M12 12.5V21" />,
  ],
  ['fitness', 'Dumbbell', <path d="M6 7v10M18 7v10M3 12h18" />],
  ['sleep', 'Moon', <path d="M20 14.5A8 8 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />],
  [
    'productivity',
    'Focus',
    <>
      <path d="M12 3v3.5M12 21v-3.5M3 12h3.5M21 12h-3.5" />
      <circle cx="12" cy="12" r="3.2" />
    </>,
  ],
  ['health', 'Heart', <path d="M12 20s-7-4.4-7-9a4 4 0 017-2.6A4 4 0 0119 11c0 4.6-7 9-7 9z" />],
  [
    'book',
    'Book',
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z" />
      <path d="M12 6.5v13" />
    </>,
  ],
  [
    'run',
    'Running shoe',
    <>
      <path d="M3 17V8l4 2 2.5-2.5L13 11l5.5 1.6A3.5 3.5 0 0121 16v1z" />
      <path d="M3 20.5h18" />
    </>,
  ],
  ['water', 'Water drop', <path d="M12 3.5s-6 6.6-6 11a6 6 0 0012 0c0-4.4-6-11-6-11z" />],
  [
    'pen',
    'Pen',
    <>
      <path d="M15.5 4.5l4 4L8.5 19.5l-5 1 1-5z" />
      <path d="M13 7l4 4" />
    </>,
  ],
  [
    'music',
    'Music note',
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>,
  ],
  [
    'leaf',
    'Leaf',
    <>
      <path d="M4.5 19.5C4.5 10.5 10 5 19.5 4.5 19 14 13.5 19.5 4.5 19.5z" />
      <path d="M4.5 19.5L13 11" />
    </>,
  ],
  [
    'sun',
    'Sun',
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>,
  ],
  [
    'coffee',
    'Coffee cup',
    <>
      <path d="M4 9h12v5a5 5 0 01-5 5H9a5 5 0 01-5-5z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 010 5H16M8 3.5v2M12 3.5v2" />
    </>,
  ],
  [
    'laptop',
    'Laptop',
    <>
      <rect x="4.5" y="5" width="15" height="10" rx="1.5" />
      <path d="M2.5 19h19" />
    </>,
  ],
  [
    'lightbulb',
    'Light bulb',
    <>
      <path d="M9 14.5A6 6 0 1115 14.5c-.7.6-1 1.3-1 2v1h-4v-1c0-.7-.3-1.4-1-2z" />
      <path d="M10.5 21h3" />
    </>,
  ],
  [
    'coin',
    'Coin',
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8M12 16v1.5" />
    </>,
  ],
  [
    'people',
    'People',
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0111 0M15.5 5.8a3 3 0 010 5.4M17 14.2a5.5 5.5 0 013.5 4.8" />
    </>,
  ],
  [
    'paw',
    'Paw print',
    <>
      <circle cx="6.5" cy="10.5" r="1.6" />
      <circle cx="10" cy="6.5" r="1.6" />
      <circle cx="14" cy="6.5" r="1.6" />
      <circle cx="17.5" cy="10.5" r="1.6" />
      <path d="M12 12c-2.8 0-5 3.2-5 5.3 0 1.4 1.1 2.2 2.4 2.2 1 0 1.6-.5 2.6-.5s1.6.5 2.6.5c1.3 0 2.4-.8 2.4-2.2 0-2.1-2.2-5.3-5-5.3z" />
    </>,
  ],
  [
    'speech',
    'Speech bubble',
    <path
      d="M5 4.5h14A1.5 1.5 0 0120.5 6v9a1.5 1.5 0 01-1.5 1.5h-8L6.5 20v-3.5H5A1.5 1.5 0 013.5 15V6A1.5 1.5 0 015 4.5z"
    />,
  ],
  [
    'sparkle',
    'Sparkle',
    <>
      <path d="M11 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z" />
      <path d="M18.5 15.5v5M16 18h5" />
    </>,
  ],
  [
    'check',
    'Tick',
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.3l2.7 2.7L16 9.5" />
    </>,
  ],
];

/** Every key the picker offers, thumbtack first. */
export const ICON_KEYS = DRAWN.map(([key]) => key);

/** Each key's spoken name, for the picker's radios. */
export const ICON_LABELS = Object.fromEntries(DRAWN.map(([key, label]) => [key, label]));

/** key → a 15px drawn icon. Size it larger with CSS width and height. */
export const ICONS = Object.fromEntries(
  DRAWN.map(([key, , drawing]) => [key, <svg {...iconSvg}>{drawing}</svg>]),
);

/** The four built-in categories. Each one's icon has the same key. */
export const BUILT_IN_CATEGORIES = [
  { value: 'fitness', label: 'Fitness' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'health', label: 'Health' },
];

const BUILT_IN_LABELS = Object.fromEntries(BUILT_IN_CATEGORIES.map((c) => [c.value, c.label]));

export const CATEGORY_ICONS = {
  fitness: ICONS.fitness,
  sleep: ICONS.sleep,
  productivity: ICONS.productivity,
  health: ICONS.health,
};

export const CATEGORY_OPTIONS = [
  { value: '', label: 'No category' },
  ...BUILT_IN_CATEGORIES.map((c) => ({ ...c, icon: CATEGORY_ICONS[c.value] })),
];

const isKey = (key) => typeof key === 'string' && Object.hasOwn(ICONS, key);

/**
 * The goal's category as { label, icon }: a built-in one, one of the person's
 * own (from their list, or as the server described it on the goal, which is
 * how someone in a shared goal sees the owner's), or null for none.
 */
export function goalCategory(goal, customCategories = []) {
  const value = goal?.category;
  if (!value) return null;
  if (BUILT_IN_LABELS[value]) return { label: BUILT_IN_LABELS[value], icon: value };
  const own = customCategories.find((c) => c.key === value);
  if (own) return { label: own.name, icon: isKey(own.icon) ? own.icon : 'thumbtack' };
  if (goal.categoryName) {
    return { label: goal.categoryName, icon: isKey(goal.categoryIcon) ? goal.categoryIcon : 'thumbtack' };
  }
  return null;
}

/** The key of the icon a goal shows: its own, else its category's, else the thumbtack. */
export function goalIconKey(goal, customCategories = []) {
  if (isKey(goal?.icon)) return goal.icon;
  return goalCategory(goal, customCategories)?.icon ?? 'thumbtack';
}

/** The icon a goal shows, drawn. */
export function goalIcon(goal, customCategories = []) {
  return ICONS[goalIconKey(goal, customCategories)];
}
