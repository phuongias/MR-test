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
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });
};

const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor"
        }
    });

    // Portal-Kernkomponenten
    const rootPilar = new BABYLON.TransformNode("portalRoot", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();

    // Controller-Zustände
    let manipulationState = 0; // 0:Platzieren 1:Rotieren 2:Höhe 3:Skalieren
    let portalActive = false;
    let isInRealWorld = true;

    // Controller-Handling
    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            const trigger = motionController.getComponent("xr-standard-trigger");
            const squeeze = motionController.getComponent("xr-squeeze");

            trigger.onButtonStateChangedObservable.add((state) => {
                if (state.pressed) handleTrigger();
            });

            squeeze.onButtonStateChangedObservable.add(() => {
                if (manipulationState > 0) manipulationState--;
                updateUI();
            });
        });
    });

    // HitTest Initialisierung
    const hitTest = xr.baseExperience.featuresManager.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const reticle = BABYLON.MeshBuilder.CreateTorus("reticle", { diameter: 0.15, thickness: 0.05 });
    reticle.isVisible = false;

    hitTest.onHitTestResultObservable.add((results) => {
        if (manipulationState === 0 && results.length) {
            reticle.isVisible = true;
            results[0].transformationMatrix.decompose(undefined, undefined, rootPilar.position);
        } else {
            reticle.isVisible = false;
        }
    });

    // Portal-Mesh
    const portalFrame = BABYLON.MeshBuilder.CreateBox("portal", { height: 2, width: 0.1, depth: 0.1 });
    portalFrame.parent = rootPilar;
    portalFrame.isVisible = false;

    // Virtuelle Welt
    const virtualWorldContainer = new BABYLON.TransformNode("virtualScene");
    const loadVirtualWorld = async () => {
        engine.displayLoadingUI();
        const result = await BABYLON.SceneLoader.ImportMeshAsync("",
            "https://www.babylonjs.com/Scenes/hillvalley/",
            "HillValley.babylon",
            scene
        );
        result.meshes.forEach(m => {
            m.parent = virtualWorldContainer;
            m.renderingGroupId = 1;
        });
        virtualWorldContainer.parent = rootPilar;
        virtualWorldContainer.setEnabled(false);
        engine.hideLoadingUI();
    };

    // Okklusionssystem
    const createOccluders = () => {
        const occluder = BABYLON.MeshBuilder.CreatePlane("occluder", { size: 2 });
        occluder.parent = rootPilar;
        occluder.position.z = -0.1;
        occluder.renderingGroupId = 0;

        const material = new BABYLON.StandardMaterial("occluderMat");
        material.alpha = 0.001;
        occluder.material = material;

        return occluder;
    };

    // Interaktionslogik
    const handleTrigger = () => {
        switch (manipulationState) {
            case 0: // Platzierung
                portalFrame.isVisible = true;
                manipulationState = 1;
                break;
            case 3: // Aktivierung
                activatePortal();
                break;
            default:
                manipulationState++;
        }
        updateUI();
    };

    const activatePortal = async () => {
        portalActive = true;
        await loadVirtualWorld();
        createOccluders();
        virtualWorldContainer.setEnabled(true);

        // Effekte
        const gl = new BABYLON.GlowLayer("glow", scene);
        gl.addIncludedOnlyMesh(portalFrame);

        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#488", scene)
            .then(system => system.emitter = portalFrame);
    };

    // Gamepad-Logik
    scene.onBeforeRenderObservable.add(() => {
        if (!xr.baseExperience.sessionManager.inXRSession) return;

        const controller = xr.input.controllers[0];
        if (controller?.motionController?.gamepad) {
            const axes = controller.motionController.gamepad.axes;

            switch (manipulationState) {
                case 1: // Rotation
                    rootPilar.rotation.y += axes[0] * 0.1;
                    break;
                case 2: // Höhe
                    rootPilar.position.y += axes[1] * 0.05;
                    break;
                case 3: // Skalierung
                    rootPilar.scaling.x = Math.min(3, Math.max(0.5, rootPilar.scaling.x + axes[5] * 0.02));
                    rootPilar.scaling.y = rootPilar.scaling.x;
                    rootPilar.scaling.z = rootPilar.scaling.x;
                    break;
            }
        }

        // Portal-Übergangslogik
        isInRealWorld = xr.baseExperience.camera.position.z > rootPilar.position.z;
        virtualWorldContainer.setEnabled(!isInRealWorld);
    });

    // UI-System
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const statusLabel = new BABYLON.GUI.TextBlock("status", "Portal nicht platziert");
    statusLabel.color = "white";
    statusLabel.fontSize = 24;
    advancedTexture.addControl(statusLabel);

    const updateUI = () => {
        const states = ["Platziere Portal", "Rotiere", "Passe Höhe an", "Skaliere"];
        statusLabel.text = portalActive ?
            `Portal aktiv! ${isInRealWorld ? "Draußen" : "Drinnen"}` :
            states[manipulationState];
    };

    // AR-Session-Handling
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        statusLabel.isVisible = false;
    });

    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        statusLabel.isVisible = true;
        rootPilar.setEnabled(false);
    });

    return scene;
};

window.initFunction = async function () {
    window.engine = createDefaultEngine();
    startRenderLoop(engine, canvas);
    window.scene = createScene();
};

window.addEventListener("DOMContentLoaded", () => {
    initFunction().then(() => {
        scene.then(s => sceneToRender = s);
    });
});

window.addEventListener("resize", () => engine.resize());