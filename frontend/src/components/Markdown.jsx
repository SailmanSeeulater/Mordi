import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { linkify } from '../lib/markdown';

/**
 * Only the two private schemes are let through beyond the renderer's own safe
 * list. Everything else goes through defaultUrlTransform, which is what turns
 * a `javascript:` link in a note into nothing. Raw HTML in a note is never
 * rendered: react-markdown escapes it unless told otherwise.
 */
function urlTransform(url) {
  if (url.startsWith('note:') || url.startsWith('tag:')) return url;
  return defaultUrlTransform(url);
}

/** react-markdown hands each component its syntax-tree node; the DOM must not get it. */
function omitNode(props) {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

/*
 * Headings inside a note sit under the dialog's own heading, so they are
 * shifted down: a note's "# Title" is an h3 on the page, not a second h1.
 */
const shift = (Tag) =>
  function Heading(props) {
    return <Tag {...omitNode(props)} />;
  };

/**
 * A note rendered the way Obsidian's reading view does: GitHub-flavoured
 * Markdown (tables, task lists, strikethrough), with [[links]] that open the
 * note they name and #tags shown as chips.
 */
export default function Markdown({ source, onOpenNote, onTag, resolve }) {
  const components = {
    h1: shift('h3'),
    h2: shift('h4'),
    h3: shift('h5'),
    h4: shift('h6'),
    h5: shift('h6'),
    h6: shift('h6'),
    a(allProps) {
      const { href = '', children, ...props } = omitNode(allProps);
      if (href.startsWith('note:')) {
        const name = decodeURIComponent(href.slice(5));
        const exists = resolve ? Boolean(resolve(name)) : true;
        return (
          <button
            type="button"
            className={`md-wikilink${exists ? '' : ' md-wikilink--missing'}`}
            onClick={() => onOpenNote?.(name)}
            title={exists ? `Open “${name}”` : `No note called “${name}” yet`}
          >
            {children}
          </button>
        );
      }
      if (href.startsWith('tag:')) {
        const tag = decodeURIComponent(href.slice(4));
        return onTag ? (
          <button type="button" className="md-tag" onClick={() => onTag(tag)}>
            {children}
          </button>
        ) : (
          <span className="md-tag">{children}</span>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
  };

  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
        {linkify(source)}
      </ReactMarkdown>
    </div>
  );
}
