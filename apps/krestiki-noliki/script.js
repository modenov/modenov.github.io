const cells = document.querySelectorAll('.cell');
const resultDiv = document.getElementById('result');
const restartButton = document.getElementById('restart');
let currentPlayer = 'Игрок';
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let gameActive = true;
let startTime;

const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

function startGame() {
    cells.forEach(cell => cell.addEventListener('click', cellClick));
    restartButton.addEventListener('click', restartGame);
    startTime = new Date();
}

function cellClick(event) {
    const index = event.target.dataset.index;
    if (gameBoard[index] === '' && gameActive) {
        makeMove(index, 'Игрок');
        if (checkWinner('Игрок')) {
            endGame('Игрок');
        } else if (!gameBoard.includes('')) {
            endGame('Ничья');
        } else {
            makeComputerMove();
            if (checkWinner('Компьютер')) {
                endGame('Компьютер');
            }
        }
    }
}

function makeMove(index, player) {
    gameBoard[index] = player;
    cells[index].textContent = player === 'Игрок' ? 'X' : 'O';
}

function makeComputerMove() {
    let availableCells = gameBoard.map((cell, index) => cell === '' ? index : null).filter(cell => cell !== null);
    const randomIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
    makeMove(randomIndex, 'Компьютер');
}

function checkWinner(player) {
    return winningCombinations.some(combination => {
        return combination.every(index => {
            return gameBoard[index] === player;
        });
    });
}

function endGame(winner) {
    gameActive = false;
    const endTime = new Date();
    const gameDuration = (endTime - startTime) / 1000;
    if (winner === 'Игрок') {
        resultDiv.textContent = `Победил ${winner}! Время игры: ${gameDuration} сек.`;
    } else if (winner === 'Компьютер') {
        resultDiv.textContent = `Победил ${winner}!`;
    } else {
        resultDiv.textContent = 'Ничья!';
    }
}

function restartGame() {
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    cells.forEach(cell => cell.textContent = '');
    resultDiv.textContent = '';
    gameActive = true;
    currentPlayer = 'Игрок';
    startTime = new Date();
}

startGame();