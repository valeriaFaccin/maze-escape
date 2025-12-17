import * as THREE from 'three';
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
    ground.position.y = -6;

    ground.receiveShadow = true;
    scene.add(ground);
};


// INIT ---------------------------------------------------------------------------------------------------------------------------------------

export function init() {
    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 0.1, 2000 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101a2e);
    scene.environment = new THREE.Color(0x1a233a);

    renderer = new THREE.WebGLRenderer( );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;

    criaIluminacao();
    createDirectionalLight();
    createPointLight();
    loadObj();
    createGround();
    makeTheCharacterMove();

    camera.position.z = 60;
    renderer.setAnimationLoop( nossaAnimacao );
    
    document.body.appendChild( renderer.domElement );
    renderer.render( scene, camera );

    scene.fog = new THREE.Fog(0x0b1324, 20, 300);

    window.addEventListener( 'resize', onWindowResize );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}
