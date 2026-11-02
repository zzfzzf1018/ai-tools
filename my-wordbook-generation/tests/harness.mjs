import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function boot(modules = [], initial = {}) {
  const data = new Map();
  const storage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
  Object.keys(initial).forEach(function (key) {
    const value = initial[key];
    storage.setItem('wb:v1:' + key, typeof value === 'string' ? value : JSON.stringify(value));
  });
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    window: {
      localStorage: storage,
      matchMedia: function () {
        return { matches: false, addEventListener: function () {}, addListener: function () {} };
      }
    }
  };
  sandbox.window.window = sandbox.window;
  sandbox.localStorage = storage;
  vm.createContext(sandbox);

  function run(relative) {
    const file = path.join(ROOT, relative);
    const code = fs.readFileSync(file, 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }

  run('js/data/wordbank.js');
  modules.forEach(function (name) { run('js/' + name); });
  return sandbox.window.WB;
}
