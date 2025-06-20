class Game {
    constructor() {
        this.elements = {
            board: document.getElementById('game-board'),
            player: document.getElementById('player'),
            scoreDisplay: document.getElementById('score'),
            levelDisplay: document.getElementById('level'),
            startScreen: document.getElementById('start-screen'),
            gameOverScreen: document.getElementById('game-over-screen'),
            finalScore: document.getElementById('final-score'),
            startButton: document.getElementById('start-button'),
            restartButton: document.getElementById('restart-button'),
        };

        this.boardRect = this.elements.board.getBoundingClientRect();
        this.config = {};
        this.state = {};
        this.entities = {};

        this.init();
    }

    // --- SETUP & GAME STATE ---

    init() {
        // Player Movement
        this.elements.board.addEventListener('mousemove', e => {
            if (!this.state.isGameOver) {
                const playerX = e.clientX - this.boardRect.left;
                const halfPlayerWidth = this.elements.player.offsetWidth / 2;
                this.elements.player.style.left = `${Math.max(halfPlayerWidth, Math.min(playerX, this.boardRect.width - halfPlayerWidth))}px`;
            }
        });

        // Shooting
        const shootAction = () => { if (!this.state.isGameOver) this.shoot(); };
        document.addEventListener('keydown', e => { if (e.code === 'Space') shootAction(); });
        this.elements.board.addEventListener('click', shootAction);

        // Game State Buttons
        this.elements.startButton.addEventListener('click', () => this.startGame());
        this.elements.restartButton.addEventListener('click', () => this.startGame());
    }

    resetGame() {
        this.config = {
            player: {
                shootCooldown: 300, // ms
                maxWeaponLevel: 5,
            },
            enemy: {
                baseSpeed: 2,
                baseSpawnInterval: 60, // frames
                tankHealth: 3,
                tankSpawnChance: 0.2, // 20%
            },
            powerUp: {
                dropChance: 0.25, // 25% on enemy kill
                speed: 2,
            },
            game: {
                scorePerLevel: 250,
            }
        };

        this.state = {
            score: 0,
            level: 1,
            weaponLevel: 1,
            isGameOver: true,
            isShielded: false,
            gameFrame: 0,
            canShoot: true,
        };

        this.entities = {
            bullets: [],
            enemies: [],
            powerUps: [],
        };

        // Clear all dynamic elements from the board
        [...this.elements.board.querySelectorAll('.bullet, .enemy, .powerup')].forEach(el => el.remove());
    }

    startGame() {
        this.resetGame();
        this.state.isGameOver = false;

        this.updateUI();
        this.elements.startScreen.style.display = 'none';
        this.elements.gameOverScreen.style.display = 'none';
        this.elements.player.classList.remove('shielded');
        document.body.style.cursor = 'none';

        this.gameLoop();
    }

    endGame() {
        if (this.state.isGameOver) return;
        this.state.isGameOver = true;
        this.elements.finalScore.innerText = this.state.score;
        this.elements.gameOverScreen.style.display = 'flex';
        this.elements.player.classList.remove('shielded');
        document.body.style.cursor = 'default';
    }

    // --- GAME LOOP & UPDATES ---

    gameLoop() {
        if (this.state.isGameOver) return;

        this.state.gameFrame++;
        this.update();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.updateEntities();
        this.spawnEnemy();
        this.checkCollisions();
        this.updateLevel();
    }
    
    updateUI() {
        this.elements.scoreDisplay.innerText = this.state.score;
        this.elements.levelDisplay.innerText = this.state.level;
    }

    updateLevel() {
        const newLevel = Math.floor(this.state.score / this.config.game.scorePerLevel) + 1;
        if (newLevel > this.state.level) {
            this.state.level = newLevel;
            // Increase difficulty
            this.config.enemy.baseSpeed += 0.25;
            this.config.enemy.baseSpawnInterval = Math.max(20, this.config.enemy.baseSpawnInterval - 5);
            this.updateUI();
        }
    }
    
    // --- ENTITY MANAGEMENT ---

    updateEntities() {
        const moveEntity = (entity, ySpeed, xSpeed = 0) => {
            entity.style.top = `${parseFloat(entity.style.top) + ySpeed}px`;
            if (xSpeed !== 0) {
                 entity.style.left = `${parseFloat(entity.style.left) + xSpeed}px`;
            }
        };

        // Update Bullets
        this.entities.bullets.forEach(b => moveEntity(b, -10, b.dataset.vx * 1));
        
        // Update Enemies
        this.entities.enemies.forEach(e => moveEntity(e, this.config.enemy.baseSpeed));

        // Update PowerUps
        this.entities.powerUps.forEach(p => moveEntity(p, this.config.powerUp.speed));
        
        // Cleanup off-screen entities
        const isOffScreen = (el) => parseFloat(el.style.top) < -50 || parseFloat(el.style.top) > this.boardRect.height + 50;
        [...this.entities.bullets, ...this.entities.enemies, ...this.entities.powerUps].forEach(entity => {
            if (isOffScreen(entity)) entity.dataset.remove = 'true';
        });
    }

    shoot() {
        if (!this.state.canShoot) return;
        this.state.canShoot = false;
        setTimeout(() => { this.state.canShoot = true; }, this.config.player.shootCooldown);

        const playerRect = this.elements.player.getBoundingClientRect();
        const baseLeft = playerRect.left + (playerRect.width / 2) - 5 - this.boardRect.left;
        const baseTop = playerRect.top - this.boardRect.top;
        
        const createBullet = (offsetX = 0, velocityX = 0) => {
            const bullet = document.createElement('div');
            bullet.className = 'bullet';
            bullet.style.left = `${baseLeft + offsetX}px`;
            bullet.style.top = `${baseTop}px`;
            bullet.dataset.vx = velocityX; // Horizontal velocity
            this.elements.board.appendChild(bullet);
            this.entities.bullets.push(bullet);
        };
        
        // Different shot patterns based on weapon level
        switch(this.state.weaponLevel) {
            case 1: // Center
                createBullet();
                break;
            case 2: // Two parallel
                createBullet(-8);
                createBullet(8);
                break;
            case 3: // Three-way spread
                createBullet(0, 0); // Center
                createBullet(-5, -2); // Left
                createBullet(5, 2); // Right
                break;
            case 4: // Two parallel + spread
                createBullet(-15, -1);
                createBullet(-5, 0);
                createBullet(5, 0);
                createBullet(15, 1);
                break;
            case 5: // Five-way spread
            default:
                createBullet(0, 0);
                createBullet(-10, -3);
                createBullet(10, 3);
                createBullet(-20, -1.5);
                createBullet(20, 1.5);
                break;
        }
    }
    
    spawnEnemy() {
        if (this.state.gameFrame % this.config.enemy.baseSpawnInterval !== 0) return;

        const enemy = document.createElement('div');
        const isTank = Math.random() < this.config.enemy.tankSpawnChance;

        enemy.className = `enemy ${isTank ? 'tank' : ''}`;
        enemy.innerText = isTank ? '👹' : '👾';
        enemy.dataset.health = isTank ? this.config.enemy.tankHealth : 1;
        enemy.dataset.score = isTank ? 50 : 10;
        
        enemy.style.left = `${Math.random() * (this.boardRect.width - 40)}px`;
        enemy.style.top = '-50px';

        this.elements.board.appendChild(enemy);
        this.entities.enemies.push(enemy);
    }

    spawnPowerUp(x, y) {
        const powerUp = document.createElement('div');
        const type = Math.random() < 0.6 ? 'WEAPON_UPGRADE' : 'SHIELD'; // 60% chance for weapon

        powerUp.className = 'powerup';
        powerUp.dataset.type = type;
        powerUp.innerText = type === 'WEAPON_UPGRADE' ? '⬆️' : '🛡️';
        
        powerUp.style.left = `${x}px`;
        powerUp.style.top = `${y}px`;

        this.elements.board.appendChild(powerUp);
        this.entities.powerUps.push(powerUp);
    }

    applyPowerUp(type) {
        if (type === 'WEAPON_UPGRADE') {
            if (this.state.weaponLevel < this.config.player.maxWeaponLevel) {
                this.state.weaponLevel++;
            } else { // If maxed out, give score instead
                this.state.score += 100;
            }
        } else if (type === 'SHIELD') {
            this.state.isShielded = true;
            this.elements.player.classList.add('shielded');
        }
        this.updateUI();
    }
    
    // --- COLLISION DETECTION ---

    isColliding(rect1, rect2) {
        return !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
    }

    checkCollisions() {
        const playerRect = this.elements.player.getBoundingClientRect();

        // Player vs Enemies
        this.entities.enemies.forEach(enemy => {
            if (this.isColliding(enemy.getBoundingClientRect(), playerRect)) {
                if (this.state.isShielded) {
                    this.state.isShielded = false;
                    this.elements.player.classList.remove('shielded');
                    enemy.dataset.remove = 'true'; // Destroy enemy on shield hit
                } else {
                    this.endGame();
                }
            }
        });

        // Player vs Power-ups
        this.entities.powerUps.forEach(powerUp => {
            if (this.isColliding(powerUp.getBoundingClientRect(), playerRect)) {
                this.applyPowerUp(powerUp.dataset.type);
                powerUp.dataset.remove = 'true';
            }
        });

        // Bullets vs Enemies
        this.entities.bullets.forEach(bullet => {
            this.entities.enemies.forEach(enemy => {
                // Skip if either is already marked for removal
                if (bullet.dataset.remove || enemy.dataset.remove) return;

                if (this.isColliding(bullet.getBoundingClientRect(), enemy.getBoundingClientRect())) {
                    bullet.dataset.remove = 'true';
                    enemy.dataset.health--;
                    
                    if (enemy.dataset.health <= 0) {
                        enemy.dataset.remove = 'true';
                        this.state.score += parseInt(enemy.dataset.score);
                        if (Math.random() < this.config.powerUp.dropChance) {
                            this.spawnPowerUp(parseFloat(enemy.style.left), parseFloat(enemy.style.top));
                        }
                        this.updateUI();
                    }
                }
            });
        });
        
        // Perform cleanup of entities marked for removal
        this.cleanupEntities();
    }

    cleanupEntities() {
        const filterAndRemove = (arr) => {
            const survivors = arr.filter(e => {
                if (e.dataset.remove) {
                    e.remove();
                    return false;
                }
                return true;
            });
            return survivors;
        };

        this.entities.bullets = filterAndRemove(this.entities.bullets);
        this.entities.enemies = filterAndRemove(this.entities.enemies);
        this.entities.powerUps = filterAndRemove(this.entities.powerUps);
    }
}

window.onload = () => {
    new Game();
};
