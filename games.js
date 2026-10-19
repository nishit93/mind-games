// The game list. kids: true marks games that suit children (they also open on their easiest setting from the Kids section).
// Address of the Mind Games API (leave empty until the server is live). Without it, progress stays on the device.
var MG_CONFIG = { api: '' };

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

  // Math & numbers
  { id: 'magic-square', sec: 'math', kids: true, name: 'Magic Square', origin: 'China, ancient', icon: '15', blurb: 'Every line adds to the same total.' },
  { id: 'make-24', sec: 'math', kids: true, name: 'Make 24', origin: 'China, 1900s', icon: '24', blurb: 'Four numbers, one target.' },
  { id: 'target-number', sec: 'math', name: 'Target Number', origin: 'France, 1965', icon: '◎', blurb: 'Reach the target with six numbers.' },
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

  // Solitaire & tiles
  { id: 'klondike', sec: 'cards', name: 'Klondike', origin: 'North America, 1890s', icon: '♠', blurb: 'The classic patience game.' },
  { id: 'pyramid', sec: 'cards', kids: true, name: 'Pyramid', origin: 'Europe, 1800s', icon: '♢', blurb: 'Pair cards that add up to 13.' },
  { id: 'golf', sec: 'cards', kids: true, name: 'Golf', origin: 'Britain, 1900s', icon: '♣', blurb: 'Clear cards one higher or lower.' },
  { id: 'mahjong-solitaire', sec: 'cards', name: 'Mahjong Solitaire', origin: 'USA, 1981', icon: '中', blurb: 'Match free tiles in pairs.' },
];
