/** 内联 SVG 图标（24×24 stroke 风格） */

const PATH = {
  today: '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.6V20h12V9.6"/><path d="M10 20v-5h4v5"/>',
  study: '<rect x="3" y="6" width="14" height="13" rx="2.2"/><path d="M7 3.5h11a2 2 0 0 1 2 2V16"/><path d="M6.5 10.5h7"/><path d="M6.5 14h4.5"/>',
  book: '<path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H19v15.5H6.2A2.2 2.2 0 0 0 4 20.7z"/><path d="M4 18.5A2 2 0 0 1 6.2 16.6H19"/><path d="M8 7.5h7"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M21 20H3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/>',
  star: '<path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.4 12.2l2.5 2.5 4.7-5"/>',
  checkPlain: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  speak: '<path d="M11 5 6.5 9H3.5v6h3L11 19z"/><path d="M15.2 8.6a4.8 4.8 0 0 1 0 6.8"/><path d="M18 6a8.4 8.4 0 0 1 0 12"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  arrowLeft: '<path d="M14.5 5 8 12l6.5 7"/>',
  arrowRight: '<path d="M9.5 5 16 12l-6.5 7"/>',
  play: '<path d="M7 4.5v15l13-7.5z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 5v6h-6"/>',
  download: '<path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  upload: '<path d="M12 15.5v-11"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 19.5h15"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7l.8 12.2a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7"/>',
  spark: '<path d="M12 3.5v4"/><path d="M12 16.5v4"/><path d="M4.8 12h4"/><path d="M15.2 12h4"/><path d="M6.9 6.9l2.8 2.8"/><path d="M14.3 14.3l2.8 2.8"/><path d="M17.1 6.9l-2.8 2.8"/><path d="M9.7 14.3l-2.8 2.8"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8v.2"/>',
};

export function icon(name, className = '') {
  const body = PATH[name] || '';
  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}
