// DEPTH FIRST SEARCH MAZE IMPLEMENTATION IN JAVASCRIPT BY CONOR BAILEY

// Initialize the canvas
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

let current;
let goal;

class Maze {
    constructor(size, rows, columns) {
        this.size = size;
        this.columns = columns;
        this.rows = rows;
        this.grid = [];
        this.stack = [];
    }

  // Set the grid: Create new this.grid array based on number of instance rows and columns
    setup() {
        for (let r = 0; r < this.rows; r++) {
            let row = [];
            for (let c = 0; c < this.columns; c++) {
                // Create a new instance of the Cell class for each element in the 2D array and push to the maze grid array
                let cell = new Cell(r, c, this.grid, this.size);
                row.push(cell);
            }
            this.grid.push(row);
        }
        // Set the starting grid
        current = this.grid[0][0];
        this.grid[this.rows - 1][this.columns - 1].goal = true;
    }

  // Draw the canvas by setting the size and placing thke cells in the grid array on the canvas.
    generateMaze() {
        
        let stack = [];
        let current = this.grid[0][0];
        current.visited = true;

        while (true) {
            let next = current.checkNeighbours();
            if (next) {
                next.visited = true;
                stack.push(current);
                current.removeWalls(current, next);
                current = next;
            } else if (stack.length > 0) {
                current = stack.pop();
            } else {
                break; // acabou
            }
        }
    }

    // -----------------------
    // Construir labirinto
    // -----------------------
    buildMaze(scene, world, physics) {
        const cellSize = 50;      // tamanho de cada célula no espaço 3D
        const wallHeight = 60;
        const wallThickness = 3;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.columns; c++) {
                const cell = this.grid[r][c];
                const x = c * cellSize;
                const z = r * cellSize;

                // Top wall (horizontal)
                if (cell.walls.topWall) {
                    this.makeWall(
                        x,                          // x: centro da célula
                        wallHeight / 2,             // y: metade da altura
                        z - cellSize / 2,           // z: borda superior da célula
                        cellSize + wallThickness,   // width: largura da célula + espessura
                        wallHeight,                 // height: altura da parede
                        wallThickness,              // depth: espessura da parede
                        0,                          // rotation: sem rotação (horizontal)
                        scene,
                        world,
                        physics
                    );
                }
                // Bottom wall (horizontal)
                if (cell.walls.bottomWall) {
                    this.makeWall(
                        x,                          // x: centro da célula
                        wallHeight / 2,             // y: metade da altura
                        z + cellSize / 2,           // z: borda inferior da célula
                        cellSize + wallThickness,   // width: largura da célula + espessura
                        wallHeight,                 // height: altura da parede
                        wallThickness,              // depth: espessura da parede
                        0,                          // rotation: sem rotação (horizontal)
                        scene,
                        world,
                        physics
                    );
                }
                // Left wall (vertical)
                if (cell.walls.leftWall) {
                    this.makeWall(
                        x - cellSize / 2,           // x: borda esquerda da célula
                        wallHeight / 2,             // y: metade da altura
                        z,                          // z: centro da célula
                        wallThickness,              // width: espessura da parede
                        wallHeight,                 // height: altura da parede
                        cellSize + wallThickness,   // depth: comprimento da célula + espessura
                        0,                          // rotation: sem rotação (já está orientada corretamente)
                        scene,
                        world,
                        physics
                    );
                }
                // Right wall (vertical)
                if (cell.walls.rightWall) {
                    this.makeWall(
                        x + cellSize / 2,           // x: borda direita da célula
                        wallHeight / 2,             // y: metade da altura
                        z,                          // z: centro da célula
                        wallThickness,              // width: espessura da parede
                        wallHeight,                 // height: altura da parede
                        cellSize + wallThickness,   // depth: comprimento da célula + espessura
                        0,                          // rotation: sem rotação (já está orientada corretamente)
                        scene,
                        world,
                        physics
                    );
                }
            }
        }

        // Marcadores (somente mesh para visual)
        this.makeMarker(0 * cellSize, 0 * cellSize, 0x0000ff, scene); // azul
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.columns; c++) {
                if (this.grid[r][c].goal) this.makeMarker(c * cellSize, r * cellSize, 0xff0000, scene); // vermelho
            }
        }
    }

    // -----------------------
    // Paredes: Mesh + Corpo físico
    // -----------------------
    makeWall(x, y, z, width, height, depth, rotationY, scene, world, physics) {
        // THREE Mesh
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const texture = new THREE.TextureLoader().load('assets/wall.jpg');
        const material = new THREE.MeshStandardMaterial({ map: texture });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(x, y, z);
        wall.rotation.y = rotationY;
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);

        // CANNON Body
        const halfExtents = new CANNON.Vec3(width / 2, height / 2, depth / 2);
        const boxShape = new CANNON.Box(halfExtents);
        const wallBody = new CANNON.Body({
            mass: 0,
            shape: boxShape,
            material: physics.wallMaterial,
        });
        wallBody.position.set(x, y, z);
        const q = new CANNON.Quaternion();
        q.setFromEuler(0, rotationY, 0, 'XYZ');
        wallBody.quaternion.copy(q);
        world.addBody(wallBody);
    }

    // -----------------------
    // Marker visual
    // -----------------------
    makeMarker(x, z, color, scene, size = 40) {
        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            side: THREE.DoubleSide
        });

        const marker = new THREE.Mesh(geometry, material);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(x, 0.05, z);
        scene.add(marker);
    }

    drawMinimap(xPlayer, zPlayer) {
        const canvas = document.getElementById('minimap');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const rows = this.rows;
        const cols = this.columns;

        const w = canvas.width;
        const h = canvas.height;

        const cellW = w / cols;
        const cellH = h / rows;

        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = this.grid[r][c];

                const x = c * cellW;
                const y = r * cellH;

                if (cell.walls.topWall) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + cellW, y);
                    ctx.stroke();
                }

                if (cell.walls.rightWall) {
                    ctx.beginPath();
                    ctx.moveTo(x + cellW, y);
                    ctx.lineTo(x + cellW, y + cellH);
                    ctx.stroke();
                }

                if (cell.walls.bottomWall) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + cellH);
                    ctx.lineTo(x + cellW, y + cellH);
                    ctx.stroke();
                }

                if (cell.walls.leftWall) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + cellH);
                    ctx.stroke();
                }

                if (cell.goal) {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(
                        x + cellW * 0.25,
                        y + cellH * 0.25,
                        cellW * 0.5,
                        cellH * 0.5
                    );
                }
            }
        }

        this.drawPlayer(xPlayer, zPlayer, ctx);
    }

    drawPlayer(px, pz, ctx) {
        const canvas = document.getElementById('minimap');

        ctx.fillStyle = 'lime';

        ctx.beginPath();
        ctx.arc(
            (px / (this.columns * 50)) * canvas.width,
            (pz / (this.rows * 50)) * canvas.height,
            8,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
}

class Cell {
    // Constructor takes in the rowNum and colNum which will be used as coordinates to draw on the canvas.
    constructor(rowNum, colNum, parentGrid, parentSize) {
        this.rowNum = rowNum;
        this.colNum = colNum;
        this.visited = false;
        this.walls = {
        topWall: true,
        rightWall: true,
        bottomWall: true,
        leftWall: true,
        };
        this.goal = false;
        // parentGrid is passed in to enable the checkneighbours method.
        // parentSize is passed in to set the size of each cell on the grid
        this.parentGrid = parentGrid;
        this.parentSize = parentSize;
    }

    checkNeighbours() {
        let grid = this.parentGrid;
        let row = this.rowNum;
        let col = this.colNum;
        let neighbours = [];

        // The following lines push all available neighbours to the neighbours array
        // undefined is returned where the index is out of bounds (edge cases)
        let top = row !== 0 ? grid[row - 1][col] : undefined;
        let right = col !== grid.length - 1 ? grid[row][col + 1] : undefined;
        let bottom = row !== grid.length - 1 ? grid[row + 1][col] : undefined;
        let left = col !== 0 ? grid[row][col - 1] : undefined;

        // if the following are not 'undefined' then push them to the neighbours array
        if (top && !top.visited) neighbours.push(top);
        if (right && !right.visited) neighbours.push(right);
        if (bottom && !bottom.visited) neighbours.push(bottom);
        if (left && !left.visited) neighbours.push(left);

        // Choose a random neighbour from the neighbours array
        if (neighbours.length !== 0) {
            let random = Math.floor(Math.random() * neighbours.length);
            return neighbours[random];
        } else {
            return undefined;
        }
    }

    removeWalls(cell1, cell2) {
        // compares to two cells on x axis
        let x = cell1.colNum - cell2.colNum;
        // Removes the relevant walls if there is a different on x axis
        if (x === 1) {
            cell1.walls.leftWall = false;
            cell2.walls.rightWall = false;
        } else if (x === -1) {
            cell1.walls.rightWall = false;
            cell2.walls.leftWall = false;
        }
        // compares to two cells on x axis
        let y = cell1.rowNum - cell2.rowNum;
        // Removes the relevant walls if there is a different on x axis
        if (y === 1) {
            cell1.walls.topWall = false;
            cell2.walls.bottomWall = false;
        } else if (y === -1) {
            cell1.walls.bottomWall = false;
            cell2.walls.topWall = false;
        }
    }
}

// let newMaze = new Maze(600, 50, 50);
// newMaze.setup();
// newMaze.draw();
export {Maze};