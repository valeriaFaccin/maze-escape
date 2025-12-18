import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Maze } from './maze.js'
import { PhysicsEngine } from './physicsEngine.js';
import * as CANNON from 'cannon-es';
import GameTimer from './GameTimer.js';

var gameTimer = new GameTimer(10*60);

// Adicionar no início do main.js
let gameState = {
    isLoaded: false,
    difficulty: null, // 'normal' ou 'baby'
    gameStarted: false
};

let loadingProgress = 0;
const totalLoadingSteps = 7

let camera, scene, renderer, controls, playerBody;
let gamePaused = false;
let objects = [];

let world, maze;

const move = { forward: false, backward: false, left: false, right: false };
let loadFinished = false;

var clock = new THREE.Clock();

let ambientLight, sunLight, dirLight, pointLight;

var objLoader = new OBJLoader();
var fbxLoader = new FBXLoader();
const EYE_HEIGHT = 50;     // ~altura dos olhos

// CREATE CHARACTER ---------------------------------------------------------------------------------------------------------------------------

const PlayerState = {
    IDLE: 'idle',
    RUNNING: 'running',
    HIT: 'hit',
    DEAD: 'dead'
};

let playerState = PlayerState.IDLE;

var createAnimatedState = function(fbx) {
    return {
        fbx,
        mixer: new THREE.AnimationMixer(fbx),
        actions: {},
        active: null,
    }
}

// FUNCION MENU -----------------------------------------------------------------

// Função para atualizar progresso de carregamento
function updateLoadingProgress(step, message) {
    loadingProgress = (step / totalLoadingSteps) * 100;
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (progressBar) progressBar.style.width = loadingProgress + '%';
    if (loadingText) loadingText.textContent = message;
    
    if (loadingProgress >= 100) {
        setTimeout(showDifficultySelection, 500);
    }
}

// Mostrar seleção de dificuldade
function showDifficultySelection() {
    const loadingStatus = document.getElementById('loading-status');
    const difficultySelection = document.getElementById('difficulty-selection');
    
    if (loadingStatus) loadingStatus.style.display = 'none';
    if (difficultySelection) difficultySelection.style.display = 'block';
    
    gameState.isLoaded = true;
}

// Iniciar jogo com dificuldade selecionada
function startGame(difficulty) {
    gameState.difficulty = difficulty;
    gameState.gameStarted = true;
    
    // Ocultar menu
    const menuContainer = document.getElementById('menu-container');
    if (menuContainer) menuContainer.style.display = 'none';
    
    // Configurar minimapa baseado na dificuldade
    const minimap = document.getElementById('minimap');
    if (difficulty === 'baby' && minimap) {
        minimap.style.display = 'block';
    }
    
    // Iniciar controles
    if (controls) {
        document.addEventListener('click', () => controls.lock());
    }
    
    console.log(`Jogo iniciado no modo: ${difficulty}`);

    renderer.setAnimationLoop( nossaAnimacao);

}


// Event listeners para os botões
function setupMenuEventListeners() {
    const normalBtn = document.getElementById('normal-mode');
    const babyBtn = document.getElementById('baby-mode');
    
    if (normalBtn)  normalBtn.addEventListener('click', () => startGame('normal'));
    if (babyBtn) babyBtn.addEventListener('click', () => startGame('baby'));
}

document.getElementById('btn-restart').onclick = () => {
    location.reload();
};

document.getElementById('btn-menu').onclick = () => {
    // Exemplo: voltar para menu inicial
    location.reload();
};

document.getElementById('retry-btn')
  .addEventListener('click', () => {
    location.reload();
  });

document.getElementById('menu-btn')
  .addEventListener('click', () => {
    location.reload(); // depois pode trocar por showMenu()
  });

function showWinScreen() {
    document.getElementById('win-overlay').classList.remove('hidden');

    // Pausar jogo
    gamePaused = true;

    // Soltar mouse (PointerLock)
    document.exitPointerLock();
}

function showLoseScreen(reason = 'Você perdeu') {
  const screen = document.getElementById('lose-screen');
  const text = document.getElementById('lose-reason');

  text.textContent = reason;
  screen.classList.remove('hidden');

  document.exitPointerLock();
}



// PERSUE PLAYER ---------------------------------------------------------------------------------------------------------------------------

let nextStudentCheck = 0;
let lastHitTime = 0;
const HIT_COOLDOWN = 2.5;

function updateStudentEncounters(dt, maze) {
    // if (!gameTimer.isRunning()) return;
    if (!objects["students"] || !objects["students"].fbx) return;
    const now = clock.elapsedTime;
    if (now < nextStudentCheck) return;

    const remainingRatio = gameTimer.getRemaining() / (10*60);

    // Intervalo de aparições diminui enquanto o tempo vai acabando 
    const minInterval = 1.0;
    const maxInterval = 5.0;

    const interval = THREE.MathUtils.lerp(minInterval, maxInterval, remainingRatio);

    nextStudentCheck = now + interval;

    maybeTeleportStudent(remainingRatio);
    checkStudentHit();
}

function maybeTeleportStudent(remainingRatio) {
    if (!objects["students"] || !objects["students"].fbx) return;
    if (objects["students"].active !== objects["students"].actions.tocaia) return;

    const playerPos = playerBody.position;
    const student = objects["students"].fbx;

    // Aumenta probabilidade com menor tempo restante
    const spawnChance = THREE.MathUtils.lerp(0.2, 0.8, 1 - remainingRatio);
    if (Math.random() > spawnChance) return;

    const maxRadius = THREE.MathUtils.lerp(80, 20, 1 - remainingRatio);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * maxRadius;

    const x = playerPos.x + Math.cos(angle) * radius;
    const z = playerPos.z + Math.sin(angle) * radius;
    student.position.set(x, 1, z);
}

function checkStudentHit() {
    if (!loadFinished) return;
    if (!objects["students"] || !objects["students"].fbx) return;

    const now = clock.elapsedTime;
    if (now - lastHitTime < HIT_COOLDOWN) return;

    const playerPos = playerBody.position;
    const studentPos = objects["students"].fbx.position;

    console.log("playerPos", playerPos)
    console.log("studentPos", studentPos);

    const dx = playerBody.position.x - studentPos.x;
    const dz = playerBody.position.z - studentPos.z;
    const dist = Math.hypot(dx, dz);
    console.log(dist);

    if (dist < 10) {
        lastHitTime = now;
        onPlayerHitByStudent();
    }
}

// LIGHT --------------------------------------------------------------------------------------------------------------------------------------

var criaIluminacao = function() {
    luzAmbiente();
    luzSolar();
}

var luzSolar = function() {
    sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.castShadow = true;
    sunLight.position.y = 900;

    sunLight.shadow.mapSize.width = 2024;
    sunLight.shadow.mapSize.height = 2024;

    sunLight.shadow.camera.far = 950;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.visible = true;

    scene.add(sunLight);
}

var luzAmbiente = function() {
    ambientLight = new THREE.AmbientLight(0x2b3a55, 0.25);
    ambientLight.visible = true;

    scene.add(ambientLight);
}

var createDirectionalLight = function () {
    dirLight = new THREE.DirectionalLight(0xcad7ff, 0.8);  
    dirLight.position.set(200, 300, 100);
    dirLight.castShadow = true;

    dirLight.visible = true;
    scene.add(dirLight);
};

var createPointLight = function() {
    pointLight = new THREE.PointLight(0x3aff7a, 5, 120);
    pointLight.position.set(0, 20, 0);
    pointLight.castShadow = true;

    let secondPointLight = new THREE.PointLight(0x00ff00, 5, 120);
    secondPointLight.position.set(350, 7, 350);
    secondPointLight.castShadow = true;
    secondPointLight.visible = true;
    scene.add(secondPointLight);
    console.log(secondPointLight);

    pointLight.visible = true;
    scene.add(pointLight);
}

// LOAD OBJECTS -------------------------------------------------------------------------------------------------------------------------------

var loadObj = function(){
    objLoader.load(
        "assets/Wolf.obj",
        function(obj){
            obj.traverse(function (child){
                if (child instanceof THREE.Mesh){
                    child.material = new THREE.MeshNormalMaterial();
                }
            });
            scene.add(obj);
            objects["lobao"] = obj;
            let positionX = (maze.columns - 1) * maze.cellSize;
            let positionZ = (maze.rows - 1) * maze.cellSize;
            obj.position.set(positionX, 0, positionZ);
            obj.scale.x = obj.scale.y = obj.scale.z = 30;
            console.log(`Lobao is at cell (row: ${(maze.rows - 1)}, col: ${(maze.columns - 1)}) - coord (${positionX.toFixed(2)}, ${positionZ.toFixed(2)})`);

        },
        function(progress){
            // console.log("vivo! " + (progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            // console.log("morto " + error);
        }
    );

    // Crie nós de orientação

    fbxLoader.load("assets/Character/avatar-idle.fbx",
        function(fbx) {
            fbx.scale.x = fbx.scale.y = fbx.scale.z = 0.2;
            fbx.position.x = -10;
            fbx.position.y = 1;
            fbx.position.z = 0;

            scene.add(fbx);

            objects["jeomar"] = createAnimatedState(fbx);
            objects["jeomar"].actions.idle = objects["jeomar"].mixer.clipAction(fbx.animations[0]);
            objects["jeomar"].actions.idle.play();
            objects["jeomar"].active = objects["jeomar"].actions.idle;


            loadFinished = true;

            loadAnimation(objects["jeomar"], "run", "assets/Character/avatar-running.fbx");
            loadAnimation(objects["jeomar"], "hit", "assets/Character/got-hit.fbx");
            loadAnimation(objects["jeomar"], "murdered", "assets/Character/brutally-assassinated.fbx");
        },
        function(progress){
            // console.log("vivo! " + (progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            // console.log("morto " + error);
        }
    );

    fbxLoader.load("assets/Villain/ninja-idle.fbx",
        function(fbx) {
            fbx.scale.x = fbx.scale.y = fbx.scale.z = 0.1;
            fbx.position.x = 300;
            fbx.position.y = 1;
            fbx.position.z = 0;
            scene.add(fbx);

            objects["students"] = createAnimatedState(fbx);
            objects["students"].actions.tocaia = objects["students"].mixer.clipAction(fbx.animations[0]);

            objects["students"].actions.tocaia.play();
            objects["students"].active = objects["students"].actions.tocaia;

            loadAnimation(objects["students"], "murder", "assets/Villain/brutal-assassination.fbx");
        },
        function(progress){
            console.log("vivo! " + (progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            console.log("morto " + error);
        }
    );

    fbxLoader.load("assets/macarena-dance.fbx",
        function(fbx) {
            fbx.scale.x = fbx.scale.y = fbx.scale.z = 0.2;
            fbx.position.x = 340;
            fbx.position.y = 0;
            fbx.position.z = 340;
            scene.add(fbx);

            objects["macarena"] = createAnimatedState(fbx);
            objects["macarena"].actions.dance = objects["macarena"].mixer.clipAction(fbx.animations[0]);

            objects["macarena"].actions.dance.play();
            objects["macarena"].active = objects["macarena"].actions.dance;
        },
        function(progress){
            // console.log("vivo! " + (progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            // console.log("morto " + error);
        }
    );
}

// KEYBOARD EVENTS ----------------------------------------------------------------------------------------------------------------------------
const makeTheCharacterMove = () => {
    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') move.forward = true;
        if (e.code === 'KeyS') move.backward = true;
        if (e.code === 'KeyA') move.left = true;
        if (e.code === 'KeyD') move.right = true;

        if (move.forward || move.backward || move.left || move.right) {
            setAction(objects["jeomar"], "run");
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') move.forward = false;
        if (e.code === 'KeyS') move.backward = false;
        if (e.code === 'KeyA') move.left = false;
        if (e.code === 'KeyD') move.right = false;

        if (!move.forward && !move.backward && !move.left && !move.right) {
            setAction(objects["jeomar"], "idle");
        }
    });

    window.addEventListener('click', () => {
        controls.lock();
        gamePaused = false;
        gameTimer.start();
    });

    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });


    window.addEventListener('blur', () => pauseGame());
}

function setupPointerLockPause() {
    controls.addEventListener('lock', () => {
        gamePaused = false;
        gameTimer.start();
    });

    controls.addEventListener('unlock', () => {
        pauseGame();
    });
}


// ANIMATION ----------------------------------------------------------------------------------------------------------------------------------

// Loop de animação + física
function clampHorizontalVelocity(body, max) {
    const vx = body.velocity.x, vz = body.velocity.z;
    const speed = Math.hypot(vx, vz);
    if (speed > max) {
        const s = max / speed;
        body.velocity.x *= s;
        body.velocity.z *= s;
    }
}

function pauseGame() {
    gamePaused = true;
    gameTimer.pause();
    if (controls.isLocked) controls.unlock();
}
const MAX_SPEED = 50.0;      // m/s no plano XZ
const FORCE = 175.5;        // aceleração (impulso por segundo)

var loadAnimation = function(state, name, url) {
    fbxLoader.load(url, function(fbx) {
        const action = state.mixer.clipAction(fbx.animations[0]);
        state.actions[name] = action;
    });
}

var setAction = function(state, name) {
    const newAction = state.actions[name];
    if (!newAction || newAction === state.active) return;

    if (state.active) {
        state.active.fadeOut(0.2);
    }

    newAction.reset().fadeIn(0.2).play();
    state.active = newAction;
}

function getForwardVector() {
    // Usar direção da câmera diretamente
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; 
    forward.normalize();
    return forward;
}

function getRightVector() {
    const forward = getForwardVector();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    right.normalize();
    return right;
}

var nossaAnimacao = function () {
    // console.log("gamePaused", gamePaused);
    // console.log("loadFinished", loadFinished);
    if (gamePaused) return;
    if (!loadFinished) return;

    let delta = clock.getDelta();

    for (const key in objects) {
        const obj = objects[key];
        if (obj.mixer) {
            obj.mixer.update(delta);
        }
    }
    // console.log("entrou na animacao");
    // dt com limite para estabilidade
    const dt = Math.min(delta, 1 / 30);
    // Direções baseadas na câmera

    gameTimer.update(dt);
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.innerText = gameTimer.getFormatted();
    }

    // Direções baseadas na câmera
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Movimento (aplica velocidade ao corpo físico, não move diretamente a câmera)

    // console.log("controls.isLocked", controls.isLocked);
    if (controls.isLocked) {
        const moveVec = new THREE.Vector3();
        if (move.forward)  moveVec.add(forward);
        if (move.backward) moveVec.addScaledVector(forward, -1);
        if (move.left)     moveVec.addScaledVector(right, -1);
        if (move.right)    moveVec.add(right);
        // console.log("move", move);
        if (moveVec.lengthSq() > 0) {
            moveVec.normalize();
            // garanta que não está dormindo ao aplicar input
            playerBody.wakeUp();
            // console.log('sleeping?', playerBody.sleepState); // 0: awake, 1: sleepy, 2: sleeping

            // aceleração acumulada em velocidade no plano XZ
            playerBody.velocity.x += moveVec.x * FORCE * dt;
            playerBody.velocity.z += moveVec.z * FORCE * dt;

            // const targetRotation = Math.atan2(moveVec.x, moveVec.z);
            // objects["jeomar"].fbx.rotation.y = THREE.MathUtils.lerp(
            //     objects["jeomar"].fbx.rotation.y, 
            //     targetRotation, 
            //     dt * 8  // Velocidade de rotação
            // );
    
            // // console.log(playerBody.velocity.x);
            // console.log(playerBody.velocity.z);
        } 

        clampHorizontalVelocity(playerBody, MAX_SPEED);
    }
    // movePlayer(dt);            // forças/velocidade

    // Step da física (fixo) com substep relativo ao dt
    physicsEngine.step(dt);

    syncVisualFromPhysics();
    updateStudentEncounters(dt, maze);
    // Câmera segue o corpo
    let x = playerBody.position.x;
    let z = playerBody.position.z;
    if(physicsEngine.checkWin(x, z, maze, maze.cellSize)){ 
        console.log("ganhou na pos", x, z);
        showWinScreen();
    }
    maze.drawMinimap(x, z);
    renderer.render(scene, camera);
};

function onPlayerHitByStudent() {
    if (!loadFinished) return;

    gameTimer.reduce(30);
    setAction(objects["students"], "murder");
    setAction(objects["jeomar"], "hit");

    setTimeout(() => {
        setAction(objects["students"], "tocaia");
        setAction(objects["jeomar"], "idle");
    }, 1200);
}

function createCapsuleBody({
    radius =2,         // raio do capsule (largura do corpo)
    height = 10,          // altura total (pés até topo da cabeça)
    mass = 80,
    material,
    start = new CANNON.Vec3(0, height/2 + 0.05, 0),
    linearDamping = 0.15,
    angularDamping = 1.0,
    fixedRotation = true,
    sleepSpeedLimit = 0.05,
    sleepTimeLimit = 0.5,
} = {}) {
    // “Parte reta” entre as semiesferas
    const cylinderHeight = Math.max(0.0001, height - 2 * radius);

    const body = new CANNON.Body({ mass, material });
    body.position.copy(start);
    body.linearDamping = linearDamping;
    body.angularDamping = angularDamping;
    body.fixedRotation = fixedRotation;
    body.sleepSpeedLimit = sleepSpeedLimit;
    body.sleepTimeLimit  = sleepTimeLimit;

    // Cilindro vertical (em Cannon, Cylinder está alinhado no eixo X por padrão — vamos rotacionar)
    const cylShape = new CANNON.Cylinder(radius, radius, cylinderHeight, 8);
    const cylQuat  = new CANNON.Quaternion();
    // Rotaciona para ficar “em pé” ao longo do eixo Y
    cylQuat.setFromEuler(0, 0, Math.PI / 2, 'XYZ');
    body.addShape(cylShape, new CANNON.Vec3(0, 0, 0), cylQuat);

    // Esfera de cima
    const topSphere = new CANNON.Sphere(radius);
    body.addShape(topSphere, new CANNON.Vec3(0, +cylinderHeight/2, 0));

    // Esfera de baixo
    const bottomSphere = new CANNON.Sphere(radius);
    body.addShape(bottomSphere, new CANNON.Vec3(0, -cylinderHeight/2, 0));

    return body;
}

// TIMER --------------------------------------------------------------------------------------------------------------------------------------

function gameOver() {
    if (!loadFinished) return;

    setAction(objects["jeomar"], "murdered");
    pauseGame();
    showLoseScreen("O tempo acabou!");
    // setTimeout(restartGame, 5000);
}

function restartGame() {
    gameTimer.reset();
    gamePaused = false;

    playerBody.position.copy(new CANNON.Vec3(5, CAPSULE_HEIGHT/2 + 0.05, 5));
    playerBody.velocity.setZero();

    setAction(objects["jeomar"], "idle");
}

// GROUND -------------------------------------------------------------------------------------------------------------------------------------

const createGround = () => {
    const textureLoader = new THREE.TextureLoader();

    const colorMap = textureLoader.load("assets/Ground/Ground_Color.jpg");
    // const normalMap = textureLoader.load("assets/Ground/Ground_NormalGL.jpg");
    const roughnessMap = textureLoader.load("assets/Ground/Ground_Roughness.jpg");
    const aoMap = textureLoader.load("assets/Ground/Ground_AmbientOcclusion.jpg");
    const displacementMap = textureLoader.load("assets/Ground/Ground_Displacement.jpg");

    const textures = [
        colorMap,
        // normalMap,
        roughnessMap,
        aoMap,
        displacementMap
    ];

    textures.forEach(tex => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(50, 50);
        tex.anisotropy = 50;
    });

    const material = new THREE.MeshStandardMaterial({
        map: colorMap,
        // normalMap: normalMap,
        roughnessMap: roughnessMap,
        aoMap: aoMap,
        displacementMap: displacementMap,
        displacementScale: 1,
        roughness: 1
    });

    const geometry = new THREE.PlaneGeometry(5000, 5000, 256, 256);

    geometry.setAttribute(
        'uv2',
        new THREE.BufferAttribute(geometry.attributes.uv.array, 2)
    );

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;

    ground.receiveShadow = true;
    scene.add(ground);
};


// INIT ---------------------------------------------------------------------------------------------------------------------------------------

const CAPSULE_HEIGHT = 15;
var physicsEngine;

export function init() {
    setupMenuEventListeners();
    updateLoadingProgress(1, "Inicializando Three.js...");
    
    document.getElementById('timer').innerText = gameTimer.getFormatted();

    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 0.1, 2000 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101a2e);
    scene.environment = new THREE.Color(0x1a233a);

    renderer = new THREE.WebGLRenderer({ antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;

    document.body.appendChild(renderer.domElement);
    updateLoadingProgress(2, "Carregando física...");
    physicsEngine = new PhysicsEngine();
    world = physicsEngine.world;
    let physics = physicsEngine.materials;

    controls = new PointerLockControls(camera, renderer.domElement);
    setupPointerLockPause();
    
    camera.position.set(0, EYE_HEIGHT, 0);
    
    updateLoadingProgress(3, "Gerando labirinto...");

    maze = new Maze(20, 10, 10);
    maze.setup();
    maze.generateMaze();
    maze.buildMaze(scene, world, physics);

    updateLoadingProgress(4, "Carregando personagem...");

     // Câmera será posicionada pelo rig de câmera

    // Materiais previamente criados (conforme falamos antes)
    const playerMaterial = physics.playerMaterial;

    // Alturas
    const CAPSULE_RADIUS = 7;
    const START = new CANNON.Vec3(0, CAPSULE_HEIGHT + 1, 0);  // Início do labirinto (célula 0,0)
  
    // Corpo físico
    playerBody = createCapsuleBody({
        radius: CAPSULE_RADIUS,
        height: CAPSULE_HEIGHT,
        mass: 75,
        material: playerMaterial,
        start: START
    });
    world.addBody(playerBody);

    criaIluminacao();
    createDirectionalLight();
    createPointLight();
    loadObj();
    updateLoadingProgress(5, "Carregando chão...");
    createGround();
    updateLoadingProgress(6, "Configurando movimento...");
    makeTheCharacterMove();

    updateLoadingProgress(7, "Finalizando");
    gameTimer.onTimeUp = gameOver;


    document.body.appendChild( renderer.domElement );
    renderer.render( scene, camera );
    scene.fog = new THREE.Fog(0xcccccc, 10, 500);

    window.addEventListener( 'resize', onWindowResize );
}

// Sincroniza visual com física, mas mantém câmera independente
function syncVisualFromPhysics() {
      // Posicionar o personagem
      objects["jeomar"].fbx.position.set(
        playerBody.position.x,
        playerBody.position.y - CAPSULE_HEIGHT/2,
        playerBody.position.z
    );

    // Posicionar a câmera na altura dos olhos
    camera.position.set(
        playerBody.position.x,
        playerBody.position.y - CAPSULE_HEIGHT/2 + EYE_HEIGHT,
        playerBody.position.z
    );

    // Rotacionar personagem baseado na direção da câmera (opcional)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const targetRotation = Math.atan2(forward.x, forward.z);
    objects["jeomar"].fbx.rotation.y = targetRotation;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}
