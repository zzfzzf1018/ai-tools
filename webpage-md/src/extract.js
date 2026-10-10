import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import gfmPlugin from 'turndown-plugin-gfm';

const marker = 'data-webpage-md-id';
const textMarker = 'data-webpage-md-text';
const noise = 'script, style, noscript, template, iframe, object, embed, svg, canvas, [hidden], [aria-hidden="true"]';

export function validateUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }
  if (url.username || url.password) {
    throw new Error('URLs containing credentials are not supported.');
  }
  return url.href;
}

function imageUrl(value, document) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function restoreImages(document) {
  for (const noscript of document.body.querySelectorAll('noscript')) {
    const template = document.createElement('template');
    template.innerHTML = noscript.innerHTML;
    const image = template.content.firstElementChild;
    if (template.content.children.length !== 1 || image?.tagName !== 'IMG'
      || template.content.textContent.trim()) continue;
    const source = imageUrl(image.getAttribute('src'), document);
    if (!source) continue;
    image.setAttribute('src', source);
    const previous = noscript.previousElementSibling;
    if (previous?.tagName === 'IMG') {
      if (!image.hasAttribute('alt') && previous.hasAttribute('alt')) {
        image.setAttribute('alt', previous.getAttribute('alt'));
      }
      previous.replaceWith(image);
    } else {
      noscript.before(image);
    }
  }
  for (const image of document.body.querySelectorAll('img')) {
    for (const attribute of ['data-src', 'data-original', 'data-lazy-src']) {
      const source = imageUrl(image.getAttribute(attribute), document);
      if (source) {
        image.setAttribute('src', source);
        break;
      }
    }
  }
}

function clean(document) {
  document.querySelectorAll(noise).forEach((node) => node.remove());
  for (const node of document.querySelectorAll('[href], [src]')) {
    for (const attribute of ['href', 'src']) {
      const value = node.getAttribute(attribute);
      if (!value) continue;
      try {
        const url = new URL(value, document.baseURI);
        const allowed = attribute === 'href'
          ? ['http:', 'https:', 'mailto:', 'tel:']
          : ['http:', 'https:'];
        if (allowed.includes(url.protocol)) node.setAttribute(attribute, url.href);
        else node.removeAttribute(attribute);
      } catch {
        node.removeAttribute(attribute);
      }
    }
  }
}

function markContent(document) {
  // Readability creates new paragraphs and can drop their container attributes.
  // Mark text itself with neutral inline spans so provenance survives the move.
  const walker = document.createTreeWalker(document.body, 4);
  const textNodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.textContent.trim()
      && !walker.currentNode.parentElement.closest('pre, code')) {
      textNodes.push(walker.currentNode);
    }
  }
  for (const text of textNodes) {
    const span = document.createElement('span');
    span.setAttribute(textMarker, '');
    text.replaceWith(span);
    span.append(text);
  }
  [document.body, ...document.body.querySelectorAll('*')].forEach((node, index) => {
    node.setAttribute(marker, String(index));
  });
}

function unwrapTextMarkers(document) {
  document.querySelectorAll(`[${textMarker}]`).forEach((span) => {
    span.replaceWith(...span.childNodes);
  });
}

function markdown(html) {
  const converter = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  converter.use(gfmPlugin.gfm);
  converter.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement: (content) => `~~${content}~~`,
  });
  return converter.turndown(html).trim();
}

// Readability may keep a wrapper but discard some of its children. Remove
// retained text, not entire wrappers, so those discarded children stay available.
function removeRetainedContent(document, articleDocument) {
  const originals = new Map(
    [...document.querySelectorAll(`[${marker}]`)]
      .map((element) => [element.getAttribute(marker), element]),
  );
  for (const retained of articleDocument.querySelectorAll(`[${marker}]`)) {
    const original = originals.get(retained.getAttribute(marker));
    if (!original) continue;
    if (original.hasAttribute(textMarker) || ['IMG', 'BR', 'HR'].includes(original.tagName)) {
      original.remove();
      continue;
    }
    for (const child of [...original.childNodes]) {
      if (child.nodeType === 3) child.remove();
    }
  }
  for (const element of [...document.body.querySelectorAll('*')].reverse()) {
    if (!element.textContent.trim() && !element.querySelector('img') && element.tagName !== 'IMG') {
      element.remove();
    }
  }
}

export function extractPage(html, { url, selector } = {}) {
  const sourceUrl = validateUrl(url);
  const dom = new JSDOM(html, { url: sourceUrl });
  const document = dom.window.document;
  let articleDom;
  try {
    restoreImages(document);
    clean(document);
    // Resolve the user selector before introducing internal tracking spans.
    const matches = selector ? document.querySelectorAll(selector) : null;
    if (matches && matches.length !== 1) {
      throw new Error(`The content selector must match exactly one element; matched ${matches.length}.`);
    }
    markContent(document);
    let article;
    if (selector) {
      article = {
        title: matches[0].querySelector('h1')?.textContent.trim() || document.title,
        content: matches[0].outerHTML,
        textContent: matches[0].textContent,
      };
    } else {
      article = new Readability(document.cloneNode(true), {
        charThreshold: 80,
        keepClasses: true,
      }).parse();
    }
    if (!article?.textContent?.trim()) {
      throw new Error('No article content found. Try --render or --selector with the article container.');
    }
    articleDom = new JSDOM(article.content, { url: sourceUrl });
    const articleDocument = articleDom.window.document;
    clean(articleDocument);
    removeRetainedContent(document, articleDocument);
    unwrapTextMarkers(articleDocument);
    unwrapTextMarkers(document);
    const title = (article.title || document.title || new URL(sourceUrl).hostname)
      .replace(/\s+/g, ' ').trim();
    // The document header supplies the title; avoid repeating the same H1.
    articleDocument.querySelectorAll('h1').forEach((heading) => {
      if (heading.textContent.replace(/\s+/g, ' ').trim() === title) heading.remove();
    });
    const content = markdown(articleDocument.body.innerHTML);
    if (!content) throw new Error('The extracted article has no Markdown content.');
    return {
      title,
      content,
      extras: markdown(document.body.innerHTML),
      metadata: {
        title,
        url: sourceUrl,
        author: article.byline || null,
        description: article.excerpt || null,
        siteName: article.siteName || null,
        language: article.lang || document.documentElement.lang || null,
        extraction: selector ? 'selector' : 'readability',
        selector: selector || null,
        textLength: article.textContent.trim().length,
      },
      warnings: article.textContent.trim().length < 200
        ? ['The extracted content is short. Check the output; consider --render or --selector.']
        : [],
    };
  } finally {
    articleDom?.window.close();
    dom.window.close();
  }
}
