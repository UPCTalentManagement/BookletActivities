// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const GAS_URL = 'https://script.google.com/macros/s/AKfycby4mPqZ0w-fbeGse0k8eixEpngw8vxLS9iMfwd8HyocoID2T_IG2y2ifteVwzwgbUPGKg/exec'; // <-- PASTE YOUR URL HERE
    const GRID_WIDTH = 15;
    const GRID_HEIGHT = 15;
    const CORRECT_WORD_POINTS = 10;

    // --- STATE MANAGEMENT ---
    let crosswordData = [];
    let gridState = [];
    let activeClue = null;
    let selectedGroup = '';
    let timerInterval = null;

    // --- DOM ELEMENTS ---
    const gridContainer = document.getElementById('grid-container');
    const acrossCluesList = document.getElementById('across-clues');
    const downCluesList = document.getElementById('down-clues');
    const groupSelectionModal = document.getElementById('group-selection-modal');
    const winModal = document.getElementById('win-modal');
    const winnModal = document.getElementById('winModal');
    const gameContainer = document.getElementById('game-container');
    const loadingScreen = document.getElementById('loading');
    // const currentGroupEl = document.getElementById('current-group');
    const timerEl = document.getElementById('timer');

    // --- INITIALIZATION ---
    startGame();
    // Event Listeners for Group Selection
    // document.querySelectorAll('.group-btn').forEach(button => {
    //     button.addEventListener('click', () => {
    //         selectedGroup = button.dataset.group;
    //         startGame();
    //     });
    // });

    document.getElementById('restart-btn').addEventListener('click', () => location.reload());

    async function startGame() {
        // currentGroupEl.textContent = selectedGroup;
        // groupSelectionModal.classList.remove('active');
       
        gameContainer.style.display = 'flex';
        
        await fetchCrosswordData();
        loadingScreen.classList.remove('active');
        loadingScreen.style.display = 'none';
        initializeGrid();
        renderGrid();
        renderClues();
        startTimer();
    }

    async function fetchCrosswordData() {
        try {
            const response = await fetch(`${GAS_URL}?action=getClues`);
            if (!response.ok) throw new Error('Network response was not ok.');
            crosswordData = await response.json();
            // Assign a unique ID to each word for tracking
            crosswordData.forEach(word => word.wordId = `${word.Orientation}-${word.ID}`);
        } catch (error) {
            console.error('Error fetching crossword data:', error);
            alert('Could not load game data. Please check the connection and try again.');
        }
    }

    // --- GRID LOGIC ---

    function initializeGrid() {
        gridState = Array.from({ length: GRID_HEIGHT }, () => 
            Array(GRID_WIDTH).fill({ isBlackedOut: true, letter: '', clueNumber: null })
        );
        console.log('Crossword data:', crosswordData);
        crosswordData.forEach(word => {
            let { Answer, Orientation, StartX, StartY, ID } = word;
            let x = StartX - 1;
            let y = StartY - 1;
            console.log(Answer, Orientation, StartX, StartY, ID);
            // Fill the grid with the word
            for (let i = 0; i < Answer.length; i++) {
                gridState[y][x] = { ...gridState[y][x], isBlackedOut: false, clueNumber: (i === 0) ? ID : gridState[y][x].clueNumber };
                if (Orientation === 'across') x++;
                else y++;
            }
        });
    }

    function renderGrid() {
        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${GRID_WIDTH}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${GRID_HEIGHT}, 1fr)`;

        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const cellData = gridState[y][x];
                const cellWrapper = document.createElement('div');
                cellWrapper.className = 'grid-cell';
                
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.dataset.x = x;
                input.dataset.y = y;

                if (cellData.isBlackedOut) {
                    input.classList.add('blacked-out');
                } else {
                    if (cellData.clueNumber) {
                        const clueNumEl = document.createElement('span');
                        clueNumEl.className = 'clue-number';
                        clueNumEl.textContent = cellData.clueNumber;
                        cellWrapper.appendChild(clueNumEl);
                    }
                    input.addEventListener('input', handleInput);
                    input.addEventListener('keydown', handleKeyDown);
                    input.addEventListener('focus', () => handleFocus(x, y));
                }
                cellWrapper.appendChild(input);
                gridContainer.appendChild(cellWrapper);
            }
        }
    }

    // --- CLUE LOGIC ---
    function renderClues() {
        acrossCluesList.innerHTML = '';
        downCluesList.innerHTML = '';

        crosswordData.forEach(word => {
            const li = document.createElement('li');
            li.textContent = `${word.ID}. ${word.Clue}`;
            li.dataset.wordId = word.wordId;
            li.addEventListener('click', () => highlightWordFromClue(word.wordId));
            
            if (word.Orientation === 'across') {
                acrossCluesList.appendChild(li);
            } else {
                downCluesList.appendChild(li);
            }
        });
    }
    
    // --- USER INTERACTION HANDLERS ---
    
    function handleInput(e) {
        const input = e.target;
        input.value = input.value.toUpperCase();
        
        if (input.value) {
            const { x, y } = getNextCell(parseInt(input.dataset.x), parseInt(input.dataset.y));
            const nextInput = document.querySelector(`input[data-x='${x}'][data-y='${y}']`);
            if (nextInput && !nextInput.classList.contains('blacked-out')) {
                nextInput.focus();
            }
        }
        checkWordCompletion();
    }
    
    function handleKeyDown(e) {
        const input = e.target;
        if (e.key === 'Backspace' && !input.value) {
            const { x, y } = getPrevCell(parseInt(input.dataset.x), parseInt(input.dataset.y));
            const prevInput = document.querySelector(`input[data-x='${x}'][data-y='${y}']`);
            if (prevInput && !prevInput.classList.contains('blacked-out')) {
                prevInput.focus();
            }
        }
    }

    function handleFocus(x, y) {
        // Find the word(s) this cell belongs to and highlight
        const associatedWords = crosswordData.filter(word => {
            let { StartX, StartY, Answer, Orientation } = word;
            let [sx, sy] = [StartX - 1, StartY - 1];
            if (Orientation === 'across') {
                return sy === y && x >= sx && x < sx + Answer.length;
            } else {
                return sx === x && y >= sy && y < sy + Answer.length;
            }
        });
        
        // Prefer highlighting the direction of the last active clue
        const preferredWord = associatedWords.find(w => activeClue && w.Orientation === activeClue.Orientation) || associatedWords[0];
        
        if (preferredWord) {
             highlightWordUI(preferredWord);
        }
    }
    
    // --- HIGHLIGHTING LOGIC ---

    function highlightWordFromClue(wordId) {
        const wordData = crosswordData.find(w => w.wordId === wordId);
        if (wordData) {
            highlightWordUI(wordData);
            const { StartX, StartY } = wordData;
            const firstInput = document.querySelector(`input[data-x='${StartX-1}'][data-y='${StartY-1}']`);
            if(firstInput) firstInput.focus();
        }
    }

    function highlightWordUI(wordData) {
        // Clear previous highlights
        document.querySelectorAll('input').forEach(i => i.classList.remove('current-word'));
        document.querySelectorAll('.clues-container li').forEach(li => li.classList.remove('active-clue'));
        
        activeClue = wordData;
        
        // Highlight clue
        document.querySelector(`li[data-word-id='${wordData.wordId}']`).classList.add('active-clue');

        // Highlight grid cells
        let { StartX, StartY, Answer, Orientation } = wordData;
        let [x, y] = [StartX - 1, StartY - 1];
        for (let i = 0; i < Answer.length; i++) {
            const cell = document.querySelector(`input[data-x='${x}'][data-y='${y}']`);
            if (cell) cell.classList.add('current-word');
            if (Orientation === 'across') x++;
            else y++;
        }
    }

    // --- GAME MECHANICS ---

    function checkWordCompletion() {
        let allWordsCorrect = true;
        crosswordData.forEach(word => {
            if (word.isCorrect) return; // Skip already correct words
            
            let { Answer, Orientation, StartX, StartY } = word;
            let [x, y] = [StartX - 1, StartY - 1];
            let userInput = '';

            for (let i = 0; i < Answer.length; i++) {
                const input = document.querySelector(`input[data-x='${x}'][data-y='${y}']`);
                userInput += input.value.toUpperCase();
                if (Orientation === 'across') x++;
                else y++;
            }

            if (userInput === Answer) {
                word.isCorrect = true;
                // updateScoreOnServer(CORRECT_WORD_POINTS);
                markWordAsCorrect(word);
            } else {
                allWordsCorrect = false;
            }
        });
        
        if(allWordsCorrect) {
            winGame();
        }
    }
    
    function markWordAsCorrect(wordData) {
        let { StartX, StartY, Answer, Orientation } = wordData;
        let [x, y] = [StartX - 1, StartY - 1];
        for (let i = 0; i < Answer.length; i++) {
            const input = document.querySelector(`input[data-x='${x}'][data-y='${y}']`);
            if (input) {
                input.style.backgroundColor = 'var(--correct-color)';
                input.style.color = 'white';
                input.disabled = true; // Lock correct words
            }
            if (Orientation === 'across') x++;
            else y++;
        }
    }

    // async function updateScoreOnServer(points) {
    //     try {
    //         await fetch(`${GAS_URL}?action=updateScore`, {
    //             method: 'POST',
    //             mode: 'no-cors', // Important for simple POST requests to Apps Script
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({ group: selectedGroup, points: points})
    //         });
    //     } catch (error) {
    //         console.error('Failed to update score:', error);
    //     }
    // }

    // function winGame() {
    //     clearInterval(timerInterval);
    //     document.getElementById('final-time').textContent = timerEl.textContent;
    //     winModal.classList.add('active');
    // }
    function winGame() {
        clearInterval(timerInterval);
        document.getElementById('final-time').textContent = timerEl.textContent;
        const finalTime = timerEl.textContent;
        document.getElementById('final-time').textContent = finalTime;
        // winModal.classList.add('active');
        // winModal.style.display = 'block';   
        winnModal.classList.add('active');
        winnModal.style.display = 'block';

    // *** ADD THIS FETCH CALL to log the time ***
    // fetch(`${GAS_URL}?action=setFinalTime`, {
    //     method: 'POST',
    //     mode: 'no-cors',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ group: selectedGroup, time: finalTime })
    // });
    }
    // --- TIMER ---
    function startTimer() {
        let seconds = 0;
        timerInterval = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    // --- UTILITY ---
    function getNextCell(x, y) {
        if (!activeClue) return { x, y };
        if (activeClue.Orientation === 'across') x++;
        else y++;
        return { x, y };
    }

    function getPrevCell(x, y) {
        if (!activeClue) return { x, y };
        if (activeClue.Orientation === 'across') x--;
        else y--;
        return { x, y };
    }

});
document.addEventListener('keydown', function (event) {
    // F12
    if (event.key === "F12") {
        event.preventDefault();
    }

    // Ctrl + Shift + I (Inspect)
    if (event.ctrlKey && event.shiftKey && event.key === 'I') {
        event.preventDefault();
    }

    // Ctrl + Shift + J (Console)
    if (event.ctrlKey && event.shiftKey && event.key === 'J') {
        event.preventDefault();
    }

    // Ctrl + U (View Source)
    if (event.ctrlKey && event.key === 'u') {
        event.preventDefault();
    }

    // Ctrl + S (Save page)
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
    }

    // Ctrl + C (Copy)
    if (event.ctrlKey && event.key === 'c') {
        event.preventDefault();
    }

    // Ctrl + P (Print)
    if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
    }
});
