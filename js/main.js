import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Maze } from './maze.js'
import { PhysicsEngine } from './physicsEngine.js';
import * as CANNON from 'cannon-es';

let camera, scene, renderer, controls, playerBody, cameraYaw, cameraPitch;
let gamePaused = false;
let objects = [];

// Configuração da câmera
const CAMERA_MODE = 'first_person'; // 'first_person' ou 'third_person'
const THIRD_PERSON_DISTANCE = 5;   // distância da câmera em 3ª pessoa

const move = { forward: false, backward: false, left: false, right: false };
let loadFinished = false;

var clock = new THREE.Clock();

let ambientLight, sunLight, dirLight, pointLight;

var objLoader = new OBJLoader();
var fbxLoader = new FBXLoader();
const EYE_HEIGHT = 20;     // ~altura dos olhos

// CREATE CHARACTER ---------------------------------------------------------------------------------------------------------------------------

var createAnimatedState = function(fbx) {
    return {
        fbx,
        mixer: new THREE.AnimationMixer(fbx),
        actions: {},
        active: null,
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
            obj.position.x = obj.position.z = 360;
            obj.scale.x = obj.scale.y = obj.scale.z = 30;            
        },
        function(progress){
            // console.log("vivo! " + (progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            // console.log("morto " + error);
        }
    );

    // Crie nós de orientação
    cameraYaw = new THREE.Object3D();   // gira em Y (esquerda/direita)
    cameraPitch = new THREE.Object3D(); // gira em X (cima/baixo)
    cameraYaw.add(cameraPitch);
    cameraPitch.add(camera);

    // Offset dos olhos (em relação ao centro do corpo físico/personagem)
    camera.position.set(0, 0, 0);            // a câmera fica no pitch; o pitch será posicionado no olho
    cameraPitch.position.set(0, EYE_HEIGHT, 0);
    scene.add(cameraYaw);

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
            fbx.position.x = -10;
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
            // console.log("vivo! " + (progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            // console.log("morto " + error);
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

let mouseDX = 0, mouseDY = 0;
let pitchLimit = THREE.MathUtils.degToRad(85);
const yawSpeed = 0.002;   // sensibilidade horizontal
const pitchSpeed = 0.002; // sensibilidade vertical

const makeTheCharacterMove = () => {
    document.addEventListener('keydown', (e) => {
        setAction(objects["jeomar"], "run");
        if (e.code === 'KeyW') move.forward = true;
        if (e.code === 'KeyS') move.backward = true;
        if (e.code === 'KeyA') move.left = true;
        if (e.code === 'KeyD') move.right = true;
    });

    document.addEventListener('keyup', (e) => {
        setAction(objects["jeomar"], "idle");
        if (e.code === 'KeyW') move.forward = false;
        if (e.code === 'KeyS') move.backward = false;
        if (e.code === 'KeyA') move.left = false;
        if (e.code === 'KeyD') move.right = false;
    });

    window.addEventListener('click', () => controls.lock());
  

    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
    document.addEventListener('mousemove', (e) => {
        if (controls.isLocked) {
            mouseDX = e.movementX || 0;
            mouseDY = e.movementY || 0;
        }
    });

    window.addEventListener('blur', () => pauseGame());
}

function applyLookRotation() {
    cameraYaw.rotation.y -= mouseDX * yawSpeed;
    cameraPitch.rotation.x -= mouseDY * pitchSpeed;
    cameraPitch.rotation.x = THREE.MathUtils.clamp(cameraPitch.rotation.x, -pitchLimit, pitchLimit);
    mouseDX = mouseDY = 0;
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
    if (controls.isLocked) controls.unlock();
}
const MAX_SPEED = 25.5;      // m/s no plano XZ
const FORCE = 300.0;        // aceleração (impulso por segundo)

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
    // Extrai direção “para frente” do rig (ignora componente Y para manter no plano)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraYaw.quaternion);
    forward.y = 0; forward.normalize();
    return forward;
}

function getRightVector() {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraYaw.quaternion);
    right.y = 0; right.normalize();
    return right;
}

function movePlayer(dt) {
    if (!controls.isLocked) return;

    const forward = getForwardVector();
    const right   = getRightVector();

    const moveVec = new THREE.Vector3();
    if (move.forward)  moveVec.add(forward);
    if (move.backward) moveVec.addScaledVector(forward, -1);
    if (move.left)     moveVec.addScaledVector(right, -1);
    if (move.right)    moveVec.add(right);

    if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        playerBody.wakeUp();

        // Aplicar força horizontal
        const fx = moveVec.x * FORCE;
        const fz = moveVec.z * FORCE;
        playerBody.applyForce(new CANNON.Vec3(fx, 0, fz), playerBody.position);

        // Limitar velocidade horizontal
        const vx = playerBody.velocity.x, vz = playerBody.velocity.z;
        const speed = Math.hypot(vx, vz);
        if (speed > MAX_SPEED) {
            const s = MAX_SPEED / speed;
            playerBody.velocity.x *= s;
            playerBody.velocity.z *= s;
        }
    }
}

var nossaAnimacao = function (world, maze) {

    if (gamePaused) return;
    if (!loadFinished) return;

    let delta = clock.getDelta();

    for (const key in objects) {
        const obj = objects[key];
        if (obj.mixer) {
            obj.mixer.update(delta);
        }
    }
    console.log("entrou na animacao");
    // dt com limite para estabilidade
    const dt = Math.min(delta, 1 / 30);
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
        console.log("move", move);
        if (moveVec.lengthSq() > 0) {
            moveVec.normalize();


            // garanta que não está dormindo ao aplicar input
            playerBody.wakeUp();
            console.log('sleeping?', playerBody.sleepState); // 0: awake, 1: sleepy, 2: sleeping

            // aceleração acumulada em velocidade no plano XZ
            playerBody.velocity.x += moveVec.x * FORCE * dt;
            playerBody.velocity.z += moveVec.z * FORCE * dt;
            console.log(playerBody.velocity.x);
            console.log(playerBody.velocity.z);
        } 

        clampHorizontalVelocity(playerBody, MAX_SPEED);
    }
    applyLookRotation();       // do mouse → yaw/pitch
    movePlayer(dt);            // forças/velocidade

    // Step da física (fixo) com substep relativo ao dt
    world.step(1 / 60, dt, 3);

    syncVisualFromPhysics();
    // Câmera segue o corpo
    let x = playerBody.position.x;
    let z = playerBody.position.z;
    
    maze.drawMinimap(x, z);
    renderer.render(scene, camera);
};


function createCapsuleBody({
    radius = 0.35,         // raio do capsule (largura do corpo)
    height = 1.7,          // altura total (pés até topo da cabeça)
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

    const geometry = new THREE.PlaneGeometry(500, 500, 256, 256);

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

const CAPSULE_HEIGHT = 1.7;

export function init() {
    const physicsEngine = new PhysicsEngine();
    let world = physicsEngine.world;
    let physics = physicsEngine.materials;


    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 0.1, 2000 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101a2e);
    scene.environment = new THREE.Color(0x1a233a);

    renderer = new THREE.WebGLRenderer({ antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;

    document.body.appendChild(renderer.domElement);
    controls = new PointerLockControls(camera, renderer.domElement);

    const maze = new Maze(20, 10, 10);
    maze.setup();
    maze.generateMaze();
    maze.buildMaze(scene, world, physics);
     // Câmera será posicionada pelo rig de câmera

    // Materiais previamente criados (conforme falamos antes)
    const playerMaterial = physics.playerMaterial;

    // Alturas
    const CAPSULE_RADIUS = 0.35;
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
    createGround();
    makeTheCharacterMove();

    const animationLoop = () => nossaAnimacao( world, maze);
    renderer.setAnimationLoop( animationLoop );

    document.body.appendChild( renderer.domElement );
    renderer.render( scene, camera );
    scene.fog = new THREE.Fog(0xcccccc, 10, 500);

    scene.fog = new THREE.Fog(0x0b1324, 20, 300);
    window.addEventListener( 'resize', onWindowResize );
}

// Sincroniza visual com física, mas mantém câmera independente
function syncVisualFromPhysics() {
  // posiciona o “root” do personagem no centro do corpo
  objects["jeomar"].fbx.position.set(
    playerBody.position.x,
    playerBody.position.y - CAPSULE_HEIGHT/2,  // raiz do modelo nos pés
    playerBody.position.z
  );

  // Câmera independente da física - não é afetada pela gravidade
  const targetCameraHeight = playerBody.position.y - CAPSULE_HEIGHT/2 + EYE_HEIGHT;
  
  if (CAMERA_MODE === 'first_person') {
    // 1ª pessoa: câmera na posição dos olhos
    cameraYaw.position.set(0, targetCameraHeight,0);
  } else if (CAMERA_MODE === 'third_person') {
    // 3ª pessoa: câmera atrás do jogador
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraYaw.quaternion);
    cameraYaw.position.set(
      playerBody.position.x - forward.x * THIRD_PERSON_DISTANCE,
      targetCameraHeight + 1, // um pouco mais alta em 3ª pessoa
      playerBody.position.z - forward.z * THIRD_PERSON_DISTANCE
    );
  }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}
