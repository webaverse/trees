import * as THREE from 'three';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
import physicsManager from '../physics-manager';
const {useApp, useFrame, useActivate, useLoaders, usePhysics, addTrackedApp, useDropManager, useDefaultModules, useCleanup} = metaversefile;

// const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

export default e => {
  const app = useApp();
  const physics = usePhysics();
  // const dropManager = useDropManager();

  app.name = 'trees';

  /* let activateCb = null;
  let frameCb = null;
  useActivate(() => {
    activateCb && activateCb();
  });
  useFrame(() => {
    frameCb && frameCb();
  }); */

  // let live = true;
  // let reactApp = null;
  // let physicsIds = [];
  e.waitUntil((async () => {
    const u = `../procgen-assets/vegetation/garden-trees/garden-trees.glb`;
    // const u = `../procgen-assets/vegetation/garden-trees/garden-trees_compressed.glb`;
    let o = await new Promise((accept, reject) => {
      const {gltfLoader} = useLoaders();
      gltfLoader.load(u, accept, function onprogress() {}, reject);
    });
    o = o.scene;

    const meshes = [];
    o.traverse(o => {
      if (o.isMesh) {
        meshes.push(o);
      }
    });
    const meshSize = 3;
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      mesh.position.x = (-meshes.length / 2 + i) * meshSize;
      app.add(mesh);
      mesh.updateMatrixWorld();
    }

    (async () => {
      const treeMesh = meshes[0];
      const targetRatio = 0.2;
      const targetError = 0.1;
      const treeMesh2 = await physics.meshoptSimplifySloppy(treeMesh, targetRatio, targetError);
      treeMesh2.position.z += meshSize;
      app.add(treeMesh2);
      treeMesh2.updateMatrixWorld();
    })();

    /* if (!live) {
      o.destroy();
      return;
    }
    const {animations} = o;
    o = o.scene;
    app.add(o); */

    //

    /* const dropObject = new THREE.Object3D();
    dropObject.position.y = 0.5;
    app.add(dropObject); */

    // app.updateMatrixWorld();

    /* let baseMesh = null;
    o.traverse(o => {
      if (!baseMesh && o.isMesh && /base_container/i.test(o.name)) {
        baseMesh = o;
      }
    }); */
    // const physicsId = physics.addGeometry(o);
    // physicsIds.push(physicsId);
  })());
  
  /* useCleanup(() => {
    live = false;
  }); */

  return app;
};