import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {Maze} from './maze.js'
import { PhysicsEngine } from './physicsEngine.js';

let camera, scene, renderer, controls;
let gamePaused = false;
let objects = [];

let character;
const actions = {};
let activeAction;

const move = { forward: false, backward: false, left: false, right: false };

var mixer;
var clock = new THREE.Clock();
var loadFinished = false;

let ambientLight, sunLight, dirLight, pointLight;

var objLoader = new OBJLoader();
var fbxLoader = new FBXLoader();

// LIGHT --------------------------------------------------------------------------------------------------------------------------------------

var criaIluminacao = function(){
    luzAmbiente();
    luzSolar();
}

var luzSolar = function(){
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

var luzAmbiente = function(){
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
    pointLight = new THREE.PointLight(0x3aff7a, 0.15, 60);
    pointLight.position.set(0, 10, 0);
    pointLight.castShadow = true;

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
            obj.position.x = 90;
            obj.scale.x = obj.scale.y = obj.scale.z = 30;            
        },
        function(progress){
            // console.log("vivo! " + (progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            // console.log("morto " + error);
        }
    );

    fbxLoader.load("assets/Character/avatar-idle.fbx",
        function(obj) {
            character = obj;
            character.scale.x = character.scale.y = character.scale.z = 0.2;
            character.position.x = -10;
            character.position.y = -5;
            character.position.z = 0;

            scene.add(character);
            mixer = new THREE.AnimationMixer(character);

            actions.idle = mixer.clipAction(obj.animations[0]);
            actions.idle.play();
            loadFinished = true;

            activeAction = actions.idle;
            loadRunningAnimation();
        },
        function(progress){
            console.log("vivo! "+(progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            console.log("morto " + error);
        }
    );
}

// KEYBOARD EVENTS ----------------------------------------------------------------------------------------------------------------------------

const makeTheCharacterMove = () => {
    document.addEventListener('keydown', (e) => {
        setAction("run");

        if (e.code === 'KeyW') move.forward = false;
        if (e.code === 'KeyS') move.backward = false;
        if (e.code === 'KeyA') move.left = false;
        if (e.code === 'KeyD') move.right = false;
    });


    document.addEventListener('keydown', (e) => {
        loadFinished = true;
        setAction("idle");

        if (e.code === 'KeyW') move.forward = true;
        if (e.code === 'KeyS') move.backward = true;
        if (e.code === 'KeyA') move.left = true;
        if (e.code === 'KeyD') move.right = true;
        if (e.code === 'Escape') pauseGame();
    });

    window.addEventListener('click', () => controls.lock());

    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
    window.addEventListener('blur', () => pauseGame());
}

// ANIMATION ----------------------------------------------------------------------------------------------------------------------------------

// -----------------------
// Loop de animação + física
// -----------------------
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
    if (controls.isLocked) controls.unlock();
}

const MAX_SPEED = 25.5;      // m/s no plano XZ
const ACCEL = 300.0;        // aceleração (impulso por segundo)

function loadRunningAnimation() {
    fbxLoader.load("assets/Character/avatar-running.fbx", 
        function(obj) {
            const runClip = obj.animations[0];
            actions.run = mixer.clipAction(runClip);
        }
    );
}

function setAction(name) {
    const newAction = actions[name];
    if (!newAction || newAction === activeAction) return;

    activeAction.fadeOut(0.2);

    newAction
        .reset()
        .fadeIn(0.2)
        .play();

    activeAction = newAction;
}

var nossaAnimacao = function (playerBody, world) {
    let delta = clock.getDelta();

    if (gamePaused) return;
    console.log("entrou na animacao");
    // dt com limite para estabilidade
    const dt = Math.min(clock.getDelta(), 1 / 30);
    // Direções baseadas na câmera
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Movimento (aplica velocidade ao corpo físico, não move diretamente a câmera)

    console.log("controls.isLocked", controls.isLocked);
    if (controls.isLocked) {
        const moveVec = new THREE.Vector3();
        if (move.forward)  moveVec.add(forward);
        if (move.backward) moveVec.addScaledVector(forward, -1);
        if (move.left)     moveVec.addScaledVector(right, -1);
        if (move.right)    moveVec.add(right);
        console.log("moveVec", moveVec);
        if (moveVec.lengthSq() > 0) {
            moveVec.normalize();


            // garanta que não está dormindo ao aplicar input
            playerBody.wakeUp();
            console.log('sleeping?', playerBody.sleepState); // 0: awake, 1: sleepy, 2: sleeping

            // aceleração acumulada em velocidade no plano XZ
            playerBody.velocity.x += moveVec.x * ACCEL * dt;
            playerBody.velocity.z += moveVec.z * ACCEL * dt;
            console.log(playerBody.velocity.x);
            console.log(playerBody.velocity.z);
        } else {
        // sem input — damping já segura o corpo
        }

        clampHorizontalVelocity(playerBody, MAX_SPEED);
    }

    // Step da física (fixo) com substep relativo ao dt
    world.step(1 / 60, dt, 3);

  // Câmera segue o corpo
    const eyeHeight = 0.5;
    console.log(playerBody.position.x);
    console.log(playerBody.position.y + eyeHeight);
    console.log(playerBody.position.z);

    camera.position.set(
        playerBody.position.x,
        playerBody.position.y + eyeHeight,
        playerBody.position.z
    );

    renderer.render(scene, camera);
};

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
        tex.repeat.set(200, 200);
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

export function init() {
    const physicsEngine = new PhysicsEngine();
    let world = physicsEngine.world;
    let physics = physicsEngine.materials;

    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 0.1, 2000 );
       

    const maze = new Maze(20, 10, 10);
    maze.setup();
    maze.generateMaze();
    maze.buildMaze(scene, world, physics);

    // Câmera: olhar para centro
    camera.lookAt(new THREE.Vector3(maze.columns * 5, 1, maze.rows * 5));

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101a2e);
    scene.environment = new THREE.Color(0x1a233a);

    renderer = new THREE.WebGLRenderer({ antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;

    document.body.appendChild(renderer.domElement);
    controls = new PointerLockControls(camera, renderer.domElement);

    const playerBody = physicsEngine.createPlayerBody({ radius: 2, mass: 80 });      // em segundos
    camera.position.set(playerBody.position.x, playerBody.position.y + 2.0, playerBody.position.z);

    criaIluminacao();
    createDirectionalLight();
    createPointLight();
    loadObj();
    createGround();
    makeTheCharacterMove();

    const animationLoop = () => nossaAnimacao(playerBody, world);
    renderer.setAnimationLoop( animationLoop );

    document.body.appendChild( renderer.domElement );
    renderer.render( scene, camera );
    scene.fog = new THREE.Fog(0xcccccc, 10, 500);

    scene.fog = new THREE.Fog(0x0b1324, 20, 300);

    window.addEventListener( 'resize', onWindowResize );
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}
