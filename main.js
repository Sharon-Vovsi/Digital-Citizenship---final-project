const box = document.querySelector(".box");
const movementKeys = new Set(["w", "a", "s", "d"]);
const pressedKeys = new Set();
const movementSpeed = 260;
const enemySpeed = 150;
const enemySize = 32;
const maximumEnemies = 15;
const startingSpawnInterval = 1600;
const minimumSpawnInterval = 250;
const enemyCapacityIncreaseInterval = 0.5;
const spawnRampDuration = 60;
const scoreElement = document.querySelector("#score");
const scoreLabel = document.querySelector(".score");
const gameMessage = document.querySelector("#game-message");
const initialBackgroundColor = document.body.style.backgroundColor;
const backgroundColors = ["#f1c40f", "#a8dadc", "#b7e4c7", "#ffcad4", "#cdb4db"];
const enemyColors = ["#e74c3c", "#277da1", "#f3722c", "#6a994e", "#9b5de5"];
const boxColors = ["#fff", "#ffd166", "#90e0ef", "#caffbf", "#ffc6ff"];
const fontFamilies = ["Georgia, serif", "'Courier New', monospace", "Verdana, sans-serif", "'Trebuchet MS', sans-serif"];
const fontSizes = [14, 18, 22, 26, 30];
const enemies = [];
let spawnEdges = [];
let score = 0;
let currentBackgroundColor = getComputedStyle(document.body).backgroundColor;
let currentEnemyColor = enemyColors[0];
let currentBoxColor = boxColors[0];
let currentFontIndex = -1;
let currentFontSize = 16;
let gameElapsedSeconds = 0;
let x = (window.innerWidth - box.offsetWidth) / 2;
let y = (window.innerHeight - box.offsetHeight) / 2;
let previousFrameTime = null;
let nextSpawnTime = null;
let gameState = "idle";
let pausedAt = null;
let collisionAudioContext = null;

box.style.left = `${x}px`;
box.style.top = `${y}px`;

document.addEventListener("keydown", (event) => {
	const key = event.key.toLowerCase();
	if (key === "r") {
		if (!event.repeat) {
			restartGame();
		}
		return;
	}

	if (key === "p") {
		if (!event.repeat) {
			togglePause();
		}
		return;
	}

	if (!movementKeys.has(key) || gameState === "paused") {
		return;
	}

	event.preventDefault();
	if (gameState === "idle") {
		startGame();
	}
	pressedKeys.add(key);
});

document.addEventListener("keyup", (event) => {
	pressedKeys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
	pressedKeys.clear();
});

function gameLoop(timestamp) {
	if (gameState !== "running") {
		previousFrameTime = null;
		requestAnimationFrame(gameLoop);
		return;
	}

	const elapsedSeconds = previousFrameTime === null
		? 0
		: Math.min((timestamp - previousFrameTime) / 1000, 0.05);
	previousFrameTime = timestamp;
	gameElapsedSeconds += elapsedSeconds;
	const rampProgress = Math.min(gameElapsedSeconds / spawnRampDuration, 1);
	const spawnInterval = startingSpawnInterval
		- (startingSpawnInterval - minimumSpawnInterval) * rampProgress;
	const enemyCapacity = Math.min(
		1 + Math.floor(gameElapsedSeconds / enemyCapacityIncreaseInterval),
		maximumEnemies,
	);
	if (nextSpawnTime === null) {
		nextSpawnTime = timestamp + spawnInterval;
	} else if (timestamp >= nextSpawnTime) {
		if (enemies.length < enemyCapacity) {
			spawnEnemy();
		}
		nextSpawnTime = timestamp + spawnInterval * (0.75 + Math.random() * 0.5);
	}

	const horizontal = Number(pressedKeys.has("d")) - Number(pressedKeys.has("a"));
	const vertical = Number(pressedKeys.has("s")) - Number(pressedKeys.has("w"));
	const directionLength = Math.hypot(horizontal, vertical);

	const boxBounds = box.getBoundingClientRect();
	if (directionLength > 0) {
		x = Math.min(
			Math.max(x + (horizontal / directionLength) * movementSpeed * elapsedSeconds, 0),
			window.innerWidth - boxBounds.width,
		);
		y = Math.min(
			Math.max(y + (vertical / directionLength) * movementSpeed * elapsedSeconds, 0),
			window.innerHeight - boxBounds.height,
		);
		box.style.left = `${x}px`;
		box.style.top = `${y}px`;
	}

	for (let index = enemies.length - 1; index >= 0; index -= 1) {
		const enemy = enemies[index];
		enemy.x += enemy.velocityX * elapsedSeconds;
		enemy.y += enemy.velocityY * elapsedSeconds;
		enemy.element.style.left = `${enemy.x}px`;
		enemy.element.style.top = `${enemy.y}px`;
		const enemyBounds = enemy.element.getBoundingClientRect();
		if (
			enemyBounds.left < boxBounds.right
			&& enemyBounds.right > boxBounds.left
			&& enemyBounds.top < boxBounds.bottom
			&& enemyBounds.bottom > boxBounds.top
		) {
			enemy.element.remove();
			enemies.splice(index, 1);
			score += 1;
			scoreElement.textContent = score;
			playCollisionSound();
			applyCollisionEffect();
		} else if (
			enemy.x + enemySize < 0
			|| enemy.x > window.innerWidth
			|| enemy.y + enemySize < 0
			|| enemy.y > window.innerHeight
		) {
			enemy.element.remove();
			enemies.splice(index, 1);
		}
	}

	requestAnimationFrame(gameLoop);
}

function startGame() {
	gameState = "running";
	gameMessage.hidden = true;
	previousFrameTime = null;
	nextSpawnTime = null;
	gameElapsedSeconds = 0;
	if (window.AudioContext) {
		collisionAudioContext ??= new AudioContext();
		collisionAudioContext.resume();
	}
}

function playCollisionSound() {
	if (!collisionAudioContext || collisionAudioContext.state !== "running") {
		return;
	}

	const oscillator = collisionAudioContext.createOscillator();
	const gain = collisionAudioContext.createGain();
	const now = collisionAudioContext.currentTime;

	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(520, now);
	oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.09);
	gain.gain.setValueAtTime(0.12, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
	oscillator.connect(gain);
	gain.connect(collisionAudioContext.destination);
	oscillator.start(now);
	oscillator.stop(now + 0.14);
}

function togglePause() {
	if (gameState === "paused") {
		gameState = "running";
		if (nextSpawnTime !== null && pausedAt !== null) {
			nextSpawnTime += performance.now() - pausedAt;
		}
		pausedAt = null;
		gameMessage.hidden = true;
		previousFrameTime = null;
	} else {
		gameState = "paused";
		pausedAt = performance.now();
		pressedKeys.clear();
		gameMessage.textContent = "Paused";
		gameMessage.hidden = false;
	}
}

function restartGame() {
	for (const enemy of enemies) {
		enemy.element.remove();
	}
	enemies.length = 0;
	spawnEdges = [];
	score = 0;
	scoreElement.textContent = score;
	document.body.style.backgroundColor = initialBackgroundColor;
	document.body.style.removeProperty("--enemy-color");
	box.style.backgroundColor = boxColors[0];
	box.style.removeProperty("font-family");
	box.style.removeProperty("font-size");
	scoreLabel.style.removeProperty("font-family");
	scoreLabel.style.removeProperty("font-size");
	currentBackgroundColor = getComputedStyle(document.body).backgroundColor;
	currentEnemyColor = enemyColors[0];
	currentBoxColor = boxColors[0];
	currentFontIndex = -1;
	currentFontSize = 16;
	x = (window.innerWidth - box.offsetWidth) / 2;
	y = (window.innerHeight - box.offsetHeight) / 2;
	box.style.left = `${x}px`;
	box.style.top = `${y}px`;
	pressedKeys.clear();
	gameMessage.textContent = "Controls: WASD, Pause: P, Restart: R";
	gameState = "running";
	pausedAt = null;
	gameMessage.hidden = true;
	previousFrameTime = null;
	nextSpawnTime = null;
	gameElapsedSeconds = 0;
}

function applyCollisionEffect() {
	const effect = Math.floor(Math.random() * 5);
	if (effect === 0) {
		currentBackgroundColor = chooseDifferentValue(backgroundColors, currentBackgroundColor);
		document.body.style.backgroundColor = currentBackgroundColor;
	} else if (effect === 1) {
		currentEnemyColor = chooseDifferentValue(enemyColors, currentEnemyColor);
		document.body.style.setProperty("--enemy-color", currentEnemyColor);
	} else if (effect === 2) {
		let nextFontIndex = Math.floor(Math.random() * fontFamilies.length);
		if (nextFontIndex === currentFontIndex) {
			nextFontIndex = (nextFontIndex + 1) % fontFamilies.length;
		}
		currentFontIndex = nextFontIndex;
		box.style.fontFamily = fontFamilies[currentFontIndex];
		scoreLabel.style.fontFamily = fontFamilies[currentFontIndex];
	} else if (effect === 3) {
		currentFontSize = chooseDifferentValue(fontSizes, currentFontSize);
		box.style.fontSize = `${currentFontSize}px`;
		scoreLabel.style.fontSize = `${currentFontSize}px`;
	} else {
		currentBoxColor = chooseDifferentValue(boxColors, currentBoxColor);
		box.style.backgroundColor = currentBoxColor;
	}
}

function chooseDifferentValue(values, currentValue) {
	const choices = values.filter((value) => value !== currentValue);
	return choices[Math.floor(Math.random() * choices.length)];
}

function spawnEnemy() {
	if (spawnEdges.length === 0) {
		spawnEdges = ["top", "right", "bottom", "left"];
		for (let index = spawnEdges.length - 1; index > 0; index -= 1) {
			const swapIndex = Math.floor(Math.random() * (index + 1));
			[spawnEdges[index], spawnEdges[swapIndex]] = [spawnEdges[swapIndex], spawnEdges[index]];
		}
	}

	const edge = spawnEdges.pop();
	let startX;
	let startY;
	if (edge === "top") {
		startX = Math.random() * window.innerWidth;
		startY = -enemySize;
	} else if (edge === "right") {
		startX = window.innerWidth;
		startY = Math.random() * window.innerHeight;
	} else if (edge === "bottom") {
		startX = Math.random() * window.innerWidth;
		startY = window.innerHeight;
	} else {
		startX = -enemySize;
		startY = Math.random() * window.innerHeight;
	}

	const targetX = window.innerWidth * (0.2 + Math.random() * 0.6);
	const targetY = window.innerHeight * (0.2 + Math.random() * 0.6);
	const deltaX = targetX - startX;
	const deltaY = targetY - startY;
	const directionLength = Math.hypot(deltaX, deltaY);
	const element = document.createElement("div");
	element.className = "enemy";
	element.setAttribute("aria-hidden", "true");
	element.style.left = `${startX}px`;
	element.style.top = `${startY}px`;
	document.body.append(element);
	enemies.push({
		element,
		x: startX,
		y: startY,
		velocityX: (deltaX / directionLength) * enemySpeed,
		velocityY: (deltaY / directionLength) * enemySpeed,
	});
}

requestAnimationFrame(gameLoop);
