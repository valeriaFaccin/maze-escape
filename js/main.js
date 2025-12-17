// https://www.mixamo.com/#/?page=1&type=Motion%2CMotionPack

import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

let camera, scene, renderer;
let objects = [];

let character;
const actions = {};
let activeAction;

var mixer;
var clock = new THREE.Clock();
var loadFinished = false;

var isMovingForward, isMovingBackward, isMovingLeft, isMovingRight = false;

let ambientLight, sunLight;
let pointLight, pointLightHelper;

var objLoader = new OBJLoader();
var fbxLoader = new FBXLoader();

let parametrosGui = {
    avatarScale: 30,
    avatarRotationY: 0,
    opt: 'Jeomar',
    environmentLight: true,
    plvisible: false,
    plIntensity: 15,
    plPosX: -30,
    plPosY: 8.5,
    plPosZ: 20,
};

// LIGHT --------------------------------------------------------------------------------------------------------------------------------------

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

var createPointLight = function(parametrosGui) {
    pointLight = new THREE.PointLight(0x0000ff, 15, 200, 1);
    pointLight.position.set(-30, 8.5, 20);
    pointLight.castShadow = true;

    pointLightHelper = new THREE.PointLightHelper(pointLight, 5, 0x0000ff);

    pointLight.visible = parametrosGui.plvisible;

    scene.add(pointLight);
    scene.add(pointLightHelper);
}

// GUI ----------------------------------------------------------------------------------------------------------------------------------------

var createGui = function(){
    const gui = new GUI();

    let light = gui.addFolder('Light');
    light.add(parametrosGui, 'environmentLight')
        .onChange(function(value) {
            ambientLight.visible = value;
            sunLight.visible = value;
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

    let jeomar = gui.addFolder("AVATAR");
    jeomar.add (parametrosGui, 'avatarScale')
        .min (0)
        .max(40)
        .step (1)
        .name("Scale")
        .onChange(function(value){
            objects["jeomar"].scale.x  = objects["jeomar"].scale.y = objects["jeomar"].scale.z = value;
        }
    );
    jeomar.add (parametrosGui, 'avatarRotationY')
        .min (-2)
        .max(2)
        .step (0.1)
        .name("Rotation")
        .onChange(function(value){
            objects["jeomar"].rotation.y =  value;
        }
    );
    let options = ['Jeomar', 'Lobao'];
    jeomar.add(parametrosGui, 'opt')
        .options(options)
        .name("Look")
        .onChange(function(value){
            if (value == "Lobao")
                camera.lookAt(objects["lobao"].position);
            else
                camera.lookAt(objects["jeomar"].position);
        }); 
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
            objects["jeomar"] = obj;
            character = obj;
            character.scale.x = character.scale.y = character.scale.z = 0.2;
            character.position.x = -10;
            character.position.y = -5.8;
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

        if (e.code === "KeyW" && !isMovingForward) {
            isMovingForward = true;
        }

        if (e.code === "KeyD" && !isMovingRight) {
            isMovingRight = true;
        }

        if (e.code === "KeyA" && !isMovingLeft) {
            isMovingLeft = true;
        }

        if (e.code === "KeyS" && !isMovingBackward) {
            isMovingBackward = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        loadFinished = true;
        setAction("idle");

        if (e.code === "KeyW") {
            isMovingForward = false;
        }

        if (e.code === "KeyD") {
            isMovingRight = false;
        }

        if (e.code === "KeyA") {
            isMovingLeft = false;
        }

        if (e.code === "KeyS") {
            isMovingBackward = false;
        }
    });
}

// ANIMATION ----------------------------------------------------------------------------------------------------------------------------------

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

var nossaAnimacao = function () {
    let delta = clock.getDelta();
    
    if (loadFinished) {
        mixer.update(delta);

        if (isMovingRight) {
            character.rotation.y = Math.PI / 2;
            character.position.x += 0.5;
            camera.position.x += 0.5;
        }

        if (isMovingLeft) {
            character.rotation.y = -Math.PI / 2;
            character.position.x -= 0.5;
            camera.position.x -= 0.5;
        }

        if (isMovingForward) {
            character.rotation.y = 0;
            character.position.z += 0.5;
            camera.position.z += 0.5;
        }

        if (isMovingBackward) {
            character.rotation.y = Math.PI;
            character.position.z -= 0.5;
            camera.position.z -= 0.5;
        }
    }

    renderer.render(scene, camera);
};

// GROUND -------------------------------------------------------------------------------------------------------------------------------------

const createGround = () => {
    let textLoader = new THREE.TextureLoader();
    let textGround = textLoader.load("assets/grasslight-big.jpg");
    textGround.wrapS = textGround.wrapT = THREE.RepeatWrapping;
    textGround.repeat.set(25, 25);
    textGround.anisotropy = 16;

    let materialGround = new THREE.MeshStandardMaterial({map: textGround});
    let ground = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), materialGround);

    ground.rotation.x = -Math.PI/2;
    ground.position.y -= 6;

    ground.receiveShadow = true;
    scene.add(ground);
}

// INIT ---------------------------------------------------------------------------------------------------------------------------------------

export function init() {
    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 0.1, 2000 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcce0ff);

    renderer = new THREE.WebGLRenderer( );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;

    criaIluminacao(parametrosGui);
    createPointLight(parametrosGui);
    createGui();
    loadObj();
    createGround();
    makeTheCharacterMove();

    camera.position.z = 60;
    renderer.setAnimationLoop( nossaAnimacao );
    
    document.body.appendChild( renderer.domElement );
    renderer.render( scene, camera );

    scene.fog = new THREE.Fog(0xcccccc, 10, 500);

    window.addEventListener( 'resize', onWindowResize );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}
