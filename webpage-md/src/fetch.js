import { JSDOM } from 'jsdom';
import { validateUrl } from './extract.js';

export async function fetchPage(value, { timeout = 30000, render = false, waitFor } = {}) {
  const url = validateUrl(value);
  if (render) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const response = await page.goto(url, {
        waitUntil: waitFor ? 'domcontentloaded' : 'networkidle',
        timeout,
      });
      if (!response) throw new Error('The browser did not receive a page response.');
      if (!response.ok()) throw new Error(`HTTP ${response.status()} while fetching ${url}`);
      const contentType = response.headers()['content-type'] || '';
      checkContentType(contentType);
      if (waitFor) await page.locator(waitFor).first().waitFor({ state: 'visible', timeout });
      return {
        html: await page.content(),
        url: validateUrl(page.url()),
        contentType: contentType || null,
      };
    } finally {
      await browser.close();
    }
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      'User-Agent': 'webpage-md/1.0 (article-to-markdown)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  const contentType = response.headers.get('content-type') || '';
  checkContentType(contentType);
  // Let jsdom sniff charset headers and HTML meta tags, not just assume UTF-8.
  const dom = new JSDOM(Buffer.from(await response.arrayBuffer()), {
    url: validateUrl(response.url),
    ...(contentType ? { contentType } : {}),
  });
  try {
    return { html: dom.serialize(), url: response.url, contentType: contentType || null };
  } finally {
    dom.window.close();
  }

  function checkContentType(contentType) {
    if (contentType && !/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType)) {
      throw new Error(`Expected an HTML page, received ${contentType}.`);
    }
  }
}
