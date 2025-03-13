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
var createDefaultEngine = function() { return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true,  disableWebGL2Support: false}); };

const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // AR Verfügbarkeitsprüfung
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    // GUI Setup
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const infoPanel = new BABYLON.GUI.Rectangle("infoPanel");
    infoPanel.background = "rgba(0,0,0,0.7)";
    infoPanel.width = "80%";
    infoPanel.height = "30%";
    infoPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    advancedTexture.addControl(infoPanel);

    const infoText = new BABYLON.GUI.TextBlock("infoText");
    infoText.text = "AR Portal Demo\n\n1. Place portal with click\n2. Rotate with thumbstick\n3. Adjust height\n4. Scale size\n5. Confirm with click";
    infoText.color = "white";
    infoText.fontSize = "24px";
    infoText.textWrapping = true;
    infoText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    infoPanel.addControl(infoText);

    // WebXR Experience
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor",
            onError: (error) => console.error(error)
        },
        optionalFeatures: true
    });

    // HitTest Feature
    const fm = xr.baseExperience.featuresManager;
    const hitTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrCamera = xr.baseExperience.camera;

    // Portal Konfigurationsvariablen
    let portalState = 0; // 0=Platzierung, 1=Rotation, 2=Höhe, 3=Skalierung, 4=Aktiv
    const placementRect = BABYLON.MeshBuilder.CreatePlane("placementRect", { width: 1, height: 0.5 }, scene);
    placementRect.isVisible = false;
    placementRect.rotationQuaternion = new BABYLON.Quaternion();

    // Material für Platzierungsrechteck
    const rectMat = new BABYLON.StandardMaterial("rectMat", scene);
    rectMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
    rectMat.alpha = 0.5;
    placementRect.material = rectMat;

    // Controller Eingabe
    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            const thumbstick = motionController.getComponent("xr-standard-thumbstick");
            if (thumbstick) {
                thumbstick.onAxisValueChangedObservable.add((axes) => {
                    if (portalState === 1) { // Rotation
                        placementRect.rotation.y += axes.x * 0.1;
                    } else if (portalState === 2) { // Höhe
                        placementRect.position.y += axes.y * 0.05;
                    } else if (portalState === 3) { // Skalierung
                        const scale = Math.max(0.5, placementRect.scaling.x + axes.y * 0.1);
                        placementRect.scaling.set(scale, scale, scale);
                    }
                });
            }
        });
    });

    // Originale Portal-Komponenten
    const gl = new BABYLON.GlowLayer("glow", scene, {
        mainTextureSamples: 4,
        mainTextureFixedSize: 256,
        blurKernelSize: 100
    });

    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88);

    // Occluder Setup
    const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    const oclVisibility = 0.001;

    // Virtuelle Welt laden
    engine.displayLoadingUI();
    const virtualWorldResult = await BABYLON.SceneLoader.ImportMeshAsync(
        "", "https://www.babylonjs.com/Scenes/hillvalley/", "HillValley.babylon", scene
    );
    engine.hideLoadingUI();

    // Pointer Events
    scene.onPointerDown = (evt, pickInfo) => {
        if (hitTest && xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            if (portalState === 0) {
                const hitResult = hitTest.getLastHitTestResults()[0];
                placementRect.position.copyFrom(hitResult.transformationMatrix.getTranslation());
                placementRect.isVisible = true;
                portalState = 1;
                infoText.text = "Rotate with thumbstick\nLeft/Right";
            } else if (portalState < 3) {
                portalState++;
                infoText.text = portalState === 2
                    ? "Adjust height\nUp/Down"
                    : "Scale size\nUp/Down";
            } else {
                createPortalStructure();
                placementRect.isVisible = false;
                portalState = 4;
                infoPanel.isVisible = false;
            }
        }
    };

    const createPortalStructure = () => {
        // Occluder erstellen
        const ground = BABYLON.MeshBuilder.CreateBox("ground", {
            width: 500,
            depth: 500,
            height: 0.001
        }, scene);

        const portalWidth = placementRect.scaling.x;
        const portalHeight = placementRect.scaling.y;

        const hole = BABYLON.MeshBuilder.CreateBox("hole", {
            width: portalWidth,
            depth: portalHeight,
            height: 0.02
        }, scene);
        hole.position.copyFrom(placementRect.position);
        hole.rotation.copyFrom(placementRect.rotation);

        // CSG Operation
        const groundCSG = BABYLON.CSG.FromMesh(ground);
        const holeCSG = BABYLON.CSG.FromMesh(hole);
        const finalCSG = groundCSG.subtract(holeCSG);
        const occluder = finalCSG.toMesh("occluder", null, scene);

        // Material
        const oclMat = new BABYLON.StandardMaterial("oclMat", scene);
        oclMat.disableLighting = true;
        oclMat.forceDepthWrite = true;
        occluder.material = oclMat;
        occluder.visibility = oclVisibility;

        // Virtuelle Welt positionieren
        virtualWorldResult.meshes.forEach((mesh) => {
            mesh.parent = rootScene;
            mesh.renderingGroupId = 1;
        });

        rootScene.position.copyFrom(placementRect.position);
        rootScene.rotation.copyFrom(placementRect.rotation);
        rootScene.setEnabled(true);
        rootOccluder.setEnabled(true);

        // Portal Rahmen
        const frame = BABYLON.MeshBuilder.CreateBox("frame", {
            width: portalWidth + 0.2,
            height: portalHeight + 0.2,
            depth: 0.2
        }, scene);
        frame.position.copyFrom(placementRect.position);
        frame.position.z += 0.1;
        frame.rotation.copyFrom(placementRect.rotation);
        frame.material = neonMaterial;
        gl.addIncludedOnlyMesh(frame);

        // Partikel Effekte
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#488", scene, false)
            .then(system => system.emitter = frame);
    };

    // XR Session Handling
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        infoPanel.isVisible = true;
    });

    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        portalState = 0;
        placementRect.isVisible = false;
        infoPanel.isVisible = false;
        rootScene.setEnabled(false);
        rootOccluder.setEnabled(false);
    });

    return scene;
};

// Initialisierung
window.initFunction = async function() {
    window.engine = await createDefaultEngine();
    startRenderLoop(engine, canvas);
    window.scene = createScene();
};

initFunction().then(() => {
    scene.then(returnedScene => { sceneToRender = returnedScene; });
});

// Resize Handler
window.addEventListener("resize", function () {
    engine.resize();
});