import { parseExpression, globalEnv } from './cell-language.js';

const replElement = document.getElementById('repl');
const userInput = document.getElementById('user-input');
let commandHistory = [];
let historyIndex = -1;

function appendOutput(content, className = '') {
    const div = document.createElement('div');
    div.className = `output ${className}`;
    div.innerHTML = content;
    replElement.appendChild(div);
    replElement.scrollTop = replElement.scrollHeight;
}

function processInput(input = null) {
    const code = input || userInput.value.trim();
    if (!code) return;

    appendOutput(`<span class="prompt">cell></span> ${code}`, 'prompt');

    try {
        const result = parseExpression(code, globalEnv);
        const evaluated = result.evaluate(globalEnv);
        appendOutput(`<strong>→</strong> ${evaluated.toString()}`, 'success');
    } catch (error) {
        appendOutput(`<strong>❌ Error:</strong> ${error.message}`, 'error');
    }

    if (!input) {
        commandHistory.push(code);
        historyIndex = -1;
        userInput.value = '';
    }
}

function clearREPL() {
    replElement.innerHTML = '';
    appendOutput('<span class="status-indicator"></span>Bienvenido al lenguaje Cell (versión web)', 'info');
    appendOutput('Escribe expresiones Cell y presiona Enter para evaluar', 'info');
}

function runExample(example) {
    userInput.value = example;
    processInput(example);
    userInput.focus();
}

// Event listeners
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        processInput();
    }
});

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
            historyIndex++;
            userInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            userInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
        } else {
            historyIndex = -1;
            userInput.value = '';
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        clearREPL();
    }
});

document.getElementById('clear-btn').addEventListener('click', clearREPL);
document.getElementById('run-btn').addEventListener('click', () => processInput());

// Inicializar REPL
clearREPL();