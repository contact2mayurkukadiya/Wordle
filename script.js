// Immediately Invoked Function Expression (IIFE) to create a private scope.
(function () {
    'use strict';

    // =========================================================================
    // SECTION: GAME STATE AND CONSTANTS
    // =========================================================================

    let secretWord = '',
        currentRow = 0,
        currentGuess = "",
        isAnimating = false,
        completionTimeoutId = null;
    const maxGuesses = 6;
    let isGameOver = false;
    let validWords = new Set();
    let toastTimeoutId = null;

    // =========================================================================
    // SECTION: DOM ELEMENT REFERENCES
    // =========================================================================

    const gameBoard = document.getElementById("game-board"),
        keyboard = document.getElementById("keyboard"),
        message = document.getElementById("message"),
        replayButton = document.getElementById('replay-button'),
        toastContainer = document.getElementById('toast-container'),
        helpIcon = document.getElementById('help-icon'),
        helpModal = document.getElementById('help-modal'),
        settingsIcon = document.getElementById('settings-icon'),
        resetIcon = document.getElementById('reset-icon'),
        settingsModal = document.getElementById('settings-modal');

    // =========================================================================
    // SECTION: SETTINGS MANAGEMENT (THEME, DIFFICULTY, ETC.)
    // =========================================================================

    let settings = {
        level: 'easy',
        theme: 'dark',
        onScreenOnly: false
    };

    function saveSettings() {
        localStorage.setItem('wordleSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        const saved = localStorage.getItem('wordleSettings');
        if (saved) {
            settings = JSON.parse(saved);
        }
    }

    function applySettings() {
        document.body.dataset.theme = settings.theme;
        document.getElementById('difficulty-dropdown').value = settings.level;
        document.getElementById('theme-switch').checked = settings.theme === 'dark';
        document.getElementById('onscreen-keyboard-switch').checked = settings.onScreenOnly;
    }

    // =========================================================================
    // SECTION: GAME INITIALIZATION
    // =========================================================================

    // Create the game board with a front and back face for each tile for animation.
    function createGameBoard() {
        for (let i = 0; i < maxGuesses * 5; i++) {
            const tileContainer = document.createElement("div");
            tileContainer.classList.add("tile-container");
            const tile = document.createElement("div");
            tile.classList.add("tile");
            const frontFace = document.createElement("div");
            frontFace.classList.add("tile-face", "tile-front");
            const backFace = document.createElement("div");
            backFace.classList.add("tile-face", "tile-back");
            tile.appendChild(frontFace);
            tile.appendChild(backFace);
            tileContainer.appendChild(tile);
            gameBoard.appendChild(tileContainer);
        }
    }

    // Create the on-screen keyboard.
    function createKeyboard() {
        const keys = [
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
            ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace']
        ];
        keys.forEach(row => {
            const rowElement = document.createElement('div');
            rowElement.classList.add('keyboard-row');
            row.forEach(key => {
                const keyElement = document.createElement("button");
                keyElement.classList.add("key");
                keyElement.textContent = key;
                keyElement.setAttribute('data-key', key);
                keyElement.addEventListener("click", () => handleKeyPress(key));
                rowElement.appendChild(keyElement);
            });
            keyboard.appendChild(rowElement);
        });
    }

    // Main function to initialize and start the game.
    function startGame() {
        createGameBoard();
        createKeyboard();
        validWords = new Set([...wordLists.easy, ...wordLists.medium, ...wordLists.hard]);
        loadSettings();
        applySettings();
        resetGame(false);
    }

    // =========================================================================
    // SECTION: UI AND FEEDBACK (MODALS, TOASTS, ANIMATIONS)
    // =========================================================================

    function showToast(msg, duration = 1500) {
        if (toastTimeoutId) clearTimeout(toastTimeoutId);
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.classList.add('toast');
        toastContainer.prepend(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        toastTimeoutId = setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
            toastTimeoutId = null;
        }, duration);
    }

    function hideToast() {
        const toast = toastContainer.querySelector('.toast.show');
        if (toast) {
            if (toastTimeoutId) clearTimeout(toastTimeoutId);
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }

    function handleInvalidGuess() {
        const rowContainers = Array.from(document.querySelectorAll('.tile-container')).slice(currentRow * 5, currentRow * 5 + 5);
        rowContainers.forEach(container => container.classList.add('shake'));
        showToast("Not in word list");
        rowContainers[0].addEventListener('animationend', () => {
            rowContainers.forEach(container => container.classList.remove('shake'));
        }, {
            once: true
        });
    }

    function animateKeyPress(key) {
        const keyElement = document.querySelector(`.key[data-key='${key}']`);
        if (keyElement) {
            keyElement.classList.add('pressed');
            setTimeout(() => keyElement.classList.remove('pressed'), 200);
        }
    }

    // =========================================================================
    // SECTION: EVENT LISTENERS
    // =========================================================================

    function bindEventListeners() {
        document.getElementById('difficulty-dropdown').addEventListener('change', (e) => {
            settings.level = e.target.value;
            saveSettings();
            resetGame();
        });
        document.getElementById('theme-switch').addEventListener('change', (e) => {
            settings.theme = e.target.checked ? 'dark' : 'light';
            saveSettings();
            applySettings();
        });
        document.getElementById('onscreen-keyboard-switch').addEventListener('change', (e) => {
            settings.onScreenOnly = e.target.checked;
            saveSettings();
        });

        document.addEventListener("keydown", e => {
            if (settings.onScreenOnly || isAnimating || isModalOpen()) return;
            const key = e.key.toLowerCase();
            animateKeyPress(key);
            if (key === 'enter') {
                e.preventDefault();
                handleKeyPress('enter');
            } else if (key === 'backspace') {
                e.preventDefault();
                handleKeyPress('backspace');
            } else if (/^[a-z]$/.test(key)) {
                handleKeyPress(key);
            }
        });

        const setupModal = (iconEl, modalEl) => {
            const closeBtn = modalEl.querySelector('.close-button');
            iconEl.addEventListener('click', () => modalEl.classList.add('show'));
            closeBtn.addEventListener('click', () => modalEl.classList.remove('show'));
            modalEl.addEventListener('click', e => {
                if (e.target === modalEl) modalEl.classList.remove('show');
            });
        }
        setupModal(helpIcon, helpModal);
        setupModal(settingsIcon, settingsModal);
        replayButton.addEventListener('click', () => resetGame());
        resetIcon.addEventListener('click', () => resetGame());
    }

    const isModalOpen = () => helpModal.classList.contains('show') || settingsModal.classList.contains('show');

    // =========================================================================
    // SECTION: CORE GAME LOGIC
    // =========================================================================

    function resetGame(isRestart = true) {
        if (completionTimeoutId) {
            clearTimeout(completionTimeoutId);
            completionTimeoutId = null;
        }
        isGameOver = false;
        isAnimating = false;
        currentRow = 0;
        currentGuess = "";

        const wordList = wordLists[settings.level] || wordLists.easy;
        secretWord = wordList[Math.floor(Math.random() * wordList.length)];
        if (isRestart) {
            console.log(`New game on '${settings.level}' mode. Word: ${secretWord}`);
        }

        document.querySelectorAll('.tile').forEach(tile => {
            tile.classList.remove('flip');
            const front = tile.querySelector('.tile-front'),
                back = tile.querySelector('.tile-back');
            if (front)
                front.textContent = '';
            if (back) {
                back.textContent = '';
                back.className = 'tile-face tile-back';
            }
        });
        document.querySelectorAll('.key').forEach(key => key.classList.remove('correct', 'present', 'absent'));
        message.textContent = '';
        replayButton.classList.add('hidden');
    }

    function handleKeyPress(key) {
        if (isGameOver || isAnimating || isModalOpen()) return;
        hideToast();
        if (key === 'backspace') {
            currentGuess = currentGuess.slice(0, -1);
        } else if (key === 'enter' && currentGuess.length === 5) {
            submitGuess();
        } else if (currentGuess.length < 5 && /^[a-z]$/.test(key)) {
            currentGuess += key;
        }
        updateBoard();
    }

    function updateBoard() {
        for (let i = 0; i < 5; i++) {
            const tile = document.querySelectorAll(".tile")[currentRow * 5 + i];
            const frontFace = tile.querySelector('.tile-front');
            if (frontFace) {
                frontFace.textContent = currentGuess[i] || '';
            }
        }
    }

    function submitGuess() {
        const guess = currentGuess;
        if (!validWords.has(guess)) {
            handleInvalidGuess();
            return;
        }
        isAnimating = true;
        const guessResult = checkGuess(guess);
        guessResult.forEach((result, i) => {
            const tile = document.querySelectorAll('.tile')[currentRow * 5 + i];
            const backFace = tile.querySelector('.tile-back');
            backFace.textContent = result.letter;
            backFace.classList.add(result.status);
            setTimeout(() => tile.classList.add('flip'), i * 300);
        });

        completionTimeoutId = setTimeout(() => {
            updateKeyboardColors(guessResult);
            if (guess === secretWord) {
                message.textContent = "You win!";
                endGame();
            } else if (currentRow === maxGuesses - 1) {
                message.textContent = `You lose! The word was ${secretWord.toUpperCase()}`;
                endGame();
            } else {
                currentRow++;
                currentGuess = "";
                isAnimating = false;
            }
            completionTimeoutId = null;
        }, 5 * 300);
    }

    function checkGuess(guess) {
        let result = [];
        for (let i = 0; i < 5; i++) {
            const letter = guess[i];
            const status = letter === secretWord[i] ? 'correct' : secretWord.includes(letter) ? 'present' : 'absent';
            result.push({
                letter,
                status
            });
        }
        return result;
    }

    function updateKeyboardColors(guessResult) {
        guessResult.forEach(({
            letter,
            status
        }) => {
            const keyElement = document.querySelector(`.key[data-key='${letter}']`);
            if (!keyElement) return;
            const currentStatus = keyElement.classList.contains('correct') ? 'correct' : keyElement.classList.contains('present') ? 'present' : '';
            if (status === 'correct' || (status === 'present' && currentStatus !== 'correct')) {
                keyElement.classList.remove('present', 'absent');
                keyElement.classList.add(status);
            } else if (status === 'absent' && !currentStatus) {
                keyElement.classList.add('absent');
            }
        });
    }

    function endGame() {
        isGameOver = true;
        isAnimating = false;
        replayButton.classList.remove('hidden');
    }

    // =========================================================================
    // SECTION: SCRIPT EXECUTION
    // =========================================================================

    bindEventListeners();
    startGame();

})();