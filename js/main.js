import * as THREE from 'three';
import {GUI} from 'three/addons/libs/lil-gui.module.min.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {Maze} from './maze.js'
import { PhysicsEngine } from './physicsEngine.js';


let camera, scene, renderer, controls;
let gamePaused = false;
let objects = [];
let parametrosGui;

const move = { forward: false, backward: false, left: false, right: false };

var mixer;
var animationActions = [];
var activeAnimation;
var lastAnimation;
var loadFinished = false;
var walking = false;
var walkingLeft = false;
var clock = new THREE.Clock();

let ambientLight, sunLight;
let dirLight, dirLightHelper;
let spotLight, spotLightHelper;
let pointLight, pointLightHelper;

var criaIluminacao = function(parametrosGui){
    luzAmbiente(parametrosGui);
    luzSolar(parametrosGui);
}

var luzSolar = function(parametrosGui){
    sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.castShadow = true;
    sunLight.position.y = 900;

    sunLight.shadow.mapSize.width = 2024;
    sunLight.shadow.mapSize.height = 2024;

    //camera de sombra
    sunLight.shadow.camera.far = 950;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.visible = parametrosGui.environmentLight;

    scene.add(sunLight);
}

var luzAmbiente = function(parametrosGui){
    ambientLight = new THREE.AmbientLight(0xffffff, .5);
    ambientLight.visible = parametrosGui.environmentLight;

    scene.add(ambientLight);
}

var createDirectionalLight = function (parametrosGui) {
    dirLight = new THREE.DirectionalLight(0xff0000, 2);  
    dirLight.position.set(0, 30, 0);
    dirLight.castShadow = true;

    let helperAxes = new THREE.AxesHelper(10);
    dirLight.add(helperAxes);

    dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 50, 0x00ff00);

    dirLight.visible = parametrosGui.dlvisible;

    scene.add(dirLight);
    scene.add(dirLightHelper);
};

var createSpotLight = function(parametrosGui) {
    spotLight = new THREE.SpotLight(0xffff00, 50, 2000, Math.PI / 4, 0.3, 1);
    spotLight.position.set(10, 30, 30);
    spotLight.castShadow = true;

    spotLightHelper = new THREE.SpotLightHelper(spotLight, 0xffff00);

    spotLight.visible = parametrosGui.slvisible;

    scene.add(spotLight);
    scene.add(spotLightHelper);
}

var createPointLight = function(parametrosGui) {
    pointLight = new THREE.PointLight(0x0000ff, 15, 200, 1);
    pointLight.position.set(-30, 8.5, 20);
    pointLight.castShadow = true;

    pointLightHelper = new THREE.PointLightHelper(pointLight, 5, 0x0000ff);

    pointLight.visible = parametrosGui.plvisible;

    scene.add(pointLight);
    scene.add(pointLightHelper);
}

function setAction(newAction) {
    if (newAction !== activeAnimation) {
        lastAnimation = activeAnimation;
        activeAnimation = newAction;

        lastAnimation.fadeOut(0.3);
        activeAnimation
            .reset()
            .fadeIn(0.3)
            .play();
    }
}

parametrosGui = {
    lobaoScale: 30,
    lobaoRotationY: 0,
    opt: 'Dragon',
    environmentLight: true,
    dlvisible: false,
    dlintensity: 2,
    slvisible: false,
    slintensity: 50,
    slAngle: Math.PI / 4,
    plvisible: false,
    plIntensity: 15,
    plPosX: -30,
    plPosY: 8.5,
    plPosZ: 20,
};


var createGui = function(){
    return; 
    const gui = new GUI();

    let light = gui.addFolder('Light');
    light.add(parametrosGui, 'environmentLight')
        .onChange(function(value) {
            ambientLight.visible = value;
            sunLight.visible = value;
        });

    let dLight = gui.addFolder('Directional Light');
    dLight.add(parametrosGui, 'dlvisible')
        .name('visible')
        .onChange(function(value) {
            dirLight.visible = value;
            dirLightHelper.visible = value;
        });
    dLight.add(parametrosGui, 'dlintensity')
        .min (0)
        .max(20)
        .name('intensity')
        .onChange(function(value) {
            dirLight.intensity = value;
        });
    
    let sLight = gui.addFolder('Spot Light');
    sLight.add(parametrosGui, 'slvisible')
        .name('visible')
        .onChange(function(value) {
            spotLight.visible = value;
            spotLightHelper.visible = value;
        });
    sLight.add(parametrosGui, 'slintensity')
        .min (0)
        .max(100)
        .name('intensity')
        .onChange(function(value) {
            spotLight.intensity = value;
        });
    sLight.add(parametrosGui, 'slAngle')
        .min (Math.PI / 16)
        .max(Math.PI / 2)
        .name('angle')
        .onChange(function(value) {
            spotLight.angle = value;
        });
    
    let pLight = gui.addFolder('Point Light');
    pLight.add(parametrosGui, 'plvisible')
        .name('visible')
        .onChange(function(value) {
            pointLight.visible = value;
            pointLightHelper.visible = value;
        });
    pLight.add(parametrosGui, 'plIntensity')
        .min (0)
        .max(20)    
        .step(0.1)
        .name('intensity')
        .onChange(function(value) {
            pointLight.intensity = value;
        });
    
    pLight.add(parametrosGui, 'plPosX')
        .min (-50)
        .max(50)    
        .step(0.1)
        .name('Pos X')
        .onChange(function(value) {
            pointLight.position.x = value;
        });
    pLight.add(parametrosGui, 'plPosY')
        .min (0)
        .max(80)    
        .step(0.1)
        .name('Pos Y')
        .onChange(function(value) {
            pointLight.position.y = value;
        });
    pLight.add(parametrosGui, 'plPosZ')
        .min (-20)
        .max(20)    
        .step(0.1)
        .name('Pos Z')
        .onChange(function(value) {
            pointLight.position.z = value;
        });

    let dragon = gui.addFolder("Lobao");
    dragon.add (parametrosGui, 'lobaoScale')
        .min (0)
        .max(40)
        .step (1)
        .name("Scale")
        .onChange(function(value){
            objects["dragon"].scale.x  = objects["dragon"].scale.y = objects["dragon"].scale.z = value;
        }
    );
    dragon.add (parametrosGui, 'lobaoRotationY')
        .min (-2)
        .max(2)
        .step (0.1)
        .name("Rotation")
        .onChange(function(value){
            objects["dragon"].rotation.y =  value;
        }
    );
    let options = ['Dragon', 'Lobao'];
    dragon.add(parametrosGui, 'opt')
        .options(options)
        .name("Look")
        .onChange(function(value){
            if (value == "Lobao")
                camera.lookAt(objects["lobao"].position);
            else
                camera.lookAt(objects["dragon"].position);
        }); 
}

var loadObj = function(){
    let objLoader = new OBJLoader();
    let fbxLoader = new FBXLoader();
    let textLoader = new THREE.TextureLoader();

    objLoader.load (
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
            //console.log("ta vivo! "+(progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            //console.log("Deu merda " + error);
        }
    );


}

export function init() {
    const physicsEngine = new PhysicsEngine();
    let world = physicsEngine.world;
    let physics = physicsEngine.materials;

    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 0.1, 2000 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcce0ff);
    scene.fog = new THREE.Fog(0xcccccc, 10, 500);

    renderer = new THREE.WebGLRenderer({ antialias: true } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;

    document.body.appendChild(renderer.domElement);
    controls = new PointerLockControls(camera, renderer.domElement);

    criaIluminacao(parametrosGui);
    // createDirectionalLight(parametrosGui);
    // createSpotLight(parametrosGui);
    // createPointLight(parametrosGui);
    createGui();
    loadObj();

    camera.position.z = 60;
    // renderer.setAnimationLoop( nossaAnimacao );
    
    document.body.appendChild( renderer.domElement );
    renderer.render( scene, camera );

    scene.fog = new THREE.Fog(0xcccccc, 10, 500);

    // GROUND --------------
    let textLoader = new THREE.TextureLoader();
    let textGround = textLoader.load("assets/grasslight-big.jpg");
    textGround.wrapS = textGround.wrapT = THREE.RepeatWrapping;
    textGround.repeat.set(25,25);
    textGround.anisotropy = 16;

    let materialGround = new THREE.MeshStandardMaterial({map: textGround});

    let ground = new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),
                                 materialGround);

    ground.rotation.x = -Math.PI/2;
    ground.position.y = 0; // alinhar com o plano y=0 da física

    ground.receiveShadow = true;
    scene.add(ground);


    const maze = new Maze(20, 10, 10);
    maze.setup();
    maze.generateMaze();
    maze.buildMaze(scene, world, physics);

    // Câmera: olhar para centro
    camera.lookAt(new THREE.Vector3(maze.columns * 5, 1, maze.rows * 5));
    // --------------------

    const cellSize = 40;
    const startX = cellSize / 2;
    const startZ = cellSize / 2;

    const PLAYER_RADIUS = 2;   // raio da esfera do jogador
    const playerBody = physicsEngine.createPlayerBody({ radius: 2, mass: 80 });      // em segundos

    // Altura dos olhos (câmera segue o corpo)
    camera.position.set(playerBody.position.x, playerBody.position.y + 2.0, playerBody.position.z);

    // DRAGON WALKIN/FLYING
    // document.addEventListener('keydown', (e) => {
    //     return ;
    //     if (e.code === "KeyW" && !walking && objects['dragon'].rotation.y > 0) {
    //         walking = true;
    //         setAction(animationActions[0]);
    //     }

    //     if (e.code === "KeyW" && !walkingLeft && objects['dragon'].rotation.y < 0) {
    //         walkingLeft = true;
    //         setAction(animationActions[0]);
    //     }

    //     if (e.code === "KeyD" && !walking) {
    //         walking = true;
    //         setAction(animationActions[1]);
    //     }

    //     if (e.code === "KeyA" && !walkingLeft) {
    //         walkingLeft = true;
    //         setAction(animationActions[1]);
    //     }
    // });

    // document.addEventListener('keyup', (e) => {
    //     return ;
    //     if (e.code === "KeyW" || e.code === "KeyD") {
    //         walking = false;
    //         walkingLeft = false;
    //         setAction(animationActions[2]);
    //     }

    //     if (e.code === 'KeyA') {
    //         walking = false;
    //         walkingLeft = false;
    //         setAction(animationActions[2]);
    //     }
    // });
    // ----------------------

    // document.addEventListener('keydown', onKeyDown);
    // document.addEventListener('mousemove', makeMove);
    // document.addEventListener('mouseup', clickOn);
    // document.addEventListener('mousedown', ClickOff);
    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') move.forward = true;
        if (e.code === 'KeyS') move.backward = true;
        if (e.code === 'KeyA') move.left = true;
        if (e.code === 'KeyD') move.right = true;
        if (e.code === 'Escape') pauseGame();
    });
    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') move.forward = false;
        if (e.code === 'KeyS') move.backward = false;
        if (e.code === 'KeyA') move.left = false;
        if (e.code === 'KeyD') move.right = false;
    });

    window.addEventListener( 'resize', onWindowResize );
    window.addEventListener('click', () => controls.lock());

    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
    window.addEventListener('blur', () => pauseGame());

    // Loop
    const animationLoop = () => nossaAnimacao(playerBody, world);
    renderer.setAnimationLoop(animationLoop);
}

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

/**
 * Section of Animation
 */
const MAX_SPEED = 25.5;      // m/s no plano XZ
const ACCEL = 300.0;        // aceleração (impulso por segundo)


var nossaAnimacao = function (playerBody, world) {
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
    return ; // vou nem comentar o resto para evitar os conflito

    if (loadFinished){
        mixer.update(delta);

        if (walking) {
            objects['dragon'].rotation.y = Math.PI / 2;
            objects['dragon'].position.x += 0.5;
            camera.position.x += 0.5;
        }

        if (walkingLeft) {
            objects['dragon'].rotation.y = -Math.PI / 2;
            objects['dragon'].position.x -= 0.5;
            camera.position.x -= 0.5;
        }
    }

    renderer.render(scene, camera);
};



/**
 * Section of mouse move
 */
var click = false;
var mousePosition = {
    x: 0,
    y: 0,
    z: 0
};

var  makeMove = function(e){
    
    if (click){
        let deltaX =  mousePosition.x - e.offsetX;
        let deltaY  =  mousePosition.y - e.offsetY;
        
        let eulerMat = new THREE.Euler(0, toRadians(deltaX)*0.1, 0, "YXZ");
        let quater = new THREE.Quaternion().setFromEuler(eulerMat);
        camera.quaternion.multiplyQuaternions(quater,camera.quaternion);
    }
     mousePosition = {
        x: e.offsetX,
        y : e.offsetY
    }
}

var ClickOff  = function (e) {
    click = true;
}
var clickOn = function (e) {
    click = false;
    
}

var toRadians = function (value){
    return value*(Math.PI/180);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}
