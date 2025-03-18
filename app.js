// ================================================================
// Integrated AR Portal Demo with Reticle Adjustments (Babylon.js)
// Combines original Babylon "complex code" with reticle adjustments (from THREE)
// ================================================================

// -----------------------------
// Global Variables and Constants
// -----------------------------
let state = 0; // State machine: 0 = not placed, 1 = rotation, 2 = height, 3 = scale, 4 = portal activated
let reticleMesh = null;  // Mesh used for reticle adjustments (created as a plane)
let portalAppeared = false;  // Flag to track if portal is activated
let portalPosition = new BABYLON.Vector3();  // Final portal position

// -----------------------------
// Babylon Engine Setup
// -----------------------------
var canvas = document.getElementById("renderCanvas");

var engine = null;
var scene = null;
var sceneToRender = null;

// Start the render loop
var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
};

// Create the Babylon Engine
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        disableWebGL2Support: false
    });
};

// -----------------------------
// Main Scene Creation Function
// -----------------------------
const createScene = async function () {
    // Create the scene and set up camera
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    // -----------------------------
    // Create GUI for non-AR mode and AR availability check
    // -----------------------------
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("FullscreenUI");
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
    text1.height = "400px";
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";

    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please use a supported device (e.g., Meta Quest 3 or modern Android) and browser (e.g., Chrome).";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: AR Portal.\n\nEnter AR and look at the floor for a hit-test marker to appear. Then tap anywhere to begin placement.";
        nonXRPanel.addControl(text1);
    }

    // -----------------------------
    // Create the WebXR Experience Helper for AR
    // -----------------------------
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

    // -----------------------------
    // Hit-Test and Marker Setup
    // -----------------------------
    const fm = xr.baseExperience.featuresManager;
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrCamera = xr.baseExperience.camera;

    // Create a neon material used for the marker and portal effects
    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88);

    // Create the hit-test marker (a torus) as in the original Babylon code
    const marker = BABYLON.MeshBuilder.CreateTorus('marker', {
        diameter: 0.15,
        thickness: 0.05,
        tessellation: 32
    }, scene);
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
    marker.renderingGroupId = 2;
    marker.material = neonMaterial;

    // Update marker's transform using hit-test results
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            // Reticle sichtbar machen, wenn aktiv
            marker.isVisible = !portalAppeared && (state === 0);
            reticleMesh.isVisible = portalAppeared ? false : (state > 0); // Neu

            hitTest = results[0];
            // Decompose the hit-test matrix to update marker position and rotation
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false;
            if (reticleMesh) reticleMesh.isVisible = false; // Neu
        }
    });

    // -----------------------------
    // Root Transform Nodes for Virtual World and Portal
    // -----------------------------
    const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);
    rootOccluder.rotationQuaternion = new BABYLON.Quaternion();
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();

    // -----------------------------
    // Occluder Setup using CSG (Constructive Solid Geometry)
    // -----------------------------
    // Create a large ground box and a hole box for occluders
    const ground = BABYLON.MeshBuilder.CreateBox("ground", {width: 500, depth: 500, height: 0.001}, scene);
    const hole = BABYLON.MeshBuilder.CreateBox("hole", {size: 2, width: 1, height: 0.01}, scene);

    // Perform CSG subtraction for occluders
    const groundCSG = BABYLON.CSG.FromMesh(ground);
    const holeCSG = BABYLON.CSG.FromMesh(hole);
    const booleanCSG = groundCSG.subtract(holeCSG);
    const booleanRCSG = holeCSG.subtract(groundCSG);

    // Create main occluder meshes
    const occluder = booleanCSG.toMesh("occluder", null, scene);
    const occluderR = booleanRCSG.toMesh("occluderR", null, scene);
    // Additional occluder boxes for floor and sides
    const occluderFloor = BABYLON.MeshBuilder.CreateBox("occluderFloor", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderTop = BABYLON.MeshBuilder.CreateBox("occluderTop", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderRight = BABYLON.MeshBuilder.CreateBox("occluderRight", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderLeft = BABYLON.MeshBuilder.CreateBox("occluderLeft", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderback = BABYLON.MeshBuilder.CreateBox("occluderback", {width: 7, depth: 7, height: 0.001}, scene);

    // Create occluder material to force depth write
    const occluderMaterial = new BABYLON.StandardMaterial("om", scene);
    occluderMaterial.disableLighting = true;
    occluderMaterial.forceDepthWrite = true;

    // Apply material to occluders
    occluder.material = occluderMaterial;
    occluderR.material = occluderMaterial;
    occluderFloor.material = occluderMaterial;
    occluderTop.material = occluderMaterial;
    occluderRight.material = occluderMaterial;
    occluderLeft.material = occluderMaterial;
    occluderback.material = occluderMaterial;

    // Dispose temporary meshes
    ground.isVisible = false;
    hole.isVisible = false;

    // -----------------------------
    // Load the Virtual World (Hill Valley Scene)
    // -----------------------------
    engine.displayLoadingUI(); // Show loading screen
    const virtualWorldResult = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "https://www.babylonjs.com/Scenes/hillvalley/",
        "HillValley.babylon",
        scene
    );
    engine.hideLoadingUI(); // Hide loading screen once loaded

    // Parent each mesh to the virtual world root and assign rendering group
    for (let child of virtualWorldResult.meshes) {
        child.renderingGroupId = 1;
        child.parent = rootScene;
    }

    // Set occluders to rendering group 0
    occluder.renderingGroupId = 0;
    occluderR.renderingGroupId = 0;
    occluderFloor.renderingGroupId = 0;
    occluderTop.renderingGroupId = 0;
    occluderRight.renderingGroupId = 0;
    occluderLeft.renderingGroupId = 0;
    occluderback.renderingGroupId = 0;

    // Parent occluders to rootOccluder
    occluder.parent = rootOccluder;
    occluderR.parent = rootOccluder;
    occluderFloor.parent = rootOccluder;
    occluderTop.parent = rootOccluder;
    occluderRight.parent = rootOccluder;
    occluderLeft.parent = rootOccluder;
    occluderback.parent = rootOccluder;

    // Set visibility and low opacity for occluders
    const oclVisibility = 0.001;
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

    // Disable virtual world and occluders until portal activation
    rootScene.setEnabled(false);
    rootOccluder.setEnabled(false);

    // -----------------------------
    // Reticle (Placement Mesh) Creation
    // -----------------------------
    function createReticle() {
        if (!reticleMesh) {
            // Plane in Y-Achse erstellen (vertikal)
            reticleMesh = BABYLON.MeshBuilder.CreatePlane("reticleMesh", {
                sourcePlane: new BABYLON.Plane(0, 1, 0, 0) // Y-Achse als Normale
            });

            let reticleMat = new BABYLON.StandardMaterial("reticleMaterial", scene);
            reticleMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
            reticleMat.backFaceCulling = false;

            // Transparenz hinzufügen für bessere Sichtbarkeit
            reticleMat.alpha = 0.7;
            reticleMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;

            reticleMesh.material = reticleMat;
            reticleMesh.renderingGroupId = 3;
            reticleMesh.isVisible = false;

            // Rotation korrigieren (90 Grad um X-Achse)
            reticleMesh.rotation.x = Math.PI / 2; // Wichtig für vertikale Ausrichtung
        }
    }

    // -----------------------------
    // onPointerDown: Handle "Select" / State Transitions
    // -----------------------------
    scene.onPointerDown = (evt, pickInfo) => {
        // Only process if in AR session
        if (xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            if (state === 0 && hitTest) {
                createReticle();
                // Position UND Rotation vom Hit-Test übernehmen
                reticleMesh.position.copyFrom(marker.position);
                reticleMesh.rotationQuaternion = marker.rotationQuaternion.clone();
                reticleMesh.isVisible = true; // Sicherstellen, dass sichtbar
                state = 1;
            } else if (state === 1) {
                // Second tap: Finish rotation adjustment; move to height adjustment
                state = 2;
            } else if (state === 2) {
                // Third tap: Finish height adjustment; move to scale adjustment
                state = 3;
            } else if (state === 3) {
                // Fourth tap: Finish scale adjustment and activate the portal
                state = 4;
                activatePortal();
            }
        }
    };

    // -----------------------------
    // Gamepad Input Handling for Reticle Adjustments
    // -----------------------------
    scene.onBeforeRenderObservable.add(() => {
        // Process gamepad input only if reticle exists and portal is not activated
        if (xr.baseExperience && xr.baseExperience.sessionManager.session && reticleMesh && state < 4) {
            const xrSession = xr.baseExperience.sessionManager.session;
            for (const inputSource of xrSession.inputSources) {
                if (inputSource.gamepad) {
                    const gamepad = inputSource.gamepad;
                    const xAxis = gamepad.axes[2];  // Horizontal axis (e.g., for rotation)
                    const yAxis = gamepad.axes[3];  // Vertical axis (e.g., for height/scale)
                    if (state === 1) {
                        // Adjust reticle rotation around Y-axis
                        reticleMesh.rotation.y += xAxis * 0.025;
                    } else if (state === 2) {
                        // Adjust reticle height (Y position)
                        reticleMesh.position.y += yAxis * 0.05;
                    } else if (state === 3) {
                        // Adjust reticle scaling (uniform scale)
                        const scale = Math.max(0.1, reticleMesh.scaling.x + yAxis * 0.02);
                        reticleMesh.scaling.set(scale, scale, scale);
                    }
                }
            }
        }

        // -----------------------------
        // Update Occluder Visibility based on XR Camera vs. Portal Position
        // -----------------------------
        if (portalPosition && xrCamera) {
            // Simple check based on Z position (you may want to adjust this for your scene)
            if (xrCamera.position.z > portalPosition.z) {
                // User is inside the virtual world: adjust occluders for proper occlusion
                occluder.isVisible = false;
                occluderR.isVisible = true;
                occluderFloor.isVisible = false;
                occluderTop.isVisible = false;
                occluderRight.isVisible = false;
                occluderLeft.isVisible = false;
                occluderback.isVisible = false;

            } else {
                // User is in the real world: show occluders to hide the virtual world
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

    // -----------------------------
    // Activate Portal: Finalize Placement and Create Portal Geometry
    // -----------------------------
    function activatePortal() {
        portalAppeared = true;
        if (reticleMesh) {
            reticleMesh.isVisible = false;
        }
        rootScene.setEnabled(true);
        rootOccluder.setEnabled(true);

        // Portal erhält Position, Rotation und Skalierung vom reticleMesh
        portalPosition.copyFrom(reticleMesh.position);
        rootPilar.position.copyFrom(reticleMesh.position);
        rootPilar.rotation.copyFrom(reticleMesh.rotation);
        rootPilar.scaling.copyFrom(reticleMesh.scaling);

        // Portaldimensionen basierend auf reticleMesh-Skalierung
        const portalWidth = 1 * reticleMesh.scaling.x;
        const portalHeight = 1 * reticleMesh.scaling.y;

        // Vertikale Pfeiler (links und rechts)
        const pilar1 = BABYLON.MeshBuilder.CreateBox("pilar1", {
            height: portalHeight,
            width: 0.1,
            depth: 0.1
        }, scene);
        const pilar2 = BABYLON.MeshBuilder.CreateBox("pilar2", {
            height: portalHeight,
            width: 0.1,
            depth: 0.1
        }, scene);

        // Horizontaler Balken (oben)
        const pilar3 = BABYLON.MeshBuilder.CreateBox("pilar3", {
            height: portalWidth, // Balkenlänge = Portalbreite
            width: 0.1,
            depth: 0.1
        }, scene);

        // Positionierung der Elemente
        pilar1.position.x = -portalWidth / 2; // Linker Pfeiler
        pilar2.position.x = portalWidth / 2;  // Rechter Pfeiler
        pilar3.position.y = portalHeight / 2; // Balken oben
        pilar3.rotation.z = Math.PI / 2;      // Balken drehen

        // Elemente an rootPilar hängen
        pilar1.parent = rootPilar;
        pilar2.parent = rootPilar;
        pilar3.parent = rootPilar;

        // Material und Rendering-Gruppen
        pilar1.material = neonMaterial;
        pilar2.material = neonMaterial;
        pilar3.material = neonMaterial;
        pilar1.renderingGroupId = 2;
        pilar2.renderingGroupId = 2;
        pilar3.renderingGroupId = 2;

        // Add particle effects to the portal (using provided snippet IDs)
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#488", scene, false).then(system => {
            system.emitter = pilar3;
        });
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#489", scene, false).then(system => {
            system.emitter = pilar1;
        });
        BABYLON.ParticleHelper.ParseFromSnippetAsync("UY098C#489", scene, false).then(system => {
            system.emitter = pilar2;
        });
    }

    // -----------------------------
    // Hide GUI in AR Mode and Show on Session End
    // -----------------------------
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        rectangle.isVisible = false;
    });
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        rectangle.isVisible = true;
    });

    // -----------------------------
    // Scene Render Settings
    // -----------------------------
    scene.setRenderingAutoClearDepthStencil(1, false, false, false);
    scene.setRenderingAutoClearDepthStencil(2, false, false, false);
    scene.setRenderingAutoClearDepthStencil(0, true, true, true);

    scene.autoClear = true;

    return scene;
};

// -----------------------------
// Engine Initialization and Scene Launch
// -----------------------------
window.initFunction = async function () {
    var asyncEngineCreation = async function () {
        try {
            return createDefaultEngine();
        } catch (e) {
            console.log("createEngine function failed. Creating the default engine instead");
            return createDefaultEngine();
        }
    };
    window.engine = await asyncEngineCreation();
    if (!engine) throw 'engine should not be null!.';
    startRenderLoop(engine, canvas);
    window.scene = createScene();
};

initFunction().then(() => {
    scene.then(returnedScene => {
        sceneToRender = returnedScene;
    });
});

// -----------------------------
// Resize Event Listener
// -----------------------------
window.addEventListener("resize", function () {
    engine.resize();
});
