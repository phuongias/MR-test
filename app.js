//zum rendern
var canvas = document.getElementById("renderCanvas");


//Funktion, die dafür sorgt, dass Babylon,js die Szene kontinuierlich rendert/neu zeichnet
var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) { //nach jeden rendern -> check ob kamera aktiviert ist
            sceneToRender.render();
        }
    });
}


var engine = null;
var scene = null;
var sceneToRender = null;


//Funktion, die ein neues Engine-Objekt erstellt
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true,
        {
            preserveDrawingBuffer: true, //speichern des Renderings
            stencil: true, //aktivieren des Stencil Buffers für komplexere Effekte
            disableWebGL2Support: false //WebGL2 aktivieren, wenn möglich
        });
};


//Funktion, die die Szene erstellt
const createScene = async function () {
    //neue Szene in Babylon.js erstellen, in der alle Objekte und Lichteffekte platziert werden
    const scene = new BABYLON.Scene(engine);


    //FREE-Camera erstellen -> damit ich sich frei bewegen kann
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);
    camera.setTarget(BABYLON.Vector3.Zero()); //richtet die Kamera auf den Ursprung (0,0,0) aus
    camera.attachControl(canvas, true); //ermöglicht die Steuerung der Kamera mit der Maus und Tastatur


// *** LICHT HIER HINZUFÜGEN ***
    // HemisphericLight erstellen (ambientes Licht)
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1000, 5), scene);
    light.intensity = 1; // Helligkeit anpassen


    //Prüft, ob AR unterstützt wird
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');


    //GUI erstellen -> über die die Szene
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
        "FullscreenUI"
    );


    //Rechteck (Banner erstellen) -> in dem die Texte angezeigt werden
    const rectangle = new BABYLON.GUI.Rectangle("rect");
    rectangle.background = "black";
    rectangle.color = "blue";
    rectangle.width = "80%";
    rectangle.height = "50%";
    advancedTexture.addControl(rectangle); //wird hinzugefügt, damit es auf dem Bildschirm angezeigt wird


    //Panel erstellen -> in dem die Texte angezeigt werden
    const nonXRPanel = new BABYLON.GUI.StackPanel();
    rectangle.addControl(nonXRPanel);


    //Texteigenschaften (Schrift und Farbe) festlegen
    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica";
    text1.textWrapping = true;
    text1.color = "white";
    text1.fontSize = "14px";
    text1.height = "400px"
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";


    //Falls AR nicht unterstützt wird, wird eine Fehlermeldung angezeigt
    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please make sure you use a supported device such as a Meta Quest 3 or a modern Android device and a supported browser like Chrome.\n \n Make sure you have Google AR services installed and that you enabled the WebXR incubation flag under chrome://flags";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: AR Portal.\n \n Please enter AR with the button on the lower right corner to start. Once in AR, look at the floor for a few seconds (and move a little): the hit-testing ring will appear. Then click anywhere on the screen...";
        nonXRPanel.addControl(text1);
    }


    //AR-Experience mit WebXR einrichten
    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar", //AR als Umgebung verwendet
            referenceSpaceType: "local-floor", //virtuelle Welt relativ zum Boden verhält
            onError: (error) => {
                alert(error);
            }
        },
        optionalFeatures: true
    });


    //Hit-Test-Feature  für die Portal-Platzierung aktivieren
    //-> aktiviert Hit-Test-Feature, um die Position des Portals zu bestimmen
    const fm = xr.baseExperience.featuresManager;
    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrCamera = xr.baseExperience.camera


    //glow effekt hinzufügen für das Portal
    const gl = new BABYLON.GlowLayer("glow", scene, {
        mainTextureSamples: 4,
        mainTextureFixedSize: 256,
        blurKernelSize: 100
    });


    //neon Material für den Ring vom Hittest erstellen
    const neonMaterial = new BABYLON.StandardMaterial("neonMaterial", scene);
    neonMaterial.emissiveColor = new BABYLON.Color3(0.35, 0.96, 0.88)


    //Ring (Marker) als visuelle Markierung für den Hittest
    const marker = BABYLON.MeshBuilder.CreateTorus('marker', {diameter: 0.15, thickness: 0.05, tessellation: 32});
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
    gl.addIncludedOnlyMesh(marker);
    marker.material = neonMaterial;


    //aktulisiert die Position des Markers, wenn ein flache Oberfläche erkannt wird
    let hitTest;
    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            marker.isVisible = true; //Marker wird angezeigt, wenn eine flache Oberfläche erkannt wird
            hitTest = results[0]; //Ergebnisse des Hittests werden in hitTest gespeichert
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false; //Marker wird ausgeblendet, wenn keine flache Oberfläche erkannt wird
            hitTest = undefined;
        }
    });


    //Wurzel-Transformationsknoten für die Objekte der Szene erstellen
    //-> um die Objekte in der Szene zu gruppieren und zu bewegen
    //enthält occluder (unsichtbare Objekte zur Tiefenmaskierung)
    const rootOccluder = new BABYLON.TransformNode("rootOccluder", scene);
    rootOccluder.rotationQuaternion = new BABYLON.Quaternion();


    //enthhält virtuelle Szene (Hill Valley)
    const rootScene = new BABYLON.TransformNode("rootScene", scene);
    rootScene.rotationQuaternion = new BABYLON.Quaternion();


    //enthält Portal
    const rootPilar = new BABYLON.TransformNode("rootPilar", scene);
    rootPilar.rotationQuaternion = new BABYLON.Quaternion();


    //Haupt-Occluder erstellen -> verdeckt 3D-Szene wenn man in der realen Welt ist
    const oclVisibility = 0.001; //fast unsichtbar
    //sehr großes dünnes Rechteck -> Basis für das Occlusion Material
    const ground = BABYLON.MeshBuilder.CreateBox("ground", {width: 500, depth: 500, height: 0.001}, scene);
    //kleines Rechteck -> der aus ground abgeschnitten wird um Portal zu erzeugen
    const hole = BABYLON.MeshBuilder.CreateBox("hole", {size: 2, width: 1, height: 0.01}, scene);


    //CSG (Constructive Solid Geometry) -> um die beiden Meshes zu subtrahieren
    const groundCSG = BABYLON.CSG.FromMesh(ground);
    const holeCSG = BABYLON.CSG.FromMesh(hole);
    const booleanCSG = groundCSG.subtract(holeCSG);
    const booleanRCSG = holeCSG.subtract(groundCSG);


    //Haupt-Occluder erstellen -> für realen Raum -> blockiert 3D-Szene
    const occluder = booleanCSG.toMesh("occluder", null, scene);
    //umgekehrter Occluder -> für virtuelle Welt -> blockiert realen Raum
    const occluderR = booleanRCSG.toMesh("occluderR", null, scene);


    //Erstellt Occluder box um die 3D-Szene um den Benutzer zu verstecken, wenn er in der realen Welt ist
    const occluderFloor = BABYLON.MeshBuilder.CreateBox("ground", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderTop = BABYLON.MeshBuilder.CreateBox("occluderTop", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderRight = BABYLON.MeshBuilder.CreateBox("occluderRight", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderLeft = BABYLON.MeshBuilder.CreateBox("occluderLeft", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderback = BABYLON.MeshBuilder.CreateBox("occluderback", {width: 7, depth: 7, height: 0.001}, scene);
    const occluderMaterial = new BABYLON.StandardMaterial("om", scene);


    //Material den Occluder zuweiseen
    occluderMaterial.disableLighting = true; // We don't need anything but the position information
    occluderMaterial.forceDepthWrite = true; //Ensure depth information is written to the buffer so meshes further away will not be drawn
    occluder.material = occluderMaterial;
    occluderR.material = occluderMaterial;
    occluderFloor.material = occluderMaterial;
    occluderTop.material = occluderMaterial;
    occluderRight.material = occluderMaterial;
    occluderLeft.material = occluderMaterial;
    occluderback.material = occluderMaterial;


    //ursprüngliche Meshes/Objekte löschen
    ground.dispose();
    hole.dispose();


    //Virtuelle Welt laden -> Hill Valley
    engine.displayLoadingUI(); //Display the loading screen as the scene takes a few seconds to load
    const virtualWorldResult = await BABYLON.SceneLoader.ImportMeshAsync("", "./",
        "try12.glb", scene);
    engine.hideLoadingUI(); //Hide Loadingscreen once the scene is loaded
    for (let child of virtualWorldResult.meshes) {
        child.renderingGroupId = 1;
        child.parent = rootScene;
    }


    //Rendering-Gruppen für die Occluder setzen (sie müssen vor der Szene gezeichnet werden)
    occluder.renderingGroupId = 0;
    occluder.renderingGroupId = 0;
    occluderR.renderingGroupId = 0;
    occluderFloor.renderingGroupId = 0;
    occluderTop.renderingGroupId = 0;
    occluderRight.renderingGroupId = 0;
    occluderLeft.renderingGroupId = 0;
    occluderback.renderingGroupId = 0;


    //Occluder in die Transformationshierarchie einfügen
    occluder.parent = rootOccluder;
    occluderR.parent = rootOccluder;
    occluderFloor.parent = rootOccluder;
    occluderTop.parent = rootOccluder;
    occluderRight.parent = rootOccluder;
    occluderLeft.parent = rootOccluder;
    occluderback.parent = rootOccluder;


    //Occluder sind standardmäßig unsicherbar
    occluder.isVisible = true;
    occluderR.isVisible = false;
    occluderFloor.isVisible = true;
    occluderTop.isVisible = true;
    occluderRight.isVisible = true;
    occluderLeft.isVisible = true;
    occluderback.isVisible = true;


    //Sehr geringe Sichtbarkeit, damit sie für den Benutzer unsichtbar wirken
    occluder.visibility = oclVisibility;
    occluderR.visibility = oclVisibility;
    occluderFloor.visibility = oclVisibility;
    occluderTop.visibility = oclVisibility;
    occluderRight.visibility = oclVisibility;
    occluderLeft.visibility = oclVisibility;
    occluderback.visibility = oclVisibility;


    //Setzt das Auto-Clearing des Depth Stencils für die Rendering-Gruppen
    scene.setRenderingAutoClearDepthStencil(1, false, false, false); // Do not clean buffer info to ensure occlusion
    scene.setRenderingAutoClearDepthStencil(0, true, true, true); // Clean for 1rst frame
    scene.autoClear = true;


    //Virtuelle Welt und Occluder deaktivieren, bis das Portal erscheint
    rootScene.setEnabled(false);
    rootOccluder.setEnabled(false);


    //Variablen für die Portal-Platzierung und Aktivierung
    let portalAppearded = false;
    let portalPosition = new BABYLON.Vector3();


    //Portal wird hier erstellt und platziert
    scene.onPointerDown = (evt, pickInfo) => {


        if (hitTest && xr.baseExperience.state === BABYLON.WebXRState.IN_XR && !portalAppearded) {
            portalAppearded = true;


            //Virtuelle Welt und Occluder aktivieren ->
            rootScene.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
            rootScene.position.y = 0.05;

            rootScene.setEnabled(true);
            rootOccluder.setEnabled(true);



            //und an die Position des Hittests verschieben
            hitTest.transformationMatrix.decompose(undefined, undefined, portalPosition);
            rootOccluder.position = portalPosition;
            rootScene.position = portalPosition;


            //Szene anpassen
            //Move virtual scene 1 unit lower (this HillValley scene is at 1 above origin - and the grass at 1.2)
            rootScene.translate(BABYLON.Axis.Y, -1);
            //Positionate in front the car
            rootScene.translate(BABYLON.Axis.X, 29);
            rootScene.translate(BABYLON.Axis.Z, -11);




            //Align occluders
            rootOccluder.translate(BABYLON.Axis.Y, 3);
            rootOccluder.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
            rootOccluder.translate(BABYLON.Axis.Z, -2);
            occluderFloor.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
            occluderFloor.translate(BABYLON.Axis.Y, 1);
            occluderFloor.translate(BABYLON.Axis.Z, 3.5);
            occluderTop.rotationQuaternion = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(-1, 0, 0), Math.PI / 2);
            occluderTop.translate(BABYLON.Axis.Y, -2);
            occluderTop.translate(BABYLON.Axis.Z, 3.5);
            occluderback.translate(BABYLON.Axis.Y, 7);
            occluderback.translate(BABYLON.Axis.Z, 2);
            occluderRight.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
            occluderRight.translate(BABYLON.Axis.Y, -3.4);
            occluderRight.translate(BABYLON.Axis.X, 3.5);
            occluderLeft.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, Math.PI / 2);
            occluderLeft.translate(BABYLON.Axis.Y, 3.4);
            occluderLeft.translate(BABYLON.Axis.X, 3.5);


            //Rahmen vom Portal erstellen
            const pilar1 = BABYLON.MeshBuilder.CreateBox("pilar1", {height: 2, width: .1, depth: .1});
            const pilar2 = BABYLON.MeshBuilder.CreateBox("pilar2", {height: 2, width: .1, depth: .1});
            const pilar3 = BABYLON.MeshBuilder.CreateBox("pilar3", {height: 1.1, width: .1, depth: .1});


            //verschiebt die Pfeiler / Rahmen um das Portal zu formen
            pilar2.translate(BABYLON.Axis.X, 1, BABYLON.Space.LOCAL);
            pilar3.addRotation(0, 0, Math.PI / 2);
            pilar3.translate(BABYLON.Axis.Y, 1, BABYLON.Space.LOCAL);
            pilar3.translate(BABYLON.Axis.Y, -.5, BABYLON.Space.LOCAL);


            //Setzt die Pfeiler als Kinder des "rootPilar"-Knotens, um sie gemeinsam bewegen zu können
            pilar1.parent = rootPilar;
            pilar2.parent = rootPilar;
            pilar3.parent = rootPilar;


            //bewegt das gesamte Portal an die erkannte Position (hitTest)
            rootPilar.position = portalPosition;


            //Richtet das Portal korrekt an der Occluder-Geometrie aus
            rootPilar.translate(BABYLON.Axis.Y, 1);
            rootPilar.translate(BABYLON.Axis.X, -.5);
            rootPilar.translate(BABYLON.Axis.Z, .05);  //push it a bit in virtual world to have it rendered in realworld


            // Fügt ein leuchtendes Neonmaterial für das Portal hinzu
            gl.addIncludedOnlyMesh(pilar1);
            gl.addIncludedOnlyMesh(pilar2);
            gl.addIncludedOnlyMesh(pilar3);
            pilar1.material = neonMaterial;
            pilar2.material = neonMaterial;
            pilar3.material = neonMaterial;


            //Fügt Partikeleffekte zum Portal hinzu
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
    }


    //GUI wird in AR Modus ausgeblendet
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        rectangle.isVisible = false;
    })


    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        rectangle.isVisible = true;


    })


    //HauptRendering LOop
    scene.onBeforeRenderObservable.add(() => {


        marker.isVisible = !portalAppearded; //Marker bleibt sichtbar, bis das Portal erscheint


        if ((xrCamera !== undefined) && (portalPosition !== undefined)) {


            if (xrCamera.position.z > portalPosition.z) {
                //Spieler befindet sich in der virtuellen Welt (hinter dem Portal)
                isInRealWorld = false;
                occluder.isVisible = false;
                occluderR.isVisible = true;
                occluderFloor.isVisible = false;
                occluderTop.isVisible = false;
                occluderRight.isVisible = false;
                occluderLeft.isVisible = false;
                occluderback.isVisible = false;


            } else {
                //Spieler befindet sich in der echten Welt (vor dem Portal)
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


window.initFunction = async function () {


    var asyncEngineCreation = async function () {
        try {
            return createDefaultEngine();
        } catch (e) {
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
    window.scene = createScene();
};
initFunction().then(() => {
    scene.then(returnedScene => {
        sceneToRender = returnedScene;
    });


});


// Resize
window.addEventListener("resize", function () {
    engine.resize();
});





