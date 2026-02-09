import './style.css';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, push, set, onValue, query, orderByChild, limitToFirst } from "firebase/database";

// Firebase configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyDc3K47vyQgRXxj93abTxy8w7Aqp5aWuZs",
  authDomain: "hanoi-tower-65812.firebaseapp.com",
  projectId: "hanoi-tower-65812",
  storageBucket: "hanoi-tower-65812.firebasestorage.app",
  messagingSenderId: "18952793189",
  appId: "1:18952793189:web:c4328578078c94db1b6a8c",
  measurementId: "G-DSRS022MWB",
  databaseURL: "https://hanoi-tower-65812-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// Game Constants & State
const COLORS = [
  '#FF5F6D', '#FFC371', '#f8ff00', '#32CD32',
  '#00CED1', '#1E90FF', '#9370DB', '#FF69B4'
];

let diskCount = 5;
let moves = 0;
let pegs = [[], [], []];
let selectedPeg = null;
let gameActive = true;

// DOM Elements
const moveDisplay = document.getElementById('move-count');
const minMoveDisplay = document.getElementById('min-moves');
const gameContainer = document.getElementById('game-container');
const diskCountSelect = document.getElementById('disk-count');
const resetBtn = document.getElementById('reset-btn');
const rankingBtn = document.getElementById('ranking-btn');
const rankingModal = document.getElementById('ranking-modal');
const winModal = document.getElementById('win-modal');
const closeModal = document.getElementById('close-modal');
const rankingList = document.getElementById('ranking-list');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const finalMovesDisplay = document.getElementById('final-moves');
const rankDiskCountSelect = document.getElementById('rank-disk-count');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelp = document.getElementById('close-help');
const startGameBtn = document.getElementById('start-game-btn');

// Initialize Game
function initGame() {
  diskCount = parseInt(diskCountSelect.value);
  moves = 0;
  moveDisplay.textContent = '0';
  minMoveDisplay.textContent = Math.pow(2, diskCount) - 1;
  pegs = [[], [], []];
  selectedPeg = null;
  gameActive = true;

  // Fill first peg
  for (let i = diskCount; i >= 1; i--) {
    pegs[0].push(i);
  }

  render();
}

// Render Game State
function render() {
  // Clear existing disks from DOM
  const existingDisks = document.querySelectorAll('.disk');
  existingDisks.forEach(d => d.remove());

  // Render disks for each peg
  pegs.forEach((peg, pegIdx) => {
    peg.forEach((diskSize, stackIdx) => {
      const diskEl = document.createElement('div');
      diskEl.className = 'disk';
      diskEl.textContent = diskSize;

      // Calculate width and color
      const widthPercent = 30 + (diskSize / diskCount) * 60;
      diskEl.style.width = `${widthPercent}%`;
      diskEl.style.backgroundColor = COLORS[(diskSize - 1) % COLORS.length];

      // Calculate position
      const bottomPos = stackIdx * (window.innerWidth < 600 ? 25 : 30);
      diskEl.style.bottom = `${bottomPos}px`;

      // Add to peg container
      const pegContainer = document.getElementById(`peg-${pegIdx}`);
      pegContainer.appendChild(diskEl);
    });
  });

  // Update selection visual
  document.querySelectorAll('.peg-container').forEach((el, idx) => {
    if (selectedPeg === idx) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
}

// Handle Interaction
function handlePegClick(pegIdx) {
  if (!gameActive) return;

  if (selectedPeg === null) {
    // Select first peg if it has disks
    if (pegs[pegIdx].length > 0) {
      selectedPeg = pegIdx;
    }
  } else {
    // Try to move
    if (selectedPeg === pegIdx) {
      // Deselect
      selectedPeg = null;
    } else {
      const fromPeg = pegs[selectedPeg];
      const toPeg = pegs[pegIdx];
      const diskToMove = fromPeg[fromPeg.length - 1];

      if (toPeg.length === 0 || toPeg[toPeg.length - 1] > diskToMove) {
        // Valid move
        toPeg.push(fromPeg.pop());
        moves++;
        moveDisplay.textContent = moves;
        selectedPeg = null;
        checkWin();
      } else {
        // Invalid move - shake animation or visual feedback
        const pegEl = document.getElementById(`peg-${pegIdx}`);
        pegEl.animate([
          { transform: 'translateX(0)' },
          { transform: 'translateX(-5px)' },
          { transform: 'translateX(5px)' },
          { transform: 'translateX(0)' }
        ], { duration: 200 });
        selectedPeg = null;
      }
    }
  }
  render();
}

// Win Condition
function checkWin() {
  if (pegs[2].length === diskCount) {
    gameActive = false;
    finalMovesDisplay.textContent = moves;
    winModal.classList.remove('hidden');
  }
}

// Firebase Ranking Logic
function saveScore() {
  const name = playerNameInput.value.trim() || '名無し';
  const scoreData = {
    name: name,
    moves: moves,
    disks: diskCount,
    timestamp: Date.now()
  };

  console.log('Attempting to save score:', scoreData);
  const scoresRef = ref(db, `rankings/disks_${diskCount}`);
  const newScoreRef = push(scoresRef);
  set(newScoreRef, scoreData)
    .then(() => {
      console.log('Score saved successfully!');
      winModal.classList.add('hidden');
      rankDiskCountSelect.value = diskCount.toString();
      showRanking();

      // 3びょうごに じどうてきに もどる
      setTimeout(() => {
        rankingModal.classList.add('hidden');
        initGame();
      }, 3000);
    })
    .catch((error) => {
      console.error('Error saving score:', error);
      alert('すこあの とうろくに しっぱいしました: ' + error.message + '\nFirebase の「Realtime Database」の「るーる」が「read, write: true」に なっているか かくにんしてください。');
    });
}

function showRanking() {
  const selectedDisks = rankDiskCountSelect.value;
  rankingModal.classList.remove('hidden');
  rankingList.innerHTML = '<p class="loading">読み込み中...</p>';

  const scoresRef = ref(db, `rankings/disks_${selectedDisks}`);
  // Order by moves (lower is better) and limit to top 10
  const topScoresQuery = query(scoresRef, orderByChild('moves'), limitToFirst(10));

  onValue(topScoresQuery, (snapshot) => {
    const data = snapshot.val();
    rankingList.innerHTML = '';

    if (data) {
      const sortedScores = Object.values(data).sort((a, b) => a.moves - b.moves);
      sortedScores.forEach((score, index) => {
        const item = document.createElement('div');
        item.className = 'ranking-item';
        item.innerHTML = `
          <div class="rank">#${index + 1}</div>
          <div class="name">${score.name}</div>
          <div class="score">${score.moves}て</div>
        `;
        rankingList.appendChild(item);
      });
    } else {
      rankingList.innerHTML = `<p>${selectedDisks}まいの でーたが ありません</p>`;
    }
  }, (error) => {
    console.error('Error fetching rankings:', error);
    rankingList.innerHTML = `<p style="color: #ff6b6b">でーたの よみこみに しっぱいしました: ${error.message}</p>`;
  });
}

// Event Listeners
document.querySelectorAll('.peg-container').forEach(peg => {
  peg.addEventListener('click', () => {
    handlePegClick(parseInt(peg.dataset.index));
  });
});

diskCountSelect.addEventListener('change', initGame);
resetBtn.addEventListener('click', initGame);
rankingBtn.addEventListener('click', showRanking);
closeModal.addEventListener('click', () => rankingModal.classList.add('hidden'));
saveScoreBtn.addEventListener('click', saveScore);
rankDiskCountSelect.addEventListener('change', showRanking);
playAgainBtn.addEventListener('click', () => {
  winModal.classList.add('hidden');
  initGame();
});

// Help Modal Events
helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
const hideHelp = () => helpModal.classList.add('hidden');
closeHelp.addEventListener('click', hideHelp);
startGameBtn.addEventListener('click', hideHelp);

// Start the game
initGame();
