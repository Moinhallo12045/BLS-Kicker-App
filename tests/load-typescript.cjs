const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTypeScript(relativePath, mocks = {}, globals = {}, cache = new Map()) {
  const file = path.resolve(relativePath);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017,
      jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const resolve = (name) => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
      const resolved = ['.ts', '.tsx', '/index.ts'].map((suffix) => base + suffix).find((p) => fs.existsSync(p));
      if (!resolved) throw new Error(`Cannot resolve ${name} from ${file}`);
      return loadTypeScript(resolved, mocks, globals, cache);
    }
    return require(name);
  };
  vm.runInNewContext(source, { module, exports: module.exports, require: resolve,
    console, Date, Math, crypto: require('node:crypto').webcrypto, setTimeout, clearTimeout,
    setInterval, clearInterval, ...globals }, { filename: file });
  cache.set(file, module.exports);
  return module.exports;
}

function player(id, role = 'player') {
  return { id, name: id, avatar: 'x', email: `${id}@example.test`, yearJoined: 2026,
    level: 1, xp: 0, xpNextLevel: 150, elo1v1: 1000, elo2v2: 1000, eloTotal: 1000,
    leaguePoints: 0, wins1v1: 0, losses1v1: 0, wins2v2: 0, losses2v2: 0,
    currentStreak: 0, bestRank: 999, role, isSuspended: false, badges: [], eloHistory: [] };
}
module.exports = { loadTypeScript, player };
