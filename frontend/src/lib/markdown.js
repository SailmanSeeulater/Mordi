/**
 * Notes are Markdown, with two Obsidian habits on top:
 *
 *   [[Other note]]   links to another note by its heading
 *   #tag             tags a note
 *
 * Both are rewritten into ordinary Markdown links with private schemes
 * (note:, tag:) before rendering, so the renderer only ever sees standard
 * Markdown and the component decides what those links do. Code is left
 * alone: `#include` in a code span is not a tag.
 */

const FENCE = /^\s*(```|~~~)/;

/** Rewrites the text outside code spans; code spans pass through untouched. */
function outsideInlineCode(line, rewrite) {
  return line
    .split(/(`+[^`]*`+)/)
    .map((part, i) => (i % 2 === 1 ? part : rewrite(part)))
    .join('');
}

const WIKILINK = /\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g;
// A tag starts at a word boundary, begins with a letter, and is not a heading
// marker (which needs a space after the #) or part of a URL fragment.
const TAG = /(^|[\s(])#([A-Za-z][\w/-]{0,39})/g;

const escapeLabel = (s) => s.replace(/[[\]]/g, '\\$&');

/** Markdown with [[links]] and #tags turned into note: and tag: links. */
export function linkify(markdown) {
  let inFence = false;
  return (markdown ?? '')
    .split('\n')
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return outsideInlineCode(line, (text) =>
        text
          .replace(WIKILINK, (_, target, alias) => {
            const name = target.trim();
            return `[${escapeLabel((alias ?? name).trim())}](note:${encodeURIComponent(name)})`;
          })
          .replace(TAG, (_, lead, tag) => `${lead}[#${tag}](tag:${encodeURIComponent(tag)})`),
      );
    })
    .join('\n');
}

/** A note's heading: its title, or else its first line without Markdown marks. */
export function noteHeading(note) {
  if (note?.title) return note.title;
  const first = (note?.body ?? '').split('\n').find((l) => l.trim()) ?? '';
  return plainText(first).slice(0, 120) || 'Untitled';
}

/** Markdown reduced to readable plain text, for list excerpts. */
export function plainText(markdown) {
  return (markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    // Link targets may hold one level of parentheses: (javascript:alert(1)).
    .replace(/!\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
    .replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_, t, a) => a ?? t)
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/gm, '')
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The body minus the line the heading already showed, as plain text. */
export function noteExcerpt(note) {
  const body = note?.body ?? '';
  if (note?.title) return plainText(body);
  const lines = body.split('\n');
  const first = lines.findIndex((l) => l.trim());
  return plainText(lines.slice(first + 1).join('\n'));
}

const key = (s) => s.trim().toLowerCase();

/** The note a [[link]] points at, matched by heading, ignoring case. */
export function findNote(notes, name) {
  const wanted = key(name);
  return notes.find((n) => key(noteHeading(n)) === wanted) ?? null;
}

/** Notes that link to this one. */
export function backlinks(notes, note) {
  const target = key(noteHeading(note));
  return notes.filter((other) => {
    if (other.id === note.id) return false;
    for (const [, link] of (other.body ?? '').matchAll(WIKILINK)) {
      if (key(link) === target) return true;
    }
    return false;
  });
}

/** Every distinct #tag in a note, in order of first appearance. */
export function tagsOf(note) {
  const seen = new Set();
  const out = [];
  for (const [, , tag] of linkify(note?.body ?? '').matchAll(/\[#([^\]]+)\]\(tag:([^)]+)\)/g)) {
    const name = decodeURIComponent(tag);
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}
