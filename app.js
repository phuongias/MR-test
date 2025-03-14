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
/***************************************************
 * WebXR Portal demo
 * ************************************************
 *
 * Working (at the moment) on android devices and the latest chrome and (Google VR Services installed) and Meta Quest 3
 *
 *
 * - Once in AR, look at the floor or at a flat surface for a few seconds (and move a little): the hit-testing ring will appear.
 * - Then, is the ring is displayed, the first press on the screen will add a portal at the position of the ring
 * - then walk to the portal and cross it to be in the virtual world.
 *
 */

const createScene = async function () {

    // Creates a basic Babylon Scene object (non-mesh)
    const scene = new BABYLON.Scene(engine);

    // Creates and positions a free camera (non-mesh)
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);

    // Cargets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // Attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // AR availability check and GUI in non-AR mode
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
        "FullscreenUI"
    );

    const rectangle = new BABYLON.GUI.Rectangle("rect");
    rectangle.background = "black";
    rectangle.color = "blue";
    rectangle.width = "80%";
    rectangle.height = "50%";

    advancedTexture.addControl(rectangle);
    const nonXRPanel = new BABYLON.GUI.StackPanel();
    rectangle.addControl(nonXRPanel);

    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica";
    text1.textWrapping = true;
    text1.color = "white";
    text1.fontSize = "14px";
    text1.height = "400px"
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";

    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please make sure you use a supported device such as a Meta Quest 3 or a modern Android device and a supported browser like Chrome.\n \n Make sure you have Google AR services installed and that you enabled the WebXR incubation flag under chrome://flags";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: AR Portal.\n \n Please enter AR with the button on the lower right corner to start. Once in AR, look at the floor for a few seconds (and move a little): the hit-testing ring will appear. Then click anywhere on the screen...";
        nonXRPanel.addControl(text1);
    }

    // Create the WebXR Experience Helper for an AR Session (it initializes the XR scene, creates an XR Camera,
    // initialize the features manager, create an HTML UI button to enter XR,...)
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor",
            onError: (error) => {
                alert(error);
            }
        },
        optionalFeatures: true
    });


    //Get the Feature Manager and from it the HitTesting fearture and the xrcamera
    const fm = xr.baseExperience.featuresManager;
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrCamera = xr.baseExperience.camera

    //Add glow layer, which will be used in the portal and the marker
    const gl = new BABYLON.GlowLayer("glow", scene, {
        mainTextureSamples: 4,
        mainTextureFixedSize: 256,
        blurKernelSize: 100
    });

    //Create neonMaterial, which will be used in the portal
    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88)

    //Create a marker that will be used to represent the hitTest position
    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05, tessellation: 32 });
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
    gl.addIncludedOnlyMesh(marker);
    marker.material = neonMaterial;

    //Update the position/rotation of the marker with HitTest information
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            marker.isVisible = true;
            hitTest = results[0];
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false;
            hitTest = undefined;
        }
    });

    //Set-up root Transform nodes
    const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);
    rootOccluder.rotationQuaternion = new BABYLON.Quaternion();
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();

    //Create Occulers which will hide the 3D scene
    const oclVisibility = 0.001;
    const ground = BABYLON.MeshBuilder.CreateBox("ground", { width: 500, depth: 500, height: 0.001 }, scene); // size should be big enough to hideall you want
    const hole = BABYLON.MeshBuilder.CreateBox("hole", { size: 2, width: 1, height: 0.01 }, scene);

    const groundCSG = BABYLON.CSG.FromMesh(ground);
    const holeCSG = BABYLON.CSG.FromMesh(hole);
    const booleanCSG = groundCSG.subtract(holeCSG);
    const booleanRCSG = holeCSG.subtract(groundCSG);
    //Create the main occluder - to see the 3D scene through the portal when in real world
    const occluder = booleanCSG.toMesh("occluder", null, scene);
    //Create thee reverse occluder - to see the real world  through the portal when inside the 3D scene
    const occluderR = booleanRCSG.toMesh("occluderR", null, scene);
    //Create an occluder box to hide the 3D scene around the user when in real world
    const occluderFloor = BABYLON.MeshBuilder.CreateBox("ground", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderTop = BABYLON.MeshBuilder.CreateBox("occluderTop", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderRight = BABYLON.MeshBuilder.CreateBox("occluderRight", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderLeft = BABYLON.MeshBuilder.CreateBox("occluderLeft", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderback = BABYLON.MeshBuilder.CreateBox("occluderback", { width: 7, depth: 7, height: 0.001 }, scene);
    const occluderMaterial = new BABYLON.StandardMaterial("om", scene);
    occluderMaterial.disableLighting = true; // We don't need anything but the position information
    occluderMaterial.forceDepthWrite = true; //Ensure depth information is written to the buffer so meshes further away will not be drawn
    occluder.material = occluderMaterial;
    occluderR.material = occluderMaterial;
    occluderFloor.material = occluderMaterial;
    occluderTop.material = occluderMaterial;
    occluderRight.material = occluderMaterial;
    occluderLeft.material = occluderMaterial;
    occluderback.material = occluderMaterial;
    ground.dispose();
    hole.dispose();


    //Load Virtual world: the "Hill Valley Scene" and configure occluders
    engine.displayLoadingUI(); //Display the loading screen as the scene takes a few seconds to load
    const virtualWorldResult = await BABYLON.SceneLoader.ImportMeshAsync("", "https://www.babylonjs.com/Scenes/hillvalley/", "HillValley.babylon", scene);
    engine.hideLoadingUI(); //Hide Loadingscreen once the scene is loaded
    for (let child of virtualWorldResult.meshes) {
        child.renderingGroupId = 1;
        child.parent = rootScene;
    }

    occluder.renderingGroupId = 0;
    occluderR.renderingGroupId = 0;
    occluderFloor.renderingGroupId = 0;
    occluderTop.renderingGroupId = 0;
    occluderRight.renderingGroupId = 0;
    occluderLeft.renderingGroupId = 0;
    occluderback.renderingGroupId = 0;

    occluder.parent = rootOccluder;
    occluderR.parent = rootOccluder;
    occluderFloor.parent = rootOccluder;
    occluderTop.parent = rootOccluder;
    occluderRight.parent = rootOccluder;
    occluderLeft.parent = rootOccluder;
    occluderback.parent = rootOccluder;

    occluder.isVisible = true;
    occluderR.isVisible = false;
    occluderFloor.isVisible = true;
    occluderTop.isVisible = true;
    occluderRight.isVisible = true;
    occluderLeft.isVisible = true;
    occluderback.isVisible = true;

    occluder.visibility = oclVisibility;
    occluderR.visibility = oclVisibility;
    occluderFloor.visibility = oclVisibility;
    occluderTop.visibility = oclVisibility;
    occluderRight.visibility = oclVisibility;
    occluderLeft.visibility = oclVisibility;
    occluderback.visibility = oclVisibility;


    scene.setRenderingAutoClearDepthStencil(1, false, false, false); // Do not clean buffer info to ensure occlusion
    scene.setRenderingAutoClearDepthStencil(0, true, true, true); // Clean for 1rst frame
    scene.autoClear = true;

    // Make the virtual world and occluders invisible before portal appears
    rootScene.setEnabled(false);
    rootOccluder.setEnabled(false);

    let portalAppearded = false;
    let portalPosition = new BABYLON.Vector3();
    let portalState = 0; // 0: Platzierung, 1: Skalierung
    let currentScale = 1;
    const scaleSpeed = 0.02;



    // Controller-Eingabe-Handling hinzufügen
    xr.baseExperience.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            // Squeeze-Button für Modus-Reset
            const squeezeComponent = motionController.getComponent("squeeze");
            const triggerComponent = motionController.getComponent("trigger");

            if (squeezeComponent) {
                squeezeComponent.onButtonStateChangedObservable.add((component) => {
                    if (component.changes.pressed && portalState === 1) {
                        portalState = 0;
                        console.log("Skalierungsmodus deaktiviert");
                    }
                });
            }

            if (triggerComponent) {
                triggerComponent.onButtonStateChangedObservable.add((component) => {
                    if (component.changes.pressed && portalState === 0 && hitTest) {
                        portalState = 1;
                        console.log("Skalierungsmodus aktiviert");
                    }
                });
            }
        });
    });

// Render-Loop für Skalierung hinzufügen
    scene.onBeforeRenderObservable.add(() => {
        // Skalierung nur im aktiven Zustand
        if (portalState === 1 && portalAppearded) {
            xr.baseExperience.input.controllers.forEach((controller) => {
                if (controller.inputSource.gamepad) {
                    const gamepad = controller.inputSource.gamepad;
                    const yAxis = gamepad.axes[3]; // Vertikale Achse des rechten Joysticks

                    // Skalierung anpassen
                    currentScale = BABYLON.Scalar.Clamp(
                        currentScale + yAxis * scaleSpeed,
                        0.5, // Minimale Skalierung
                        3    // Maximale Skalierung
                    );

                    // Skalierung auf alle relevanten Elemente anwenden
                    rootPilar.scaling.setAll(currentScale);
                    rootOccluder.scaling.setAll(currentScale);
                    rootScene.scaling.setAll(currentScale);
                }
            });
        }
        

        marker.isVisible = !portalAppearded;

        if ((xrCamera !== undefined) && (portalPosition !== undefined)) {

            if (xrCamera.position.z > portalPosition.z) {

                isInRealWorld = false;
                occluder.isVisible = false;
                occluderR.isVisible = true;
                occluderFloor.isVisible = false;
                occluderTop.isVisible = false;
                occluderRight.isVisible = false;
                occluderLeft.isVisible = false;
                occluderback.isVisible = false;

            }
            else {
                isInRealWorld = true;
                occluder.isVisible = true;
                occluderR.isVisible = false;
                occluderFloor.isVisible = true;
                occluderTop.isVisible = true;
                occluderRight.isVisible = true;
                occluderLeft.isVisible = true;
                occluderback.isVisible = true;

            }
        }

    });

    return scene;

};
window.initFunction = async function() {



    var asyncEngineCreation = async function() {
        try {
            return createDefaultEngine();
        } catch(e) {
            console.log("the available createEngine function failed. Creating the default engine instead");
            return createDefaultEngine();
        }
    }

    window.engine = await asyncEngineCreation();

    const engineOptions = window.engine.getCreationOptions();
    if (engineOptions.audioEngine !== false) {

    }
    if (!engine) throw 'engine should not be null.';
    startRenderLoop(engine, canvas);
    window.scene = createScene();};
initFunction().then(() => {scene.then(returnedScene => { sceneToRender = returnedScene; });

});

// Resize
window.addEventListener("resize", function () {
    engine.resize();
});