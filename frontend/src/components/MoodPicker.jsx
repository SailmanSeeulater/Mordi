const face = {
  className: 'mood-pick__face',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

/* One drawn face per step of the scale. The mouth is the only thing that
   changes, so the five read as one scale rather than five unrelated icons. */
const Face = ({ mouth, brow }) => (
  <svg {...face}>
    <circle cx="12" cy="12" r="9" />
    {brow ?? (
      <>
        <path d="M8.6 10h.01" />
        <path d="M15.4 10h.01" />
      </>
    )}
    <path d={mouth} />
  </svg>
);

const MOODS = [
  { value: 'great', label: 'Great', mouth: 'M7.6 13.4a5.2 5.2 0 008.8 0' },
  { value: 'good', label: 'Good', mouth: 'M8.4 14.2a4.6 4.6 0 007.2 0' },
  { value: 'neutral', label: 'Okay', mouth: 'M8.6 14.6h6.8' },
  { value: 'bad', label: 'Low', mouth: 'M8.4 15.6a4.6 4.6 0 017.2 0' },
  { value: 'terrible', label: 'Rough', mouth: 'M7.6 16.2a5.2 5.2 0 018.8 0' },
];

/**
 * The mood scale, as five tiles instead of a dropdown. Five is short enough
 * that hiding four of them behind a menu costs a tap and hides the range.
 * Implemented as a labelled group of toggles, which is how a screen reader
 * reports a single-choice row of buttons.
 */
export default function MoodPicker({ value, onChange, labelledBy }) {
  return (
    <div className="mood-pick" role="group" aria-labelledby={labelledBy}>
      {MOODS.map((mood) => (
        <button
          key={mood.value}
          type="button"
          className="mood-pick__btn"
          aria-pressed={mood.value === value}
          onClick={() => onChange(mood.value)}
        >
          <Face mouth={mood.mouth} />
          {mood.label}
        </button>
      ))}
    </div>
  );
}
