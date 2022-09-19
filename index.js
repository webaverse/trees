import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
// import physicsManager from '../physics-manager';
const {useApp, useCamera, useFrame, usePhysics, useSpriting} = metaversefile;

// const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

//

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localEuler = new THREE.Euler();
const localMatrix = new THREE.Matrix4();

//

function mod(a, n) {
  return ((a % n) + n) % n;
}

//

const urls = [
  `Tree_1_1.glb`,
  `Tree_1_2.glb`,
  `Tree_2_1.glb`,
  `Tree_2_2.glb`,
  `Tree_3_1.glb`,
  `Tree_3_2.glb`,
  `Tree_4_1.glb`,
  `Tree_4_2.glb`,
  `Tree_4_3.glb`,
  `Tree_5_1.glb`,
  `Tree_5_2.glb`,
  `Tree_6_1.glb`,
  `Tree_6_2.glb`,
].map(u => {
  return `../procgen-assets/vegetation/garden-trees/${u}`;
});

//

export default e => {
  const app = useApp();
  const camera = useCamera();
  const physics = usePhysics();
  const spriting = useSpriting();
  const {SpritesheetMesh} = spriting;

  app.name = 'trees';

  let frameCb = null;
  // let live = true;
  // let reactApp = null;
  // let physicsIds = [];
  e.waitUntil((async () => {
    // const u = `../procgen-assets/vegetation/garden-trees/garden-trees.glb`;
    // const u = `../procgen-assets/vegetation/garden-trees/garden-trees_compressed.glb`;

    await Promise.all(urls.slice(0, 1).map(async (u, index) => {
      const meshSize = 3;
      const _loadFullModel = async () => {
        const mesh = await metaversefile.createAppAsync({
          start_url: u,
        });
        mesh.position.y = 0.5;
        mesh.position.x = (-urls.length / 2 + index) * meshSize;
        mesh.scale.multiplyScalar(2);

        app.add(mesh);
        mesh.updateMatrixWorld();
        
        return mesh;
      };
      const _loadOptimizedModel = async mesh => {
        let treeMesh = null;
        mesh.traverse(o => {
          if (treeMesh === null && o.isMesh) {
            treeMesh = o;
          }
        });

        const targetRatio = 0.2;
        const targetError = 0.1;
        const treeMesh2 = await physics.meshoptSimplify(treeMesh, targetRatio, targetError);
        
        treeMesh2.position.y = 0.5;
        treeMesh2.position.x = (-urls.length / 2 + index) * meshSize;
        treeMesh2.position.z += meshSize;
        treeMesh2.scale.multiplyScalar(2);

        app.add(treeMesh2);
        treeMesh2.updateMatrixWorld();
        
        return treeMesh2;
      };
      const _loadSpritesheet = async () => {
        const spritesheet = await spriting.createAppUrlSpriteSheet(u, {
          // size: 2048,
          // numFrames: 8,
        });
        const {
          result,
          numFrames,
          frameSize,
          numFramesPerRow,
          worldWidth,
          worldHeight,
          worldOffset,
        } = spritesheet;

        // console.log('got spritesheet', spritesheet);

        /* const canvas = document.createElement('canvas');
        canvas.width = result.width;
        canvas.height = result.height;
        canvas.style.cssText = `\
          position: fixed;
          top: 0;
          left: 0;
          width: 512px;
          height: 512px;
        `;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(result, 0, 0);
        document.body.appendChild(canvas); */

        const texture = new THREE.Texture(result);
        texture.needsUpdate = true;
        const numAngles = numFrames;
        const numSlots = numFramesPerRow;
        const worldSize = Math.max(worldWidth, worldHeight);
        const spritesheetMesh = new SpritesheetMesh({
          texture,
          worldSize,
          worldOffset,
          numAngles,
          numSlots,
        });
        spritesheetMesh.position.y = 0.5;
        spritesheetMesh.position.x = (-urls.length / 2 + index) * meshSize;
        spritesheetMesh.position.z += meshSize * 2;
        spritesheetMesh.scale.multiplyScalar(2);
        app.add(spritesheetMesh);
        spritesheetMesh.updateMatrixWorld();

        // animate
        frameCb = () => {
          localQuaternion.setFromRotationMatrix(
            localMatrix.lookAt(
              spritesheetMesh.getWorldPosition(localVector),
              camera.position,
              localVector2.set(0, 1, 0)
            )
          );
          localEuler.setFromQuaternion(localQuaternion, 'YXZ');
          localEuler.x = 0;
          localEuler.z = 0;
          spritesheetMesh.quaternion.setFromEuler(localEuler);
          spritesheetMesh.updateMatrixWorld();
    
          const {material} = spritesheetMesh;
          material.uniforms.uY.value =
            mod(-localEuler.y + Math.PI/2 + (Math.PI * 2) / numAngles / 2, Math.PI * 2) / (Math.PI * 2);
          material.uniforms.uY.needsUpdate = true;
        };
      };

      await Promise.all([
        _loadFullModel().then(mesh => {
          return _loadOptimizedModel(mesh);
        }),
        _loadSpritesheet(),
      ]);
    }));
  })());

  useFrame(() => {
    frameCb && frameCb();
  });

  return app;
};