const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const createScene = function () {
    const scene = new BABYLON.Scene(engine);

    // Kamera hinzufügen
    const camera = new BABYLON.ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 4, 20, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    // Licht hinzufügen
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

    // Boden erstellen
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, scene);
    const groundMaterial = new BABYLON.StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseTexture = new BABYLON.Texture("https://assets.babylonjs.com/environments/grass.jpg", scene);
    ground.material = groundMaterial;

    // Himmel erstellen (Skybox)
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000 }, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://assets.babylonjs.com/environments/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skybox.material = skyboxMaterial;

    // Gebäude hinzufügen
    for (let i = -5; i < 5; i++) {
        for (let j = -5; j < 5; j++) {
            const box = BABYLON.MeshBuilder.CreateBox("box", { height: Math.random() * 5 + 1 }, scene);
            box.position.x = i * 3;
            box.position.z = j * 3;
        }
    }

    // Bäume hinzufügen
    for (let i = -3; i < 3; i++) {
        for (let j = -3; j < 3; j++) {
            if (Math.random() > 0.7) {
                const trunk = BABYLON.MeshBuilder.CreateCylinder("trunk", { diameter: 0.5, height: 2 }, scene);
                trunk.position.set(i * 6, 1, j * 6);
                const leaves = BABYLON.MeshBuilder.CreateSphere("leaves", { diameter: 3 }, scene);
                leaves.position.set(i * 6, 3, j * 6);
                leaves.material = new BABYLON.StandardMaterial("leavesMat", scene);
                leaves.material.diffuseColor = new BABYLON.Color3(0, 1, 0);
            }
        }
    }

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());