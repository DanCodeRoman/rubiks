import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import TWEEN from 'three/addons/libs/tween.module.min.js';

// --- Configuration ---
const CUBE_COLORS = {
    FRONT: 0xFF0000, // Red
    BACK: 0xFFA500,  // Orange
    UP: 0xFFFFFF,    // White
    DOWN: 0xFFFF00,  // Yellow
    LEFT: 0x0000FF,  // Blue
    RIGHT: 0x008000, // Green
    INNER: 0x1A1A1A   // Dark gray for inner faces
};
const ANIMATION_DURATION = 300; // ms
const PIECE_GAP = 0.05; // Gap between pieces

// --- Global Variables ---
let scene, camera, renderer, controls;
let cubeGroup; // Group containing all cubies
let cubies = []; // Array to hold individual cubie meshes
let currentSize = 3;
let isAnimating = false;

// --- DOM Elements ---
const container = document.getElementById('container');
const sizeInput = document.getElementById('cubeSize');
const scrambleBtn = document.getElementById('scrambleBtn');
const solveBtn = document.getElementById('solveBtn');

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    camera.position.y = 4;
    camera.position.x = 4;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Controls (Mouse Rotation)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth rotation
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false; // Keep panning relative to world origin
    controls.minDistance = 3;
    controls.maxDistance = 20;

    // Cube
    createCube(currentSize);

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    sizeInput.addEventListener('change', handleSizeChange);
    scrambleBtn.addEventListener('click', scrambleCube);
    solveBtn.addEventListener('click', solveCube); // Will reset the cube

    // Start Animation Loop
    animate();
}

// --- Cube Creation ---
function createCube(N) {
    if (cubeGroup) {
        scene.remove(cubeGroup); // Remove old cube if exists
    }
    cubeGroup = new THREE.Group();
    cubies = [];
    currentSize = N;

    const pieceSize = 1.0;
    const totalSize = N * pieceSize + (N - 1) * PIECE_GAP;
    const offset = (totalSize - pieceSize) / 2; // Offset to center the cube

    const geometry = new THREE.BoxGeometry(pieceSize, pieceSize, pieceSize);

    for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
            for (let z = 0; z < N; z++) {
                // Skip inner pieces for N > 2 (optimization, though coloring handles visibility)
                if (N > 2 && x > 0 && x < N - 1 && y > 0 && y < N - 1 && z > 0 && z < N - 1) {
                    continue;
                }

                const materials = [
                    // Right (+X) Green
                    new THREE.MeshStandardMaterial({ color: (x === N - 1) ? CUBE_COLORS.RIGHT : CUBE_COLORS.INNER, roughness: 0.3, metalness: 0.1 }),
                    // Left (-X) Blue
                    new THREE.MeshStandardMaterial({ color: (x === 0) ? CUBE_COLORS.LEFT : CUBE_COLORS.INNER, roughness: 0.3, metalness: 0.1 }),
                    // Top (+Y) White
                    new THREE.MeshStandardMaterial({ color: (y === N - 1) ? CUBE_COLORS.UP : CUBE_COLORS.INNER, roughness: 0.3, metalness: 0.1 }),
                    // Bottom (-Y) Yellow
                    new THREE.MeshStandardMaterial({ color: (y === 0) ? CUBE_COLORS.DOWN : CUBE_COLORS.INNER, roughness: 0.3, metalness: 0.1 }),
                    // Front (+Z) Red
                    new THREE.MeshStandardMaterial({ color: (z === N - 1) ? CUBE_COLORS.FRONT : CUBE_COLORS.INNER, roughness: 0.3, metalness: 0.1 }),
                    // Back (-Z) Orange
                    new THREE.MeshStandardMaterial({ color: (z === 0) ? CUBE_COLORS.BACK : CUBE_COLORS.INNER, roughness: 0.3, metalness: 0.1 }),
                ];

                const cubie = new THREE.Mesh(geometry, materials);

                cubie.position.set(
                    (x * (pieceSize + PIECE_GAP)) - offset,
                    (y * (pieceSize + PIECE_GAP)) - offset,
                    (z * (pieceSize + PIECE_GAP)) - offset
                );

                // Store original position for reference (useful for slice selection)
                cubie.userData.originalPos = cubie.position.clone();
                cubie.userData.currentLogicPos = { x, y, z }; // Track logical position if needed

                cubeGroup.add(cubie);
                cubies.push(cubie);
            }
        }
    }
    scene.add(cubeGroup);
    // Adjust camera distance based on cube size
    const diagonal = Math.sqrt(3 * Math.pow(totalSize, 2));
    controls.minDistance = diagonal * 0.8;
    controls.maxDistance = diagonal * 3;
    camera.position.z = diagonal * 1.2;
    camera.position.y = diagonal * 1.0;
    camera.position.x = diagonal * 1.0;
    controls.update();
}


// --- Cube Operations ---

// Select cubies belonging to a specific slice
function getSlice(axis, layerIndex, N) {
    const slice = [];
    const tolerance = 0.1; // Tolerance for floating point comparisons
    const pieceSizeWithGap = 1.0 + PIECE_GAP;
    const totalSize = N + (N - 1) * PIECE_GAP;
    const offset = (totalSize - 1.0) / 2;
    const targetCoord = (layerIndex * pieceSizeWithGap) - offset;

    cubies.forEach(cubie => {
        let coord;
        // Need to check against the *world* position relative to the cube group's center
        const worldPos = cubie.getWorldPosition(new THREE.Vector3());
        const localPos = cubeGroup.worldToLocal(worldPos); // Position relative to cube group's origin

        switch (axis) {
            case 'x': coord = localPos.x; break;
            case 'y': coord = localPos.y; break;
            case 'z': coord = localPos.z; break;
        }

        if (Math.abs(coord - targetCoord) < tolerance) {
            slice.push(cubie);
        }
    });
    return slice;
}


// Animate a slice rotation
function rotateSlice(axis, layerIndex, direction, N, onComplete) {
    if (isAnimating) return;
    isAnimating = true;

    const sliceCubies = getSlice(axis, layerIndex, N);
    if (sliceCubies.length === 0) {
         console.warn(`No cubies found for slice ${axis}, layer ${layerIndex}`);
         isAnimating = false;
         if (onComplete) onComplete();
         return;
     }


    const pivot = new THREE.Group(); // Create a temporary pivot
    scene.add(pivot); // Add pivot to the scene temporarily

    // Position pivot at the center of the cube group
    pivot.position.copy(cubeGroup.position);
    pivot.rotation.copy(cubeGroup.rotation);
    pivot.scale.copy(cubeGroup.scale);

    // Move slice cubies from main group to pivot group
    sliceCubies.forEach(cubie => {
        // Convert world position to be relative to the new pivot
        pivot.attach(cubie); // Automatically handles position/rotation adjustments
    });

    const angle = (Math.PI / 2) * direction; // 90 degrees clockwise or counter-clockwise
    const targetRotation = {};
    targetRotation[axis] = pivot.rotation[axis] + angle;

    new TWEEN.Tween(pivot.rotation)
        .to(targetRotation, ANIMATION_DURATION)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onComplete(() => {
            // After animation, move cubies back to the main cube group
            // Apply the pivot's rotation to the cubies permanently
            sliceCubies.forEach(cubie => {
                cubeGroup.attach(cubie); // Move back to main group
            });

            scene.remove(pivot); // Remove the temporary pivot
            isAnimating = false;
            if (onComplete) {
                onComplete();
            }
        })
        .start();
}

// Scramble the cube
function scrambleCube() {
    if (isAnimating) return;

    const N = currentSize;
    const numMoves = N * N * 3; // More moves for bigger cubes
    const axes = ['x', 'y', 'z'];
    let moves = [];

    for (let i = 0; i < numMoves; i++) {
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const layerIndex = Math.floor(Math.random() * N);
        const direction = Math.random() < 0.5 ? 1 : -1; // 1 for clockwise, -1 for counter-clockwise
        moves.push({ axis, layerIndex, direction });
    }

    let currentMove = 0;
    function nextMove() {
        if (currentMove < moves.length) {
            const move = moves[currentMove];
            rotateSlice(move.axis, move.layerIndex, move.direction, N, () => {
                currentMove++;
                // Add a small delay between moves if desired
                 //setTimeout(nextMove, 50);
                 nextMove(); // Do next move immediately after previous finishes
            });
        } else {
            console.log("Scramble complete");
        }
    }

    nextMove();
}

// Solve the cube (reset to initial state)
function solveCube() {
    if (isAnimating) return;
    console.log("Solving (Resetting) Cube...");
    createCube(currentSize); // Easiest way to reset
}

// --- Event Handlers ---
function handleSizeChange() {
     if (isAnimating) {
         sizeInput.value = currentSize; // Reset input if animating
         return;
     }
     let newSize = parseInt(sizeInput.value);
     newSize = Math.max(2, Math.min(10, newSize)); // Clamp between 2 and 10
     sizeInput.value = newSize; // Update input field in case it was clamped

     if (newSize !== currentSize) {
         createCube(newSize);
     }
 }

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop ---
function animate(time) {
    requestAnimationFrame(animate);
    controls.update(); // Required if damping enabled
    TWEEN.update(time); // Update animations
    renderer.render(scene, camera);
}

// --- Start ---
init();
