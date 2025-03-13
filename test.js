import * as THREE from 'three';
import { ARButton } from 'https://cdn.jsdelivr.net/npm/three@0.136/examples/jsm/webxr/ARButton.js';

let camera, scene, renderer, controller;
let hitTestSource = null;
let hitTestSourceRequested = false;
let reticle;

function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // AR-Button erstellen und in den Container einfügen
    const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test', 'plane-detection']
    });

    // AR-Button zu 'ar-button-container' hinzufügen
    document.getElementById('ar-button-container').appendChild(arButton);

    // Einfaches Licht hinzufügen
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2);
    scene.add(light);

    // Reticle zur Visualisierung der Hit-Test-Ergebnisse
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Controller aus der AR-Session holen und Eventlistener hinzufügen
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Fenstergrößenanpassung behandeln
    window.addEventListener('resize', onWindowResize, false);

    renderer.setAnimationLoop(render);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onSelect() {
    if (reticle.visible) {
        // Hier kann später der Code ergänzt werden, um ein Objekt an der Reticle-Position zu platzieren
        console.log("Object placed at reticle position");
    }
}

function requestHitTestSource(session) {
    session.requestReferenceSpace('viewer').then(referenceSpace => {
        session.requestHitTestSource({ space: referenceSpace }).then(source => {
            hitTestSource = source;
        }).catch(err => {
            console.error('Error requesting hit test source: ', err);
        });
    }).catch(err => {
        console.error('Error requesting reference space: ', err);
    });

    session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
    });
    hitTestSourceRequested = true;
}

function render(timestamp, frame) {
    if (frame) {
        const session = renderer.xr.getSession();
        if (!hitTestSourceRequested) {
            requestHitTestSource(session);
        }
        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length) {
                const referenceSpace = renderer.xr.getReferenceSpace();
                const pose = hitTestResults[0].getPose(referenceSpace);
                if (pose) {
                    reticle.visible = true;
                    reticle.matrix.fromArray(pose.transform.matrix);
                } else {
                    reticle.visible = false;
                }
            } else {
                reticle.visible = false;
            }
        }
    }
    renderer.render(scene, camera);
}

window.addEventListener('load', init);