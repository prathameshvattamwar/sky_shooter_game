class Game {
    constructor() {
        this.elements = {
            board: document.getElementById('game-board'),
            player: document.getElementById('player'),
            score: document.getElementById('score'),
            startScreen: document.getElementById('start-screen'),
            gameOverScreen: document.getElementById('game-over-screen'),
            finalScore: document.getElementById('final-score'),
            startButton: document.getElementById('start-button'),
            restartButton: document.getElementById('restart-button'),
        };

        this.state = {
            score: 0,
            isGameOver: true,
            gameFrame: 0,
            canShoot: true,
            shootCooldown: 300, // milliseconds
        };

        this.entities = {
            bullets: [],
            enemies: [],
        };

        this.boardRect = this.elements.board.getBoundingClientRect();
        this.init();
    }

    init() {
        // Player Movement
        this.elements.board.addEventListener('mousemove', e => {
            if (!this.state.isGameOver) {
                const playerX = e.clientX - this.boardRect.left;
                // Constrain player within the board
                const halfPlayerWidth = this.elements.player.offsetWidth / 2;
                this.elements.player.style.left = `${Math.max(halfPlayerWidth, Math.min(playerX, this.boardRect.width - halfPlayerWidth))}px`;
            }
        });

        // Shooting
        document.addEventListener('keydown', e => {
            if (e.code === 'Space' && !this.state.isGameOver) this.shoot();
        });
        this.elements.board.addEventListener('click', () => {
            if (!this.state.isGameOver) this.shoot();
        });

        // Game State Buttons
        this.elements.startButton.addEventListener('click', () => this.startGame());
        this.elements.restartButton.addEventListener('click', () => this.startGame());
    }

    startGame() {
        this.state.isGameOver = false;
        this.state.score = 0;
        this.state.gameFrame = 0;
        this.elements.score.innerText = this.state.score;
        this.elements.startScreen.style.display = 'none';
        this.elements.gameOverScreen.style.display = 'none';

        // Clear any old entities
        this.entities.bullets.forEach(b => b.remove());
        this.entities.enemies.forEach(e => e.remove());
        this.entities.bullets = [];
        this.entities.enemies = [];

        this.gameLoop();
    }

    gameLoop() {
        if (this.state.isGameOver) return;

        this.state.gameFrame++;
        this.update();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        this.updateBullets();
        this.updateEnemies();
        this.checkCollisions();

        // Spawn a new enemy every 60 frames (roughly 1 per second)
        if (this.state.gameFrame % 60 === 0) {
            this.spawnEnemy();
        }
    }

    shoot() {
        if (!this.state.canShoot) return;

        this.state.canShoot = false;
        setTimeout(() => { this.state.canShoot = true; }, this.state.shootCooldown);

        const playerRect = this.elements.player.getBoundingClientRect();
        const bullet = document.createElement('div');
        bullet.className = 'bullet';
        bullet.style.left = `${playerRect.left + (playerRect.width / 2) - 5 - this.boardRect.left}px`;
        bullet.style.top = `${playerRect.top - this.boardRect.top}px`;

        this.elements.board.appendChild(bullet);
        this.entities.bullets.push(bullet);
    }
    
    spawnEnemy() {
        const enemy = document.createElement('div');
        enemy.className = 'enemy';
        enemy.innerText = '👾';
        
        const spawnX = Math.random() * (this.boardRect.width - 40);
        enemy.style.left = `${spawnX}px`;
        enemy.style.top = '-40px'; // Start just above the screen

        this.elements.board.appendChild(enemy);
        this.entities.enemies.push(enemy);
    }

    updateBullets() {
        this.entities.bullets.forEach((bullet, index) => {
            const currentTop = parseFloat(bullet.style.top);
            bullet.style.top = `${currentTop - 10}px`; // Bullet speed

            if (currentTop < 0) {
                bullet.remove();
                this.entities.bullets.splice(index, 1);
            }
        });
    }

    updateEnemies() {
        this.entities.enemies.forEach((enemy, index) => {
            const currentTop = parseFloat(enemy.style.top);
            enemy.style.top = `${currentTop + 3}px`; // Enemy speed

            if (currentTop > this.boardRect.height) {
                enemy.remove();
                this.entities.enemies.splice(index, 1);
            }
        });
    }

    checkCollisions() {
        const playerRect = this.elements.player.getBoundingClientRect();

        // Check bullet-enemy collisions
        this.entities.bullets.forEach((bullet, bIndex) => {
            const bulletRect = bullet.getBoundingClientRect();

            this.entities.enemies.forEach((enemy, eIndex) => {
                const enemyRect = enemy.getBoundingClientRect();
                
                if (this.isColliding(bulletRect, enemyRect)) {
                    // Collision!
                    enemy.remove();
                    bullet.remove();
                    this.entities.enemies.splice(eIndex, 1);
                    this.entities.bullets.splice(bIndex, 1);
                    this.state.score += 10;
                    this.elements.score.innerText = this.state.score;
                }
            });
        });

        // Check enemy-player collisions
         this.entities.enemies.forEach((enemy) => {
            const enemyRect = enemy.getBoundingClientRect();
            if(this.isColliding(enemyRect, playerRect)){
                this.endGame();
            }
         });
    }
    
    isColliding(rect1, rect2) {
        return !(
            rect1.right < rect2.left ||
            rect1.left > rect2.right ||
            rect1.bottom < rect2.top ||
            rect1.top > rect2.bottom
        );
    }

    endGame() {
        this.state.isGameOver = true;
        this.elements.finalScore.innerText = this.state.score;
        this.elements.gameOverScreen.style.display = 'flex';
    }
}

window.onload = () => {
    new Game();
};
