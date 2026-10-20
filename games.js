// The game list. kids: true marks games that suit children (they also open on their easiest setting from the Kids section).
// Address of the Mind Games API. Without it (or when it cannot be reached), progress simply stays on the device.
var MG_CONFIG = { api: 'https://mindgames-api.duckdns.org' };

var SECTIONS = [
  { id: 'logic', name: 'Logic', blurb: 'Grids and rules to reason through' },
  { id: 'math', name: 'Math & numbers', blurb: 'Sums, targets and number tricks' },
  { id: 'moves', name: 'Sliding & shapes', blurb: 'Move pieces into place' },
  { id: 'memory', name: 'Memory & focus', blurb: 'Train recall and attention' },
  { id: 'cards', name: 'Solitaire & tiles', blurb: 'Classic patience games' },
];

var GAMES = [
  // Logic
  { id: 'sudoku', sec: 'logic', kids: true, name: 'Sudoku', origin: 'Japan, 1984', icon: '9', blurb: 'Fill the grid with 1 to 9.' },
  { id: 'nonogram', sec: 'logic', kids: true, name: 'Nonogram', origin: 'Japan, 1987', icon: '▦', blurb: 'Reveal a picture from number clues.' },
  { id: 'binary', sec: 'logic', name: 'Binary', origin: 'Belgium, 2009', icon: '01', blurb: 'Fill the grid with two colours.' },
  { id: 'futoshiki', sec: 'logic', name: 'Futoshiki', origin: 'Japan, 2001', icon: '<', blurb: 'Numbers that obey the arrows.' },
  { id: 'skyscrapers', sec: 'logic', name: 'Skyscrapers', origin: 'Puzzle classic, 1990s', icon: '▙', blurb: 'Build a city from the views.' },
  { id: 'tents', sec: 'logic', name: 'Tents', origin: 'Netherlands, 1989', icon: '▲', blurb: 'Pitch a tent beside every tree.' },
  { id: 'mines', sec: 'logic', name: 'Mines', origin: 'USA, 1990', icon: '✱', blurb: 'Clear the field without a blast.' },
  { id: 'lights-off', sec: 'logic', kids: true, name: 'Lights Off', origin: 'USA, 1995', icon: '◐', blurb: 'Switch every light off.' },
  { id: 'pipes', sec: 'logic', kids: true, name: 'Pipes', origin: 'Puzzle classic, 2000s', icon: '╋', blurb: 'Turn tiles to connect the network.' },
  { id: 'colour-flood', sec: 'logic', kids: true, name: 'Colour Flood', origin: 'Puzzle classic, 2000s', icon: '▚', blurb: 'Flood the board in few moves.' },
  { id: 'eight-queens', sec: 'logic', kids: true, name: 'Eight Queens', origin: 'Germany, 1848', icon: '♛', blurb: 'Place queens that never attack.' },
  { id: 'knights-tour', sec: 'logic', name: "Knight's Tour", origin: 'India, 800s', icon: '♞', blurb: 'Visit every square with a knight.' },
  { id: 'bulls-and-cows', sec: 'logic', kids: true, name: 'Bulls & Cows', origin: 'Britain, 1800s', icon: '#?', blurb: 'Crack the secret number.' },
  { id: 'one-stroke', sec: 'logic', kids: true, name: 'One Stroke', origin: 'Prussia, 1736', icon: '✎', blurb: 'Draw every line without lifting your pen.' },

  // Math & numbers
  { id: 'magic-square', sec: 'math', kids: true, name: 'Magic Square', origin: 'China, ancient', icon: '15', blurb: 'Every line adds to the same total.' },
  { id: 'make-24', sec: 'math', kids: true, name: 'Make 24', origin: 'China, 1900s', icon: '24', blurb: 'Four numbers, one target.' },
  { id: 'target-number', sec: 'math', name: 'Target Number', origin: 'France, 1965', icon: '◎', blurb: 'Reach the target with six numbers.' },
  { id: 'next-in-line', sec: 'math', kids: true, name: 'Next in Line', origin: 'India & Italy, ancient', icon: '2,4,?', blurb: 'Spot the rule and pick the next number.' },
  { id: 'number-pyramid', sec: 'math', kids: true, name: 'Number Pyramid', origin: 'Germany, school classic', icon: '△', blurb: 'Each brick is the sum of two below.' },
  { id: 'cages', sec: 'math', name: 'Cages', origin: 'Japan, 2004', icon: '+', blurb: 'Latin squares with sums and products.' },
  { id: 'water-jugs', sec: 'math', kids: true, name: 'Water Jugs', origin: 'Italy, 1500s', icon: '⊔', blurb: 'Measure exactly with odd jugs.' },
  { id: 'chinese-rings', sec: 'math', name: 'Chinese Rings', origin: 'China, ancient', icon: '◯', blurb: 'Free every ring from the bar.' },
  { id: 'tchoukaillon', sec: 'math', name: 'Tchoukaillon', origin: 'Central Asia', icon: '∴', blurb: 'Sow every seed into the store.' },

  // Sliding & shapes
  { id: '15-puzzle', sec: 'moves', kids: true, name: '15-Puzzle', origin: 'USA, 1880s', icon: '15', blurb: 'Slide the tiles back into order.' },
  { id: 'hanoi', sec: 'moves', kids: true, name: 'Tower of Hanoi', origin: 'France, 1883', icon: '≡', blurb: 'Move the tower, one disc at a time.' },
  { id: 'huarong-dao', sec: 'moves', kids: true, name: 'Huarong Dao', origin: 'China, early 1900s', icon: '▣', blurb: 'Slide the blocks to free the general.' },
  { id: 'traffic-jam', sec: 'moves', kids: true, name: 'Traffic Jam', origin: 'Japan, 1970s', icon: '▭', blurb: 'Clear a path for the red car.' },
  { id: 'maze', sec: 'moves', kids: true, name: 'Maze', origin: 'Crete, ancient', icon: '⌗', blurb: 'Find the way out of the maze.' },
  { id: 'warehouse', sec: 'moves', name: 'Warehouse', origin: 'Japan, 1982', icon: '▢', blurb: 'Push every crate onto a spot.' },
  { id: 'pentominoes', sec: 'moves', name: 'Pentominoes', origin: 'England & USA, 1900s', icon: '⧉', blurb: 'Fit twelve shapes into a box.' },
  { id: 'peg-solitaire', sec: 'moves', name: 'Peg Solitaire', origin: 'France, 1697', icon: '⁘', blurb: 'Jump pegs until one is left.' },
  { id: '2048', sec: 'moves', name: '2048', origin: 'Italy, 2014', icon: '2048', blurb: 'Merge tiles to reach 2048.' },

  // Memory & focus
  { id: 'memory', sec: 'memory', kids: true, name: 'Shinkei-suijaku', origin: 'Japan', icon: '◇◇', blurb: 'The memory game: find the pairs.' },
  { id: 'recall', sec: 'memory', kids: true, name: 'Recall', origin: 'USA, 1978', icon: '◔', blurb: 'Repeat the growing pattern.' },
  { id: 'schulte-table', sec: 'memory', kids: true, name: 'Schulte Table', origin: 'Germany, 1900s', icon: '#', blurb: 'Find the numbers in order, fast.' },
  { id: 'grid-recall', sec: 'memory', kids: true, name: 'Grid Recall', origin: 'Memory science classic', icon: '⊞', blurb: 'Remember which squares lit up.' },
  { id: 'digit-span', sec: 'memory', kids: true, name: 'Digit Span', origin: 'Britain, 1887', icon: '123', blurb: 'Hold a growing number in mind.' },
  { id: 'odd-one-out', sec: 'memory', kids: true, name: 'Odd One Out', origin: 'Japan & USA, 1900s', icon: '◍', blurb: 'Find the square with a slightly different shade.' },
  { id: 'colour-word', sec: 'memory', kids: true, name: 'Colour Word', origin: 'USA, 1935', icon: 'Aa', blurb: 'Name the ink, not the word.' },
  { id: 'word-search', sec: 'memory', kids: true, name: 'Word Search', origin: 'USA, 1968', icon: 'ABC', blurb: 'Find the hidden words in the grid.' },

  // Solitaire & tiles
  { id: 'klondike', sec: 'cards', name: 'Klondike', origin: 'North America, 1890s', icon: '♠', blurb: 'The classic patience game.' },
  { id: 'pyramid', sec: 'cards', kids: true, name: 'Pyramid', origin: 'Europe, 1800s', icon: '♢', blurb: 'Pair cards that add up to 13.' },
  { id: 'golf', sec: 'cards', kids: true, name: 'Golf', origin: 'Britain, 1900s', icon: '♣', blurb: 'Clear cards one higher or lower.' },
  { id: 'mahjong-solitaire', sec: 'cards', name: 'Mahjong Solitaire', origin: 'USA, 1981', icon: '中', blurb: 'Match free tiles in pairs.' },
  { id: 'free-cells', sec: 'cards', name: 'Free Cells', origin: 'USA, 1978', icon: '♠', blurb: 'All cards face up: plan your way home.' },
  { id: 'accordion', sec: 'cards', name: 'Accordion', origin: 'Britain, 1900s', icon: '♦', blurb: 'Fold the whole deck into one pile.' },
  { id: 'tripeaks', sec: 'cards', name: 'Tri Peaks', origin: 'Patience classic', icon: '♠', blurb: 'Clear three peaks, one up or down.' },
  { id: 'calculation', sec: 'cards', name: 'Calculation', origin: 'Britain, 1800s', icon: '♥', blurb: 'Build four rows by ones, twos, threes and fours.' },
  { id: 'monte-carlo', sec: 'cards', name: 'Monte Carlo', origin: 'Patience classic', icon: '♣', blurb: 'Pair up touching cards of the same number.' },
];

// Games with a level or size choice, so they can open one step above the highest level the player has won.
// game id: [setting key, best-score key prefix (null if the game keeps none), selector of the level buttons, button attribute]
var LEVELS = {
  '15-puzzle': ['fifteen-size', 'fifteen-best-', '.seg'],
  'binary': ['binary-n', 'binary-best-', '#size'],
  'bulls-and-cows': ['bulls-len', 'bulls-best-', '#size'],
  'cages': ['cages-n', 'cages-best-', '#size'],
  'chinese-rings': ['rings-n', 'rings-best-', '#size'],
  'colour-flood': ['flood-n', 'flood-best-', '#size'],
  'futoshiki': ['futoshiki-n', 'futoshiki-best-', '#size'],
  'hanoi': ['hanoi-n', 'hanoi-best-', '#size'],
  'huarong-dao': ['huarong-level', 'huarong-best-', '#level'],
  'knights-tour': ['knight-n', 'knight-best-', '#size'],
  'lights-off': ['lights-n', null, '#size'],
  'magic-square': ['magic-n', null, '#size'],
  'make-24': ['m24-level', null, '#level'],
  'memory': ['memory-size', 'memory-best-', '#size'],
  'mines': ['mines-level', 'mines-best-', '#level'],
  'nonogram': ['nonogram-n', 'nonogram-best-', '#size'],
  'number-pyramid': ['pyramid-rows', null, '#size'],
  'pentominoes': ['pento-level', null, '#level'],
  'pipes': ['pipes-n', 'pipes-best-', '#size'],
  'schulte-table': ['schulte-n', 'schulte-best-', '#size'],
  'skyscrapers': ['sky-n', 'sky-best-', '#size'],
  'sudoku': ['sudoku-level', 'sudoku-best-', '#level'],
  'target-number': ['target-level', null, '#level'],
  'tchoukaillon': ['tchouk-seeds', null, '#size'],
  'tents': ['tents-n', 'tents-best-', '#size'],
  'traffic-jam': ['traffic-level', 'traffic-best-', '#level'],
  'warehouse': ['warehouse-level', 'warehouse-best-', '#level'],
  'water-jugs': ['jugs-level', 'jugs-best-', '#level'],
  'maze': ['maze-n', 'maze-best-', '#size'],
  'one-stroke': ['stroke-level', 'stroke-best-', '#level'],
  'next-in-line': ['nextline-level', null, '#level'],
  'colour-word': ['colourword-level', null, '#level'],
  'word-search': ['wordsearch-n', 'wordsearch-best-', '#size'],
};

// Suggested ages (from, to) for the games made for children. Shown as a badge, and used by Kid mode (kids: true).
var AGES = {
  'sudoku': [8, 11], 'nonogram': [7, 11], 'lights-off': [6, 11], 'pipes': [6, 11], 'colour-flood': [6, 11], 'eight-queens': [9, 11],
  'bulls-and-cows': [8, 11], 'magic-square': [8, 11], 'make-24': [8, 11], 'number-pyramid': [7, 11], 'water-jugs': [9, 11],
  '15-puzzle': [6, 11], 'hanoi': [6, 11], 'huarong-dao': [8, 11], 'traffic-jam': [6, 11],
  'memory': [4, 8], 'recall': [5, 9], 'schulte-table': [7, 11], 'grid-recall': [6, 10], 'digit-span': [8, 11],
  'pyramid': [7, 11], 'golf': [6, 11],
  'one-stroke': [7, 11], 'next-in-line': [8, 11], 'maze': [6, 11], 'odd-one-out': [5, 9], 'colour-word': [8, 11], 'word-search': [7, 11],
};
GAMES.forEach(function (g) { if (g.kids) g.ages = AGES[g.id] || [6, 11]; });

// Puzzle of the day: one game a day, the same puzzle for everyone (it is built from the date), on a fixed level.
// Only games that build their puzzle when the page opens, with no timing involved, belong here. level is the value of the game's level button.
var DAILY = [
  { id: 'sudoku', level: 'medium', label: 'Medium' }, { id: 'nonogram', level: '8', label: '8×8' }, { id: 'binary', level: '6', label: '6×6' }, { id: 'futoshiki', level: '5', label: '5×5' },
  { id: 'skyscrapers', level: '5', label: '5×5' }, { id: 'tents', level: '8', label: '8×8' }, { id: 'pipes', level: '6', label: '6×6' }, { id: 'lights-off', level: '5', label: '5×5' },
  { id: 'cages', level: '5', label: '5×5' }, { id: 'number-pyramid', level: '4', label: '4 rows' }, { id: 'make-24', level: 'tricky', label: 'Tricky' }, { id: 'target-number', level: 'classic', label: 'Classic' },
  { id: 'colour-flood', level: '12', label: 'Medium' }, { id: '15-puzzle', level: '4', label: '4×4' },
];
function dailyDate(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
// Today's pick. In kid mode only games for children are used.
function dailyPick(kidsOnly, d) {
  d = d || new Date();
  var pool = DAILY.filter(function (e) { return !kidsOnly || GAMES.some(function (x) { return x.id === e.id && x.kids; }); });
  var day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  var e = pool[day % pool.length];
  return { id: e.id, level: e.level, label: e.label, date: dailyDate(d) };
}
