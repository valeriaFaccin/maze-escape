
// Com módulos: import * as CANNON from 'cannon-es';
// Sem módulos: use CANNON do global e remova a import.
import * as CANNON from 'cannon-es';

// Classe que guarda world, materiais e utilitários
export class PhysicsEngine {
    constructor({
        gravity = new CANNON.Vec3(0, -9.82, 0),
        solverIterations = 10,
        allowSleep = true,
    } = {}) {
        this.world = new CANNON.World({ gravity });
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.solver.iterations = solverIterations;
        this.world.allowSleep = allowSleep;

        this.materials = {
        groundMaterial: new CANNON.Material('ground'),
        wallMaterial:   new CANNON.Material('wall'),
        playerMaterial: new CANNON.Material('player'),
        };

        // Contact materials
        this.world.addContactMaterial(new CANNON.ContactMaterial(
        this.materials.groundMaterial, this.materials.playerMaterial,
        { friction: 0.2, restitution: 0.0 }
        ));
        this.world.addContactMaterial(new CANNON.ContactMaterial(
        this.materials.wallMaterial, this.materials.playerMaterial,
        { friction: 0.0, restitution: 0.0 }
        ));

        // Plano do chão
        const groundShape = new CANNON.Plane();
        this.groundBody = new CANNON.Body({
        mass: 0,
        shape: groundShape,
        material: this.materials.groundMaterial,
        });
        this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(this.groundBody);
    }

    step(dt, timeStep = 1 / 60, maxSubSteps = 3) {
        this.world.step(timeStep, dt, maxSubSteps);
    }

    createPlayerBody({
        radius = 2,
        mass = 80,
        linearDamping = 0.2,
        angularDamping = 1.0,
        fixedRotation = true,
        sleepSpeedLimit = 0.05,
        sleepTimeLimit = 0.5,
        start = new CANNON.Vec3(5, radius + 2, 5),
    } = {}) {
        const body = new CANNON.Body({
            mass,
            shape: new CANNON.Sphere(radius),
            material: this.materials.playerMaterial,
        });
        body.position.copy(start);
        body.linearDamping = linearDamping;
        body.angularDamping = angularDamping;
        body.fixedRotation = fixedRotation;
        body.sleepSpeedLimit = sleepSpeedLimit;
        body.sleepTimeLimit  = sleepTimeLimit;

        this.world.addBody(body);
        return body;
    }

    // Utilitário para paredes do labirinto (estático)
    addStaticBox({ halfExtents = new CANNON.Vec3(1, 1, 1), pos = new CANNON.Vec3(), quat = new CANNON.Quaternion(), material = this.materials.wallMaterial } = {}) {
        const shape = new CANNON.Box(halfExtents);
        const body = new CANNON.Body({ mass: 0, shape, material });
        body.position.copy(pos);
        body.quaternion.copy(quat);
        this.world.addBody(body);
        return body;
    }

    dispose() {
        // Se precisar limpar bodies e contatos
        this.world.bodies.forEach(b => this.world.removeBody(b));
    }
}