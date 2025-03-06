var camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(8, 3, 0), scene);
camera.setTarget(BABYLON.Vector3.Zero());
camera.attachControl(canvas, true);
/*scene.createDefaultXRExperienceAsync({}).then((defaultXRExperience) => {
    // Make sure hardware is OK for XR context
})*/
;
/**
 * WebXR Plane detection demo using Babylon JS
 *
 * This demo shows on to use Babylon's plane detection module to show polygons defined by the ar system.
 *
 * Anchors will be added when a room is being scanned and will persist color between updates.
 *
 * Created by Raanan Weber (@RaananW)
 */
var createScene = async function () {
    var scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 2, 12, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    var xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor"
        },
        optionalFeatures: true
    });

    const fm = xr.baseExperience.featuresManager;

    const xrPlanes = fm.enableFeature(BABYLON.WebXRPlaneDetector.Name, "latest");

    const planes = [];

    xrPlanes.onPlaneAddedObservable.add(plane => {
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new BABYLON.PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new BABYLON.Vector2(p.x, p.z)), scene);
        var polygon = polygon_triangulation.build(false, 0.01);
        plane.mesh = polygon;
        planes[plane.id] = (plane.mesh);
        const mat = new BABYLON.StandardMaterial("mat", scene);
        mat.alpha = 0.5;
        // pick a random color
        mat.diffuseColor = BABYLON.Color3.Random();
        polygon.createNormals();
        plane.mesh.material = mat;

        plane.mesh.rotationQuaternion = new BABYLON.Quaternion();
        plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
    });

    xrPlanes.onPlaneUpdatedObservable.add(plane => {
        let mat;
        if (plane.mesh) {
            // keep the material, dispose the old polygon
            mat = plane.mesh.material;
            plane.mesh.dispose(false, false);
        }
        const some = plane.polygonDefinition.some(p => !p);
        if (some) {
            return;
        }
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new BABYLON.PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new BABYLON.Vector2(p.x, p.z)), scene);
        var polygon = polygon_triangulation.build(false, 0.01);
        polygon.createNormals();
        plane.mesh = polygon;
        planes[plane.id] = (plane.mesh);
        plane.mesh.material = mat;
        plane.mesh.rotationQuaternion = new BABYLON.Quaternion();
        plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
    })

    xrPlanes.onPlaneRemovedObservable.add(plane => {
        if (plane && planes[plane.id]) {
            planes[plane.id].dispose()
        }
    })

    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        planes.forEach(plane => plane.dispose());
        while (planes.pop()) {
        }
        ;
    });


    return scene;
};