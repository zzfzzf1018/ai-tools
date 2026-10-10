#!/usr/bin/env node
import { mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { extractPage, validateUrl } from './extract.js';
import { fetchPage } from './fetch.js';

const help = `Usage: node src/cli.js <url> [options]

Extract an article to content.md, extras.md, and metadata.json.

Options:
  -o, --output <directory>  Output parent directory (default: output)
      --selector <css>      Select exactly one article container
      --render              Render JavaScript using Playwright Chromium
      --wait-for <css>      Wait for a visible element (requires --render)
      --timeout <ms>        Request/navigation timeout (default: 30000)
  -h, --help                Show help
`;

export async function savePage(result, { output, requestedUrl, fetchedAt, rendered, contentType }) {
  const safeTitle = result.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '').slice(0, 70).replace(/[. ]+$/g, '') || 'page';
  await mkdir(output, { recursive: true });
  let directory;
  const stamp = fetchedAt.replace(/[:.]/g, '-');
  for (let suffix = 0; ; suffix++) {
    directory = path.resolve(output, `${safeTitle}-${stamp}${suffix ? `-${suffix}` : ''}`);
    try {
      await mkdir(directory);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  const heading = result.title.replace(/([\\`*_[\]<>])/g, '\\$1');
  const originalUrl = validateUrl(requestedUrl);
  const markdownUrl = (value) => value.replace(/</g, '%3C').replace(/>/g, '%3E');
  const source = `> Source: <${markdownUrl(originalUrl)}>`
    + (originalUrl !== result.metadata.url ? `\n> Final URL: <${markdownUrl(result.metadata.url)}>` : '')
    + `\n> Fetched: ${fetchedAt}`;
  const metadata = {
    ...result.metadata,
    requestedUrl,
    fetchedAt,
    rendered,
    contentType,
    warnings: result.warnings,
  };
  try {
    for (const [name, contents] of [
      ['content.md', `# [${heading}](<${markdownUrl(originalUrl)}>)\n\n${source}\n\n${result.content}\n`],
      ['extras.md', `# Supplementary page content\n\n${source}\n\n${result.extras || '(No supplementary content.)'}\n`],
      ['metadata.json', `${JSON.stringify(metadata, null, 2)}\n`],
    ]) {
      const file = await open(path.join(directory, name), 'wx');
      try {
        await file.writeFile(contents, 'utf8');
      } finally {
        await file.close();
      }
    }
    return directory;
  } catch (error) {
    // Only this invocation's newly created directory is eligible for cleanup.
    await rm(directory, { recursive: true });
    throw error;
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o', default: 'output' },
      selector: { type: 'string' },
      render: { type: 'boolean', default: false },
      'wait-for': { type: 'string' },
      timeout: { type: 'string', default: '30000' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(help);
    return;
  }
  if (positionals.length !== 1) throw new Error(`Provide exactly one URL.\n\n${help}`);
  const requestedUrl = validateUrl(positionals[0]);
  const timeout = Number(values.timeout);
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 2147483647) {
    throw new Error('--timeout must be a positive integer no greater than 2147483647.');
  }
  if (values['wait-for'] && !values.render) throw new Error('--wait-for requires --render.');
  const fetched = await fetchPage(requestedUrl, {
    timeout,
    render: values.render,
    waitFor: values['wait-for'],
  });
  const result = extractPage(fetched.html, { url: fetched.url, selector: values.selector });
  for (const warning of result.warnings) console.error(`Warning: ${warning}`);
  const directory = await savePage(result, {
    output: values.output,
    requestedUrl,
    fetchedAt: new Date().toISOString(),
    rendered: values.render,
    contentType: fetched.contentType,
  });
  console.log(`Saved: ${directory}`);
  console.log('  content.md    Article');
  console.log('  extras.md     Supplementary page content');
  console.log('  metadata.json Source and extraction metadata');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    if (error.cause?.message) console.error(`Cause: ${error.cause.message}`);
    if (/Executable doesn't exist/.test(error.message)) {
      console.error('Install the rendering browser with: npx playwright install chromium');
    }
    process.exitCode = 1;
  });
}
