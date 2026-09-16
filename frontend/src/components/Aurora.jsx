/**
 * The ambient ground: three soft blooms drifting behind everything.
 *
 * Three separate elements rather than three background layers on one, because
 * the point is that they move independently — they cross each other, so the
 * colour mixing behind the glass changes rather than the whole wash sliding
 * across. One layer could only translate as a unit.
 *
 * Fixed, inert, and behind all content. Nothing here reacts to anything.
 */
export default function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora__orb aurora__orb--1" />
      <span className="aurora__orb aurora__orb--2" />
      <span className="aurora__orb aurora__orb--3" />
    </div>
  );
}
