// https://www.mixamo.com/#/?page=1&type=Motion%2CMotionPack

import * as THREE from 'three';
import {GUI} from 'three/addons/libs/lil-gui.module.min.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';

let camera, scene, renderer;
let objects = [];
let parametrosGui;

var mixer;
var animationActions = [];
var activeAnimation;
var lastAnimation;
var loadFinished = false;
var walking = false;
var walkingLeft = false;
var walkingInto = false;
var walkingS = false;
var clock = new THREE.Clock();
var objLoader = new OBJLoader();
var fbxLoader = new FBXLoader();
var arrayCharactersPositions = [];
var currentGuy;

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
    // let textLoader = new THREE.TextureLoader();

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
            // console.log("vivo! "+(progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            // console.log("morto " + error);
        }
    );

    fbxLoader.load (
        "assets/Character/Running.fbx",
        function(obj){
            obj.traverse(function (child){
                if (child instanceof THREE.Mesh){
                    // let texture = textLoader.load("assets/fbx/Dragon_ground_color.jpg");
                    // child.material =  new THREE.MeshStandardMaterial({map: texture});
                    // child.castShadow = true;
                    // child.receiveShadow = true;
                }
            });
            // scene.add(obj);
            objects["dragon"] = obj;
            obj.position.x = -10;
            obj.scale.x = obj.scale.y = obj.scale.z = 0.2;
            obj.position.y -= 5.8;
            arrayCharactersPositions['running'] = obj;

            // animationOfCharacter(obj);
        },
        function(progress){
            console.log("vivo! "+(progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            console.log("morto " + error);
        }
    );

    fbxLoader.load (
        "assets/Character/BreathingIdle.fbx",
        function(obj){
            obj.traverse(function (child){
                if (child instanceof THREE.Mesh){
                }
            });
            objects["dragon"] = obj;
            obj.position.x = -10;
            obj.scale.x = obj.scale.y = obj.scale.z = 0.2;
            obj.position.y -= 5.8;
            arrayCharactersPositions['idle'] = obj;
            currentGuy = arrayCharactersPositions['idle'];

            // animationOfCharacter(obj);
        },
        function(progress){
            console.log("vivo! "+(progress.loaded/progress.total)*100 + "%");
        },
        function(error){
            console.log("morto " + error);
        }
    );
}

const animationOfCharacter = (obj) => {
    let animation;
    mixer = new THREE.AnimationMixer(obj);
    //voando
    animation = mixer.clipAction(obj.animations[1]);
    animationActions.push(animation);
    //andando
    animation = mixer.clipAction(obj.animations[0]);
    animationActions.push(animation);

    // //idle
    // animation = mixer.clipAction(obj.animations[2]);
    // animationActions.push(animation);
    //  //apertado banheiro
    // animation = mixer.clipAction(obj.animations[3]);
    // animationActions.push(animation);

    activeAnimation = animation;
    setAction (animationActions[1]);
    loadFinished = true;
    activeAnimation.play();
}

export function init() {
    camera = new THREE.PerspectiveCamera( 100, window.innerWidth / window.innerHeight, 0.1, 2000 );

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcce0ff);

    renderer = new THREE.WebGLRenderer( );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = true;

    criaIluminacao(parametrosGui);
    createDirectionalLight(parametrosGui);
    createSpotLight(parametrosGui);
    createPointLight(parametrosGui);
    createGui();
    loadObj();
    createGround();
    makeTheCharacterMove();
    scene.add(currentGuy);

    camera.position.z = 60;
    renderer.setAnimationLoop( nossaAnimacao );
    
    document.body.appendChild( renderer.domElement );
    renderer.render( scene, camera );

    scene.fog = new THREE.Fog(0xcccccc, 10, 500);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousemove', makeMove);
    document.addEventListener('mouseup', clickOn);
    document.addEventListener('mousedown', ClickOff);

    window.addEventListener( 'resize', onWindowResize );
}

const makeTheCharacterMove = () => {
    document.addEventListener('keydown', (e) => {
        if (!arrayCharactersPositions['running']) return;
        currentGuy = arrayCharactersPositions['running'];

        if (e.code === "KeyW" && !walking) {
            walkingInto = true;
            setAction(animationActions[1]);
        }

        if (e.code === "KeyD" && !walking) {
            walking = true;
            setAction(animationActions[1]);
        }

        if (e.code === "KeyA" && !walkingLeft) {
            walkingLeft = true;
            setAction(animationActions[1]);
        }

        if (e.code === "KeyS" && !walkingS) {
            walkingS = true;
            setAction(animationActions[1]);
        }
    });

    document.addEventListener('keyup', (e) => {
        if (!arrayCharactersPositions['idle']) return;
        currentGuy = arrayCharactersPositions['idle'];

        if (e.code === "KeyW") {
            walkingInto = false;
            setAction(animationActions[0]);
        }

        if (e.code === "KeyD") {
            walking = false;
            setAction(animationActions[0]);
        }

        if (e.code === "KeyA") {
            walkingLeft = false;
            setAction(animationActions[0]);
        }

        if (e.code === "KeyS") {
            walkingS = false;
            setAction(animationActions[0]);
        }
    });
}

// GROUND --------------
const createGround = () => {
    let textLoader = new THREE.TextureLoader();
    let textGround = textLoader.load("assets/grasslight-big.jpg");
    textGround.wrapS = textGround.wrapT = THREE.RepeatWrapping;
    textGround.repeat.set(25,25);
    textGround.anisotropy = 16;

    let materialGround = new THREE.MeshStandardMaterial({map: textGround});

    let ground = new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),
                                 materialGround);

    ground.rotation.x = -Math.PI/2;
    ground.position.y-=6;

    ground.receiveShadow = true;
    scene.add(ground);
}

/**
 * Section of Animation
*/
var nossaAnimacao = function () {
    let delta = clock.getDelta();
    
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

        if (walkingInto) {
            objects['dragon'].rotation.y = 0;
            objects['dragon'].position.z += 0.5;
            camera.position.z += 0.5;
        }

        if (walkingS) {
            objects['dragon'].rotation.y = Math.PI;
            objects['dragon'].position.z -= 0.5;
            camera.position.z -= 0.5;
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
