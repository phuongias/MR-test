var canvas = document.getElementById("renderCanvas");

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
}

var engine = null;
var scene = null;
var sceneToRender = null;
var createDefaultEngine = function() {
    return new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        disableWebGL2Support: false
    });
};

const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    let isScaling = false;
    let initialDistance = 0;
    let initialScale = new BABYLON.Vector3(1, 1, 1);
    let portalAppearded = false;
    let isInRealWorld = true;

    // AR Check und GUI
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const rectangle = new BABYLON.GUI.Rectangle("rect");
    rectangle.background = "black";
    rectangle.color = "blue";
    rectangle.width = "80%";
    rectangle.height = "50%";
    advancedTexture.addControl(rectangle);

    const text1 = new BABYLON.GUI.TextBlock("text1", arAvailable ?
        "WebXR Demo: AR Portal.\n\nBitte AR starten und Boden scannen." :
        "AR nicht verfügbar");
    text1.color = "white";
    text1.fontSize = "14px";
    rectangle.addControl(text1);

    if (!arAvailable) return scene;

    // WebXR Initialisierung
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor"
        }
    });

    // Portal-Komponenten
    const rootPilar = new BABYLON.TransformNode("portalRoot", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();
    rootPilar.scaling = new BABYLON.Vector3(1, 1, 1);

    // HitTest
    const hitTest = xr.baseExperience.featuresManager.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const marker = BABYLON.MeshBuilder.CreateTorus("marker", {diameter: 0.15, thickness: 0.05});
    marker.isVisible = false;
    marker.rotation.x = Math.PI/2;

    // Glow Layer
    const gl = new BABYLON.GlowLayer("glow", scene);
    const neonMaterial = new BABYLON.StandardMaterial("neon", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88);

    // Controller Handling
    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            const squeeze = motionController.getComponent("xr-squeeze");

            squeeze?.onButtonStateChangedObservable.add(() => {
                const bothPressed = xr.input.controllers.length === 2 &&
                    xr.input.controllers.every(c => c.motionController?.getComponent("xr-squeeze")?.pressed);

                if (bothPressed && portalAppearded) {
                    const [c1, c2] = xr.input.controllers;
                    initialDistance = BABYLON.Vector3.Distance(c1.pointer.position, c2.pointer.position);
                    initialScale.copyFrom(rootPilar.scaling);
                    isScaling = true;
                } else {
                    isScaling = false;
                }
            });
        });
    });

    // HitTest Updates
    hitTest.onHitTestResultObservable.add((results) => {
        marker.isVisible = results.length > 0 && !portalAppearded;
        if (results[0]) {
            results[0].transformationMatrix.decompose(undefined, undefined, rootPilar.position);
        }
    });

    // Skalierungslogik
    scene.onBeforeRenderObservable.add(() => {
        if (isScaling && xr.input.controllers.length === 2) {
            const [c1, c2] = xr.input.controllers;
            const currentDistance = BABYLON.Vector3.Distance(c1.pointer.position, c2.pointer.position);
            const scaleFactor = currentDistance / initialDistance;
            rootPilar.scaling.copyFrom(initialScale.scale(scaleFactor));
        }
    });

    // Portal Erstellung
    scene.onPointerDown = async (evt, pickInfo) => {
        if (!portalAppearded && marker.isVisible) {
            portalAppearded = true;
            marker.isVisible = false;

            // Portal Meshes
            const createPillar = (x, z) => {
                const pillar = BABYLON.MeshBuilder.CreateBox("pillar", {height: 2, width: 0.1, depth: 0.1});
                pillar.parent = rootPilar;
                pillar.position.set(x, 1, z);
                pillar.material = neonMaterial;
                gl.addIncludedOnlyMesh(pillar);
                return pillar;
            };

            const pillars = [
                createPillar(-0.5, 0.05),
                createPillar(0.5, 0.05),
                (() => {
                    const crossbar = BABYLON.MeshBuilder.CreateBox("crossbar", {height: 0.1, width: 1.1, depth: 0.1});
                    crossbar.parent = rootPilar;
                    crossbar.position.set(0, 1.5, 0.05);
                    crossbar.material = neonMaterial;
                    gl.addIncludedOnlyMesh(crossbar);
                    return crossbar;
                })()
            ];

            // Partikel
            BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#488", scene)
                .then(system => system.emitter = rootPilar);

            // Virtuelle Welt
            engine.displayLoadingUI();
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "",
                "https://www.babylonjs.com/Scenes/hillvalley/",
                "HillValley.babylon"
            );
            result.meshes.forEach(m => {
                m.parent = rootPilar;
                m.position.y -= 1;
                m.position.x += 29;
                m.position.z -= 11;
            });
            engine.hideLoadingUI();
        }
    };

    // AR Session Handling
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        rectangle.isVisible = false;
    });

    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        rectangle.isVisible = true;
    });

    return scene;
};

window.initFunction = async function() {
    window.engine = createDefaultEngine();
    startRenderLoop(engine, canvas);
    window.scene = createScene();
};

window.addEventListener("DOMContentLoaded", initFunction);
window.addEventListener("resize", () => engine.resize());