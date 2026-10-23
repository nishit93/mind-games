const fs = require('fs');
let t = fs.readFileSync('tools/smoke.js', 'utf8');
const rep = (a, b) => { if (!t.includes(a)) throw new Error('x: ' + a.slice(0, 60)); t = t.replace(a, b); };
rep("touch(at, '#new'); await sleep(100);", "touch(at, '#new, #restart'); await sleep(100);");
rep("check('Analytics', 'a normal play is counted per game and level, with no player or personal detail', Object.keys(normal.c).length === 1 && /^p\.lights-off\.[a-z0-9_]+$/.test(Object.keys(normal.c)[0]), JSON.stringify(normal.c));", "check('Analytics', 'a normal play is counted per game and level (visit and attempt), with no player or personal detail', Object.keys(normal.c).length === 2 && Object.keys(normal.c).every(k => /^[ps]\.lights-off\.[a-z0-9_]+$/.test(k)), JSON.stringify(normal.c));");
fs.writeFileSync('tools/smoke.js', t);
