// The game list. Shared by the pages (menu, home cards) and the service worker (offline cache).
var GAMES = [
  { id: '15-puzzle', name: '15-Puzzle', origin: 'USA, 1880s', icon: '15', blurb: 'Slide the tiles back into order.' },
  { id: 'hanoi', name: 'Tower of Hanoi', origin: 'France, 1883', icon: '≡', blurb: 'Move the tower, one disc at a time.' },
  { id: 'lights-off', name: 'Lights Off', origin: 'USA, 1995', icon: '◐', blurb: 'Switch every light off.' },
  { id: 'bulls-and-cows', name: 'Bulls & Cows', origin: 'Britain, 1800s', icon: '#?', blurb: 'Crack the secret number.' },
  { id: 'memory', name: 'Shinkei-suijaku', origin: 'Japan', icon: '◇◇', blurb: 'The memory game: find the pairs.' },
  { id: 'sudoku', name: 'Sudoku', origin: 'Japan, 1984', icon: '9', blurb: 'Fill the grid with 1 to 9.' },
  { id: 'peg-solitaire', name: 'Peg Solitaire', origin: 'France, 1697', icon: '⁘', blurb: 'Jump pegs until one is left.' },
  { id: '2048', name: '2048', origin: 'Italy, 2014', icon: '2048', blurb: 'Merge tiles to reach 2048.' },
  { id: 'mines', name: 'Mines', origin: 'USA, 1990', icon: '✱', blurb: 'Clear the field without a blast.' },
  { id: 'nonogram', name: 'Nonogram', origin: 'Japan, 1987', icon: '▦', blurb: 'Reveal a picture from number clues.' },
  { id: 'recall', name: 'Recall', origin: 'USA, 1978', icon: '◔', blurb: 'Repeat the growing pattern.' },
  { id: 'knights-tour', name: "Knight's Tour", origin: 'India, 800s', icon: '♞', blurb: 'Visit every square with a knight.' },
  { id: 'eight-queens', name: 'Eight Queens', origin: 'Germany, 1848', icon: '♛', blurb: 'Place queens that never attack.' },
  { id: 'huarong-dao', name: 'Huarong Dao', origin: 'China, early 1900s', icon: '▣', blurb: 'Slide the blocks to free the general.' },
  { id: 'binary', name: 'Binary', origin: 'Belgium, 2009', icon: '01', blurb: 'Fill the grid with two colours.' },
];
