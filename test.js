window.addEventListener("DOMContentLoaded", async function () {
    var canvas = document.getElementById("renderCanvas");
    var engine = new BABYLON.Engine(canvas, true);

    var createScene = async function () {
        var scene = new BABYLON.Scene(engine);
        var camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 2, 12, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);

        var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        var xr = await scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: "immersive-ar",
                referenceSpaceType: "local-floor"
            },
            optionalFeatures: ["plane-detection", "world-tracking"]
        });

        const fm = xr.baseExperience.featuresManager;
        const xrPlanes = fm.enableFeature(BABYLON.WebXRPlaneDetector.Name, "latest");

        if (!xrPlanes) {
            console.warn("WebXR Plane Detection ist nicht verfügbar.");
            return scene;
        }

        const planes = [];

        xrPlanes.onPlaneAddedObservable.add(plane => {
            plane.polygonDefinition.push(plane.polygonDefinition[0]);
            var polygon_triangulation = new BABYLON.PolygonMeshBuilder("plane", plane.polygonDefinition.map((p) => new BABYLON.Vector2(p.x, p.z)), scene);
            var polygon = polygon_triangulation.build(false, 0.01);
            plane.mesh = polygon;
            planes[plane.id] = plane.mesh;

            const mat = new BABYLON.StandardMaterial("mat", scene);
            mat.alpha = 0.5;
            mat.diffuseColor = BABYLON.Color3.Random();
            polygon.createNormals();
            plane.mesh.material = mat;

            plane.mesh.rotationQuaternion = new BABYLON.Quaternion();
            plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
        });

        xrPlanes.onPlaneUpdatedObservable.add(plane => {
            if (plane.mesh) {
                let mat = plane.mesh.material;
                plane.mesh.dispose(false, false);
                plane.polygonDefinition.push(plane.polygonDefinition[0]);
                var polygon_triangulation = new BABYLON.PolygonMeshBuilder("plane", plane.polygonDefinition.map((p) => new BABYLON.Vector2(p.x, p.z)), scene);
                var polygon = polygon_triangulation.build(false, 0.01);
                polygon.createNormals();
                plane.mesh = polygon;
                planes[plane.id] = plane.mesh;
                plane.mesh.material = mat;
                plane.mesh.rotationQuaternion = new BABYLON.Quaternion();
                plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
            }
        });

        xrPlanes.onPlaneRemovedObservable.add(plane => {
            if (plane && planes[plane.id]) {
                planes[plane.id].dispose();
                delete planes[plane.id];
            }
        });

        xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
            planes.forEach(plane => plane.dispose());
            planes.length = 0;
        });

        return scene;
    };

    createScene().then(scene => {
        engine.runRenderLoop(() => {
            scene.render();
        });
    });

    window.addEventListener("resize", function () {
        engine.resize();
    });
});
