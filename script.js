class Game {
  constructor() {
    this.elements = {
      board: document.getElementById("game-board"),
      player: document.getElementById("player"),
      scoreDisplay: document.getElementById("score"),
      levelDisplay: document.getElementById("level"),
      livesDisplay: document.getElementById("player-lives"),
      startScreen: document.getElementById("start-screen"),
      gameOverScreen: document.getElementById("game-over-screen"),
      finalScore: document.getElementById("final-score"),
      startButton: document.getElementById("start-button"),
      restartButton: document.getElementById("restart-button"),
      bossHealthContainer: document.getElementById("boss-health-container"),
      bossHealthBar: document.getElementById("boss-health-bar"),
      achievementPopup: document.getElementById("achievement-popup"),
      achievementText: document.getElementById("achievement-text"),
    };

    this.enemyTypes = {
      GRUNT: {
        emoji: "👾",
        className: "grunt",
        health: 1,
        score: 10,
        speed: 2.5,
      },
      SCOUT: {
        emoji: "👽",
        className: "scout",
        health: 1,
        score: 20,
        speed: 4,
      },
      TANK: {
        emoji: "👹",
        className: "tank",
        health: 3,
        score: 50,
        speed: 1.5,
      },
    };

    this.boardRect = this.elements.board.getBoundingClientRect();
    this.config = {};
    this.state = {};
    this.entities = {};
    this.init();
  }

  // --- GAME STATE & CORE LOOP ---

  init() {
    this.elements.board.addEventListener("mousemove", (e) => {
      if (this.state.gameState !== "IDLE") {
        const playerX = e.clientX - this.boardRect.left;
        this.elements.player.style.left = `${Math.max(
          50,
          Math.min(playerX, this.boardRect.width - 50)
        )}px`;
      }
    });
    const shootAction = () => {
      if (this.state.gameState !== "IDLE") this.shoot();
    };
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") shootAction();
    });
    this.elements.board.addEventListener("click", shootAction);
    this.elements.startButton.addEventListener("click", () => this.startGame());
    this.elements.restartButton.addEventListener("click", () =>
      this.startGame()
    );
  }

  resetGame() {
    this.config = {
      player: {
        initialLives: 3,
        maxLives: 5,
        shootCooldown: 300,
        maxWeaponLevel: 5,
        invincibilityDuration: 2000,
      },
      powerUp: { dropChance: 0.15, speed: 2 },
      game: { scorePerLevel: 300, bossLevelInterval: 10 },
    };
    this.state = {
      score: 0,
      level: 1,
      lives: this.config.player.initialLives,
      weaponLevel: 1,
      gameState: "IDLE",
      isShielded: false,
      isInvincible: false,
      gameFrame: 0,
      canShoot: true,
      boss: null,
      achievements: {},
      nextSpawnFrame: 0,
    };
    this.entities = { bullets: [], enemies: [], powerUps: [] };
    [
      ...this.elements.board.querySelectorAll(".bullet, .enemy, .powerup"),
    ].forEach((el) => el.remove());
  }

  startGame() {
    this.resetGame();
    this.state.gameState = "PLAYING";
    this.updateUI();
    this.elements.startScreen.style.display = "none";
    this.elements.gameOverScreen.style.display = "none";
    this.elements.player.className = "";
    document.body.style.cursor = "none";
    this.gameLoop();
  }

  endGame() {
    if (this.state.gameState === "IDLE") return;
    this.state.gameState = "IDLE";
    this.elements.finalScore.innerText = this.state.score;
    this.elements.gameOverScreen.style.display = "flex";
    this.elements.bossHealthContainer.classList.add("hidden");
    document.body.style.cursor = "default";
  }

  gameLoop() {
    if (this.state.gameState === "IDLE") return;
    this.state.gameFrame++;
    this.update();
    requestAnimationFrame(() => this.gameLoop());
  }

  update() {
    this.updateEntities();
    this.checkCollisions();
    this.cleanupEntities();

    if (this.state.gameState === "PLAYING") {
      this.updateLevel();
      if (this.state.gameFrame >= this.state.nextSpawnFrame) {
        this.spawnEnemyWave();
        const spawnRate = Math.max(20, 90 - this.state.level * 3);
        this.state.nextSpawnFrame = this.state.gameFrame + spawnRate;
      }
    } else if (this.state.gameState === "BOSS_BATTLE") {
      this.updateBoss();
    }
  }

  updateUI() {
    this.elements.scoreDisplay.innerText = this.state.score;
    this.elements.levelDisplay.innerText = this.state.level;
    this.elements.livesDisplay.innerHTML = "❤️".repeat(this.state.lives);
  }

  updateLevel() {
    const newLevel =
      Math.floor(this.state.score / this.config.game.scorePerLevel) + 1;
    if (newLevel > this.state.level) {
      this.state.level = newLevel;
      this.updateUI();
      if (this.state.level % this.config.game.bossLevelInterval === 0) {
        this.initiateBossBattle();
      }
    }
  }

  // --- ENTITY, SPAWNING, and MOVEMENT ---

  updateEntities() {
    const move = (entity, y, x = 0) => {
      entity.style.top = `${parseFloat(entity.style.top) + y}px`;
      if (x !== 0) entity.style.left = `${parseFloat(entity.style.left) + x}px`;
    };
    this.entities.bullets.forEach((b) =>
      move(b, -10, parseFloat(b.dataset.vx || 0))
    );

    // --- THIS IS THE FIX ---
    // Only apply generic downward movement to non-boss enemies.
    this.entities.enemies.forEach((e) => {
      if (!e.classList.contains("boss")) {
        move(e, parseFloat(e.dataset.speed));
      }
    });

    this.entities.powerUps.forEach((p) => move(p, this.config.powerUp.speed));
  }

  spawnEnemyWave() {
    const level = this.state.level;
    let pool = [{ type: "GRUNT", weight: 10 }];
    if (level >= 3) pool.push({ type: "SCOUT", weight: 5 });
    if (level >= 5) pool.push({ type: "TANK", weight: 3 });
    if (level >= 12) pool.push({ type: "SCOUT", weight: 5 });
    if (level >= 15) pool.push({ type: "TANK", weight: 3 });
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    const rand = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    let selectedTypeKey = pool[0].type;
    for (const item of pool) {
      cumulativeWeight += item.weight;
      if (rand < cumulativeWeight) {
        selectedTypeKey = item.type;
        break;
      }
    }
    const enemyType = this.enemyTypes[selectedTypeKey];
    this.createEnemy(enemyType);
  }

  createEnemy(type, x, y) {
    const enemy = document.createElement("div");
    enemy.className = `enemy ${type.className}`;
    enemy.innerText = type.emoji;
    enemy.dataset.health = type.health;
    enemy.dataset.score = type.score;
    enemy.dataset.speed = type.speed;
    enemy.style.left = x
      ? `${x}px`
      : `${Math.random() * (this.boardRect.width - 60) + 30}px`;
    enemy.style.top = y ? `${y}px` : "-60px";
    this.elements.board.appendChild(enemy);
    this.entities.enemies.push(enemy);
    return enemy;
  }

  // --- BOSS LOGIC ---

  initiateBossBattle() {
    this.state.gameState = "BOSS_BATTLE";
    this.entities.enemies.forEach((e) => (e.dataset.remove = "true"));
    const bossTier = this.state.level / this.config.game.bossLevelInterval;
    const health = 150 * bossTier;
    const bossElement = this.createEnemy(
      {
        emoji: "😈",
        className: "boss",
        health,
        score: 1000 * bossTier,
        speed: 0.5,
      },
      this.boardRect.width / 2 - 60,
      -150
    );
    this.state.boss = {
      element: bossElement,
      maxHealth: health,
      currentHealth: health,
      vx: 1.5,
    };
    this.elements.bossHealthContainer.classList.remove("hidden");
    this.elements.bossHealthBar.style.width = "100%";
  }

  updateBoss() {
    const boss = this.state.boss;
    if (!boss) return;
    let newLeft = parseFloat(boss.element.style.left) + boss.vx;
    if (newLeft <= 0 || newLeft >= this.boardRect.width - 120) {
      boss.vx *= -1;
    }
    boss.element.style.left = `${newLeft}px`;

    // This logic now works correctly as it's the only one controlling vertical movement.
    if (parseFloat(boss.element.style.top) < 50) {
      boss.element.style.top = `${
        parseFloat(boss.element.style.top) +
        parseFloat(boss.element.dataset.speed)
      }px`;
    }
  }

  damageBoss(amount) {
    const boss = this.state.boss;
    if (!boss) return;
    boss.currentHealth -= amount;
    const healthPercent =
      Math.max(0, boss.currentHealth / boss.maxHealth) * 100;
    this.elements.bossHealthBar.style.width = `${healthPercent}%`;
    if (boss.currentHealth <= 0) {
      this.defeatBoss();
    }
  }

  defeatBoss() {
    this.state.score += parseInt(this.state.boss.element.dataset.score);
    this.state.boss.element.dataset.remove = "true";
    this.state.boss = null;
    this.elements.bossHealthContainer.classList.add("hidden");
    this.state.gameState = "PLAYING";
    if (this.state.weaponLevel < this.config.player.maxWeaponLevel)
      this.state.weaponLevel++;
    if (this.state.lives < this.config.player.maxLives) this.state.lives++;
    this.unlockAchievement(`GUARDIAN_SLAYER_${this.state.level / 10}`);
    this.updateUI();
  }

  // --- PLAYER ACTIONS, POWER-UPS, & COLLISION ---

  shoot() {
    if (!this.state.canShoot) return;
    this.state.canShoot = false;
    setTimeout(() => {
      this.state.canShoot = true;
    }, this.config.player.shootCooldown);
    const playerRect = this.elements.player.getBoundingClientRect();
    const baseLeft =
      playerRect.left + playerRect.width / 2 - 5 - this.boardRect.left;
    const baseTop = playerRect.top - this.boardRect.top;
    const createBullet = (offsetX = 0, velocityX = 0) => {
      const bullet = document.createElement("div");
      bullet.className = "bullet";
      bullet.style.left = `${baseLeft + offsetX}px`;
      bullet.style.top = `${baseTop}px`;
      bullet.dataset.vx = velocityX;
      this.elements.board.appendChild(bullet);
      this.entities.bullets.push(bullet);
    };
    switch (this.state.weaponLevel) {
      case 1:
        createBullet();
        break;
      case 2:
        createBullet(-8);
        createBullet(8);
        break;
      case 3:
        createBullet(0, 0);
        createBullet(-5, -2);
        createBullet(5, 2);
        break;
      case 4:
        createBullet(-15, -1);
        createBullet(-5, 0);
        createBullet(5, 0);
        createBullet(15, 1);
        break;
      case 5:
      default:
        createBullet(0, 0);
        createBullet(-10, -3);
        createBullet(10, 3);
        createBullet(-20, -1.5);
        createBullet(20, 1.5);
        break;
    }
  }

  playerHit() {
    if (this.state.isInvincible) return;
    if (this.state.isShielded) {
      this.state.isShielded = false;
      this.elements.player.classList.remove("shielded");
    } else {
      this.state.lives--;
      if (this.state.lives <= 0) {
        this.updateUI();
        this.endGame();
        return;
      }
    }
    this.updateUI();
    this.state.isInvincible = true;
    this.elements.player.classList.add("invincible");
    setTimeout(() => {
      this.state.isInvincible = false;
      this.elements.player.classList.remove("invincible");
    }, this.config.player.invincibilityDuration);
  }

  spawnPowerUp(x, y) {
    const powerUp = document.createElement("div");
    const rand = Math.random();
    let type, emoji;
    if (rand < 0.15) {
      type = "EXTRA_LIFE";
      emoji = "💖";
    } else if (rand < 0.5) {
      type = "SHIELD";
      emoji = "🛡️";
    } else {
      type = "WEAPON_UPGRADE";
      emoji = "⬆️";
    }
    powerUp.className = "powerup";
    powerUp.dataset.type = type;
    powerUp.innerText = emoji;
    powerUp.style.left = `${x}px`;
    powerUp.style.top = `${y}px`;
    this.elements.board.appendChild(powerUp);
    this.entities.powerUps.push(powerUp);
  }

  applyPowerUp(type) {
    if (type === "WEAPON_UPGRADE") {
      if (this.state.weaponLevel < this.config.player.maxWeaponLevel)
        this.state.weaponLevel++;
      else this.state.score += 100;
    } else if (type === "SHIELD") {
      this.state.isShielded = true;
      this.elements.player.classList.add("shielded");
    } else if (type === "EXTRA_LIFE") {
      if (this.state.lives < this.config.player.maxLives) this.state.lives++;
      else this.state.score += 200;
    }
    this.updateUI();
  }

  isColliding(rect1, rect2) {
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    );
  }

  checkCollisions() {
    const playerRect = this.elements.player.getBoundingClientRect();
    this.entities.enemies.forEach((enemy) => {
      if (this.isColliding(enemy.getBoundingClientRect(), playerRect)) {
        this.playerHit();
        enemy.dataset.remove = "true";
      }
    });
    if (
      this.state.boss &&
      this.isColliding(
        this.state.boss.element.getBoundingClientRect(),
        playerRect
      )
    ) {
      this.playerHit();
    }
    this.entities.powerUps.forEach((p) => {
      if (this.isColliding(p.getBoundingClientRect(), playerRect)) {
        this.applyPowerUp(p.dataset.type);
        p.dataset.remove = "true";
      }
    });

    this.entities.bullets.forEach((bullet) => {
      if (
        this.state.boss &&
        this.isColliding(
          bullet.getBoundingClientRect(),
          this.state.boss.element.getBoundingClientRect()
        )
      ) {
        this.damageBoss(1);
        bullet.dataset.remove = "true";
        return;
      }
      this.entities.enemies.forEach((enemy) => {
        if (bullet.dataset.remove || enemy.dataset.remove) return;
        if (
          this.isColliding(
            bullet.getBoundingClientRect(),
            enemy.getBoundingClientRect()
          )
        ) {
          bullet.dataset.remove = "true";
          enemy.dataset.health--;
          if (enemy.dataset.health <= 0) {
            enemy.dataset.remove = "true";
            this.state.score += parseInt(enemy.dataset.score);
            if (Math.random() < this.config.powerUp.dropChance) {
              this.spawnPowerUp(
                parseFloat(enemy.style.left),
                parseFloat(enemy.style.top)
              );
            }
            this.updateUI();
          }
        }
      });
    });
  }

  cleanupEntities() {
    const filterAndRemove = (arr) =>
      arr.filter((e) => {
        if (e.dataset.remove) {
          e.remove();
          return false;
        }
        if (
          parseFloat(e.style.top) > this.boardRect.height + 50 ||
          parseFloat(e.style.top) < -150
        ) {
          e.remove();
          return false;
        }
        return true;
      });
    this.entities.bullets = filterAndRemove(this.entities.bullets);
    this.entities.enemies = filterAndRemove(this.entities.enemies);
    this.entities.powerUps = filterAndRemove(this.entities.powerUps);
  }

  unlockAchievement(id) {
    if (this.state.achievements[id]) return;
    this.state.achievements[id] = true;
    const achievementNames = {
      GUARDIAN_SLAYER_1: "First Blood",
      GUARDIAN_SLAYER_2: "Gatekeeper",
      GUARDIAN_SLAYER_3: "Cosmic Conqueror",
    };
    this.elements.achievementText.innerText =
      achievementNames[id] || `Victor of Level ${this.state.level}`;
    this.elements.achievementPopup.classList.remove("hidden");
    setTimeout(() => {
      this.elements.achievementPopup.classList.add("hidden");
    }, 4000);
  }
}

window.onload = () => {
  new Game();
};
