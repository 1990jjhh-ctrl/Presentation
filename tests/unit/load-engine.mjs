// Runs an engine script in an isolated context with a fake `window`, the way the
// browser would, and returns the resulting window.Deck.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadDeck(...files) {
  const window = {};
  const context = vm.createContext({ window });
  for (const file of files) {
    const code = readFileSync(new URL(`../../assets/engine/${file}`, import.meta.url), 'utf8');
    vm.runInContext(code, context, { filename: file });
  }
  return window.Deck;
}
