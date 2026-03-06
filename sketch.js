const DIFFICULTIES = {
  Easy: {
    label: "Easy",
    speedBase: 3.3,
    obstacleGapBase: 68,
    minObstacleGap: 38,
    coinGap: 85,
    boostGap: 300
  },
  Normal: {
    label: "Normal",
    speedBase: 4.0,
    obstacleGapBase: 56,
    minObstacleGap: 30,
    coinGap: 95,
    boostGap: 380
  },
  Hard: {
    label: "Hard",
    speedBase: 4.8,
    obstacleGapBase: 48,
    minObstacleGap: 24,
    coinGap: 105,
    boostGap: 460
  }
};

let laneCount = 3;
let roadWidth;
let roadLeft;
let laneWidth;

let playerLane = 1;
let playerY;
let playerW;
let playerH;

let obstacles = [];
let coins = [];
let boosts = [];

let score = 0;
let coinsCollected = 0;
let lives = 3;
let bestScore = 0;

let gameState = "menu"; // menu, playing, gameover
let currentDifficulty = "Normal";
let settings = DIFFICULTIES.Normal;

let obstacleTimer = 0;
let coinTimer = 0;
let boostTimer = 0;
let roadLineOffset = 0;
let gameSpeed = 4;
let boostFrames = 0;
let hitCooldown = 0;

let difficultyButtons = [];
let restartButton = { x: 0, y: 0, w: 190, h: 56, label: "Restart" };
let menuButton = { x: 0, y: 0, w: 190, h: 50, label: "Main Menu" };

let audioCtx = null;
let musicIndex = 0;
let lastMusicFrame = 0;

function setup() {
  createCanvas(min(windowWidth, 420), min(windowHeight, 760));
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  setLayout();
  resetRound();
}

function setLayout() {
  roadWidth = width * 0.78;
  roadLeft = (width - roadWidth) / 2;
  laneWidth = roadWidth / laneCount;

  playerY = height - 110;
  playerW = laneWidth * 0.56;
  playerH = 74;

  difficultyButtons = [
    { x: width / 2, y: height / 2 - 10, w: 180, h: 54, label: "Easy" },
    { x: width / 2, y: height / 2 + 58, w: 180, h: 54, label: "Normal" },
    { x: width / 2, y: height / 2 + 126, w: 180, h: 54, label: "Hard" }
  ];

  restartButton.x = width / 2;
  restartButton.y = height / 2 + 92;

  menuButton.x = width / 2;
  menuButton.y = height / 2 + 155;
}

function resetRound() {
  playerLane = 1;
  obstacles = [];
  coins = [];
  boosts = [];

  score = 0;
  coinsCollected = 0;
  lives = 3;

  obstacleTimer = 0;
  coinTimer = 30;
  boostTimer = 120;
  roadLineOffset = 0;
  gameSpeed = settings.speedBase;
  boostFrames = 0;
  hitCooldown = 0;
  musicIndex = 0;
  lastMusicFrame = frameCount;
}

function startRound(difficultyName) {
  currentDifficulty = difficultyName;
  settings = DIFFICULTIES[difficultyName];
  resetRound();
  gameState = "playing";
  initAudio();
  playStartSound();
}

function draw() {
  drawWorld();

  if (gameState === "playing") {
    updateGame();
  }

  drawBoosts();
  drawCoins();
  drawObstacles();
  drawPlayer();
  drawHud();

  if (gameState === "menu") {
    drawMenuScreen();
  } else if (gameState === "gameover") {
    drawGameOverScreen();
  }
}

function updateGame() {
  gameSpeed = settings.speedBase + score * 0.025 + coinsCollected * 0.015;
  roadLineOffset += gameSpeed;

  obstacleTimer++;
  coinTimer++;
  boostTimer++;

  if (boostFrames > 0) {
    boostFrames--;
  }

  if (hitCooldown > 0) {
    hitCooldown--;
  }

  updateMusic();

  let obstacleGap = max(
    settings.minObstacleGap,
    settings.obstacleGapBase - floor(score * 0.12)
  );

  if (obstacleTimer >= obstacleGap) {
    spawnObstacle();
    obstacleTimer = 0;
  }

  if (coinTimer >= settings.coinGap) {
    spawnCoin();
    coinTimer = 0;
  }

  if (boostTimer >= settings.boostGap) {
    spawnBoost();
    boostTimer = 0;
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    let obstacle = obstacles[i];
    obstacle.y += gameSpeed;

    if (isCarColliding(obstacle)) {
      if (boostFrames > 0) {
        obstacles.splice(i, 1);
        score += 2;
        playBoostSmashSound();
        continue;
      }

      if (hitCooldown === 0) {
        obstacles.splice(i, 1);
        loseLife();
        if (gameState !== "playing") {
          return;
        }
        continue;
      }
    }

    if (obstacle.y > height + 100) {
      obstacles.splice(i, 1);
      score += 1;
    }
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    let coin = coins[i];
    coin.y += gameSpeed * 0.95;

    if (isCoinCollected(coin)) {
      coins.splice(i, 1);
      coinsCollected++;
      score += coin.value;
      playCoinSound(coin.pitch);
      continue;
    }

    if (coin.y > height + 60) {
      coins.splice(i, 1);
    }
  }

  for (let i = boosts.length - 1; i >= 0; i--) {
    let boost = boosts[i];
    boost.y += gameSpeed * 0.9;
    boost.spin += 0.12;

    if (isBoostCollected(boost)) {
      boosts.splice(i, 1);
      boostFrames = 180; // about 3 seconds
      playBoostSound();
      continue;
    }

    if (boost.y > height + 60) {
      boosts.splice(i, 1);
    }
  }
}

function loseLife() {
  lives--;
  hitCooldown = 55;
  playCrashSound();

  if (lives <= 0) {
    endGame();
  }
}

function endGame() {
  gameState = "gameover";
  bestScore = max(bestScore, score);
}

function spawnObstacle() {
  let styles = [
    { body: color(255, 90, 90), roof: color(255, 220, 220) },
    { body: color(255, 170, 60), roof: color(255, 235, 190) },
    { body: color(170, 90, 255), roof: color(230, 215, 255) },
    { body: color(70, 220, 150), roof: color(200, 255, 230) }
  ];

  let stylePick = random(styles);

  obstacles.push({
    lane: floor(random(laneCount)),
    y: -90,
    w: playerW * 0.95,
    h: playerH * 0.95,
    body: stylePick.body,
    roof: stylePick.roof
  });
}

function spawnCoin() {
  let roll = random();
  let type;

  if (roll < 0.65) {
    type = {
      label: "G",
      value: 5,
      outer: color(255, 215, 0),
      inner: color(255, 245, 140),
      textColor: color(120, 90, 0),
      pitch: 700
    };
  } else if (roll < 0.9) {
    type = {
      label: "B",
      value: 10,
      outer: color(90, 185, 255),
      inner: color(210, 240, 255),
      textColor: color(20, 80, 150),
      pitch: 880
    };
  } else {
    type = {
      label: "P",
      value: 20,
      outer: color(220, 90, 255),
      inner: color(250, 210, 255),
      textColor: color(120, 0, 120),
      pitch: 1040
    };
  }

  coins.push({
    lane: floor(random(laneCount)),
    y: -50,
    size: min(30, laneWidth * 0.34),
    wobble: random(TWO_PI),
    label: type.label,
    value: type.value,
    outer: type.outer,
    inner: type.inner,
    textColor: type.textColor,
    pitch: type.pitch
  });
}

function spawnBoost() {
  boosts.push({
    lane: floor(random(laneCount)),
    y: -60,
    size: min(34, laneWidth * 0.38),
    spin: random(TWO_PI)
  });
}

function drawWorld() {
  background(140, 210, 255);

  noStroke();
  fill(72, 170, 92);
  rect(width / 2, height / 2, width, height);

  fill(65);
  rect(width / 2, height / 2, roadWidth, height);

  fill(120);
  rect(roadLeft + 3, height / 2, 6, height);
  rect(roadLeft + roadWidth - 3, height / 2, 6, height);

  stroke(255, 230);
  strokeWeight(4);
  for (let i = 1; i < laneCount; i++) {
    let x = roadLeft + laneWidth * i;
    for (let y = -40 + (roadLineOffset % 60); y < height + 40; y += 60) {
      line(x, y, x, y + 28);
    }
  }
  noStroke();
}

function drawPlayer() {
  let x = laneCenter(playerLane);

  if (boostFrames > 0) {
    fill(80, 255, 255, 70 + sin(frameCount * 0.3) * 20);
    ellipse(x, playerY, playerW * 1.7, playerH * 1.5);
  }

  if (hitCooldown > 0 && frameCount % 10 < 5) {
    return;
  }

  let bodyColor = color(50, 130, 255);
  let roofColor = color(235);

  if (boostFrames > 0) {
    bodyColor = color(0, 220, 255);
    roofColor = color(240, 255, 255);
  }

  drawCar(x, playerY, playerW, playerH, bodyColor, roofColor);
}

function drawObstacles() {
  for (let obstacle of obstacles) {
    let x = laneCenter(obstacle.lane);
    drawCar(x, obstacle.y, obstacle.w, obstacle.h, obstacle.body, obstacle.roof);
  }
}

function drawCar(x, y, w, h, bodyColor, roofColor) {
  fill(0, 40);
  ellipse(x, y + h * 0.42, w * 0.8, h * 0.18);

  fill(bodyColor);
  rect(x, y, w, h, 14);

  fill(roofColor);
  rect(x, y - h * 0.1, w * 0.55, h * 0.4, 10);

  fill(255, 255, 180);
  rect(x - w * 0.22, y - h * 0.4, w * 0.16, h * 0.08, 4);
  rect(x + w * 0.22, y - h * 0.4, w * 0.16, h * 0.08, 4);

  fill(255, 70, 70);
  rect(x - w * 0.22, y + h * 0.4, w * 0.16, h * 0.08, 4);
  rect(x + w * 0.22, y + h * 0.4, w * 0.16, h * 0.08, 4);
}

function drawCoins() {
  for (let coin of coins) {
    let x = laneCenter(coin.lane);
    let y = coin.y + sin(frameCount * 0.18 + coin.wobble) * 4;

    fill(coin.outer);
    ellipse(x, y, coin.size, coin.size);

    fill(coin.inner);
    ellipse(x, y, coin.size * 0.56, coin.size * 0.56);

    fill(coin.textColor);
    textSize(coin.size * 0.42);
    text(coin.label, x, y + 1);
  }
}

function drawBoosts() {
  for (let boost of boosts) {
    let x = laneCenter(boost.lane);
    let y = boost.y;
    let s = boost.size;

    push();
    translate(x, y);
    rotate(boost.spin);
    fill(0, 255, 255);
    rect(0, 0, s, s, 8);
    fill(255);
    textSize(s * 0.48);
    text("B", 0, 1);
    pop();
  }
}

function drawHud() {
  fill(255, 235);
  rect(width * 0.22, 34, 105, 42, 12);
  rect(width * 0.54, 34, 105, 42, 12);
  rect(width * 0.82, 34, 105, 42, 12);

  fill(20);
  textSize(18);
  text("Score: " + score, width * 0.22, 34);
  text("Coins: " + coinsCollected, width * 0.54, 34);
  text("Lives: " + lives, width * 0.82, 34);

  fill(255, 240);
  rect(width / 2, height - 24, 220, 28, 10);
  fill(25);
  textSize(14);

  if (gameState === "playing") {
    if (boostFrames > 0) {
      text(
        "Difficulty: " + currentDifficulty + " | BOOST ON",
        width / 2,
        height - 24
      );
    } else {
      text(
        "Difficulty: " + currentDifficulty + " | Tap left/right",
        width / 2,
        height - 24
      );
    }
  } else {
    text("Difficulty: " + currentDifficulty, width / 2, height - 24);
  }
}

function drawMenuScreen() {
  fill(0, 0, 0, 135);
  rect(width / 2, height / 2, width, height);

  fill(255);
  textSize(34);
  text("Lane Dodge Deluxe", width / 2, height / 2 - 150);

  textSize(19);
  text("Choose a difficulty", width / 2, height / 2 - 95);
  text("3 lives • 3 coin types • boost power-up", width / 2, height / 2 - 63);
  text("Tiny background music starts after your tap", width / 2, height / 2 - 35);

  for (let button of difficultyButtons) {
    let buttonColor;
    if (button.label === "Easy") {
      buttonColor = color(80, 200, 120);
    } else if (button.label === "Normal") {
      buttonColor = color(70, 150, 255);
    } else {
      buttonColor = color(255, 120, 80);
    }
    drawButton(button, buttonColor);
  }

  fill(255);
  textSize(16);
  text("Best Score: " + bestScore, width / 2, height / 2 + 195);
}

function drawGameOverScreen() {
  fill(0, 0, 0, 145);
  rect(width / 2, height / 2, width, height);

  fill(255);
  textSize(38);
  text("Game Over", width / 2, height / 2 - 78);

  textSize(22);
  text("Final Score: " + score, width / 2, height / 2 - 28);
  text("Coins Collected: " + coinsCollected, width / 2, height / 2 + 4);
  text("Difficulty: " + currentDifficulty, width / 2, height / 2 + 36);
  text("Best Score: " + bestScore, width / 2, height / 2 + 68);

  drawButton(restartButton, color(50, 200, 120));
  drawButton(menuButton, color(90, 140, 255));
}

function drawButton(button, buttonColor) {
  fill(buttonColor);
  rect(button.x, button.y, button.w, button.h, 14);
  fill(255);
  textSize(24);
  text(button.label, button.x, button.y);
}

function laneCenter(laneNumber) {
  return roadLeft + laneWidth * laneNumber + laneWidth / 2;
}

function isCarColliding(obstacle) {
  let playerX = laneCenter(playerLane);
  let obstacleX = laneCenter(obstacle.lane);

  let hitOnX = abs(playerX - obstacleX) < (playerW * 0.8 + obstacle.w * 0.8) / 2;
  let hitOnY = abs(playerY - obstacle.y) < (playerH * 0.82 + obstacle.h * 0.82) / 2;

  return hitOnX && hitOnY;
}

function isCoinCollected(coin) {
  let playerX = laneCenter(playerLane);
  let coinX = laneCenter(coin.lane);

  return dist(playerX, playerY, coinX, coin.y) < playerW * 0.35 + coin.size * 0.4;
}

function isBoostCollected(boost) {
  let playerX = laneCenter(playerLane);
  let boostX = laneCenter(boost.lane);

  return dist(playerX, playerY, boostX, boost.y) < playerW * 0.35 + boost.size * 0.42;
}

function pointInButton(x, y, button) {
  return (
    x > button.x - button.w / 2 &&
    x < button.x + button.w / 2 &&
    y > button.y - button.h / 2 &&
    y < button.y + button.h / 2
  );
}

function handleTap(x, y) {
  initAudio();

  if (gameState === "menu") {
    for (let button of difficultyButtons) {
      if (pointInButton(x, y, button)) {
        startRound(button.label);
        return false;
      }
    }
    return false;
  }

  if (gameState === "gameover") {
    if (pointInButton(x, y, restartButton)) {
      startRound(currentDifficulty);
      return false;
    }

    if (pointInButton(x, y, menuButton)) {
      resetRound();
      gameState = "menu";
      return false;
    }

    return false;
  }

  if (x < width / 2) {
    if (playerLane > 0) {
      playerLane--;
      playMoveSound();
    }
  } else {
    if (playerLane < laneCount - 1) {
      playerLane++;
      playMoveSound();
    }
  }

  return false;
}

function mousePressed() {
  return handleTap(mouseX, mouseY);
}

function touchStarted() {
  if (touches.length > 0) {
    return handleTap(touches[0].x, touches[0].y);
  }
  return false;
}

function windowResized() {
  resizeCanvas(min(windowWidth, 420), min(windowHeight, 760));
  setLayout();
}

function initAudio() {
  if (!audioCtx) {
    let AudioThing = window.AudioContext || window.webkitAudioContext;
    if (AudioThing) {
      audioCtx = new AudioThing();
    }
  }

  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playBeep(freq, duration, type, volume, delay) {
  if (!audioCtx) {
    return;
  }

  let startTime = audioCtx.currentTime + delay;

  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

function updateMusic() {
  if (!audioCtx) {
    return;
  }

  if (frameCount - lastMusicFrame >= 22) {
    let notes = [262, 330, 392, 330, 294, 349, 440, 349];
    playBeep(notes[musicIndex % notes.length], 0.11, "triangle", 0.006, 0);
    musicIndex++;
    lastMusicFrame = frameCount;
  }
}

function playMoveSound() {
  playBeep(320, 0.05, "square", 0.015, 0);
}

function playCoinSound(pitch) {
  playBeep(pitch, 0.05, "triangle", 0.022, 0);
  playBeep(pitch * 1.22, 0.07, "triangle", 0.016, 0.05);
}

function playCrashSound() {
  playBeep(220, 0.08, "sawtooth", 0.03, 0);
  playBeep(140, 0.15, "sawtooth", 0.03, 0.08);
}

function playBoostSound() {
  playBeep(520, 0.05, "square", 0.02, 0);
  playBeep(760, 0.05, "square", 0.02, 0.05);
  playBeep(980, 0.08, "triangle", 0.018, 0.1);
}

function playBoostSmashSound() {
  playBeep(180, 0.04, "square", 0.02, 0);
  playBeep(240, 0.05, "square", 0.018, 0.03);
}

function playStartSound() {
  playBeep(400, 0.05, "triangle", 0.02, 0);
  playBeep(520, 0.06, "triangle", 0.02, 0.06);
}
