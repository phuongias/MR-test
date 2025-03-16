const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);


const createScene = function () {
    const scene = new BABYLON.Scene(engine);

    // Kamera hinzufügen
    const camera = new BABYLON.ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 4, 10, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    // Licht hinzufügen
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

    // Einfache Gebäude als Würfel erstellen
    for (let i = -5; i < 5; i++) {
        for (let j = -5; j < 5; j++) {
            const box = BABYLON.MeshBuilder.CreateBox("box", { height: Math.random() * 5 + 1 }, scene);
            box.position.x = i * 3;
            box.position.z = j * 3;
        }
    }

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => scene.render());
