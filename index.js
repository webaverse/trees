import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useCamera, useFrame, usePhysics, useAtlasing, useGeometryBatching, useSpriting} = metaversefile;
const {createTextureAtlas} = useAtlasing();
const {InstancedBatchedMesh, InstancedGeometryAllocator} = useGeometryBatching();

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

const urlSpecs = {
  trees: [
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
  }),
  ores: [
    `BlueOre_deposit_low.glb`,
    `Iron_Deposit_low.glb`,
    `Ore_Blue_low.glb`,
    `Ore_BrownRock_low.glb`,
    `Ore_Deposit_Red.glb`,
    `Ore_Red_low.glb`,
    `Ore_metal_low.glb`,
    `Ore_wood_low.glb`,
    `Rock_ore_Deposit_low.glb`,
    `TreeOre_low.glb`,
  ].map(u => {
    return `../procgen-assets/litter/ores/${u}`;
  }),
};
const litterUrls = urlSpecs.trees.slice(0, 1)
  .concat(urlSpecs.ores.slice(0, 1));

//

class LitterMetaMesh extends InstancedBatchedMesh {
  constructor({
    procGenInstance,
    lodMeshes = [],
    shapeAddresses = [],
    physicsGeometries = [],
    physics = null,
  } = {}) {
    // instancing
    const {
      atlasTextures,
      geometries: lod0Geometries,
    } = createTextureAtlas(lodMeshes.map(lods => lods[0]), {
      textures: ['map', 'normalMap'],
      attributes: ['position', 'normal', 'uv'],
    });
    // allocator

    const allocator = new InstancedGeometryAllocator(lod0Geometries, [
      {
        name: 'p',
        Type: Float32Array,
        itemSize: 3,
      },
      {
        name: 'q',
        Type: Float32Array,
        itemSize: 4,
      },
    ], {
      maxInstancesPerDrawCall,
      maxDrawCallsPerGeometry,
      boundingType: 'box',
    });
    const {geometry, textures: attributeTextures} = allocator;
    for (const k in attributeTextures) {
      const texture = attributeTextures[k];
      texture.anisotropy = maxAnisotropy;
    }

    // material

    const material = new THREE.MeshStandardMaterial({
      map: atlasTextures.map,
      normalMap: atlasTextures.normalMap,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.5,
      onBeforeCompile: (shader) => {
        shader.uniforms.pTexture = {
          value: attributeTextures.p,
          needsUpdate: true,
        };
        shader.uniforms.qTexture = {
          value: attributeTextures.q,
          needsUpdate: true,
        };
        
        // vertex shader

        shader.vertexShader = shader.vertexShader.replace(`#include <uv_pars_vertex>`, `\
#undef USE_INSTANCING

#include <uv_pars_vertex>

uniform sampler2D pTexture;
uniform sampler2D qTexture;

vec3 rotate_vertex_position(vec3 position, vec4 q) { 
  return position + 2.0 * cross(q.xyz, cross(q.xyz, position) + q.w * position);
}
        `);
        shader.vertexShader = shader.vertexShader.replace(`#include <begin_vertex>`, `\
#include <begin_vertex>

int instanceIndex = gl_DrawID * ${maxInstancesPerDrawCall} + gl_InstanceID;
const float width = ${attributeTextures.p.image.width.toFixed(8)};
const float height = ${attributeTextures.p.image.height.toFixed(8)};
float x = mod(float(instanceIndex), width);
float y = floor(float(instanceIndex) / width);
vec2 pUv = (vec2(x, y) + 0.5) / vec2(width, height);
vec3 p = texture2D(pTexture, pUv).xyz;
vec4 q = texture2D(qTexture, pUv).xyzw;

// instance offset
{
  transformed = rotate_vertex_position(transformed, q);
  transformed += p;
}
/* {
  transformed.y += float(gl_DrawID) * 10.;
  transformed.x += float(gl_InstanceID) * 10.;
} */
        `);
        shader.fragmentShader = shader.fragmentShader.replace(`#include <uv_pars_fragment>`, `\
#undef USE_INSTANCING

#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )
	varying vec2 vUv;
#endif
        `);

        // fragment shader
        
        return shader;
      },
    });

    // mesh

    super(geometry, material, allocator);
    this.frustumCulled = false;
    
    this.procGenInstance = procGenInstance;
    this.meshes = lodMeshes;
    this.shapeAddresses = shapeAddresses;
    this.physicsGeometries = physicsGeometries;
    this.physics = physics;
    this.physicsObjects = [];

    this.instanceObjects = new Map();
  }

  drawChunk(chunk, renderData, tracker){
    const {
      vegetationData,
    } = renderData;
    const localPhysicsObjects = [];
    const _renderVegetationGeometry = (drawCall, ps, qs, index) => {
      // geometry
      const pTexture = drawCall.getTexture('p');
      const pOffset = drawCall.getTextureOffset('p');
      const qTexture = drawCall.getTexture('q');
      const qOffset = drawCall.getTextureOffset('q');

      const px = ps[index * 3];
      const py = ps[index * 3 + 1];
      const pz = ps[index * 3 + 2];
      pTexture.image.data[pOffset] = px;
      pTexture.image.data[pOffset + 1] = py;
      pTexture.image.data[pOffset + 2] = pz;

      const qx = qs[index * 4];
      const qy = qs[index * 4 + 1];
      const qz = qs[index * 4 + 2];
      const qw = qs[index * 4 + 3];
      qTexture.image.data[qOffset] = qx;
      qTexture.image.data[qOffset + 1] = qy;
      qTexture.image.data[qOffset + 2] = qz;
      qTexture.image.data[qOffset + 3] = qw;

      drawCall.updateTexture('p', pOffset, ps.length);
      drawCall.updateTexture('q', qOffset, qs.length);

      // physics
      const shapeAddress = this.#getShapeAddress(drawCall.geometryIndex);
      const physicsObject = this.#addPhysicsShape(shapeAddress, drawCall.geometryIndex, px, py, pz, qx, qy, qz, qw);
      this.physicsObjects.push(physicsObject);
      localPhysicsObjects.push(physicsObject);

      drawCall.incrementInstanceCount();
      
      this.instanceObjects.set(physicsObject.physicsId, drawCall);
      
    };

      
    const drawcalls = [];
    for (let i = 0; i < vegetationData.instances.length; i++) {
      const geometryNoise = vegetationData.instances[i];
      const geometryIndex = Math.floor(geometryNoise * this.meshes.length);
      
      localBox.setFromCenterAndSize(
        localVector.set(
          (chunk.min.x + 0.5) * chunkWorldSize,
          (chunk.min.y + 0.5) * chunkWorldSize,
          (chunk.min.z + 0.5) * chunkWorldSize
        ),
        localVector2.set(chunkWorldSize, chunkWorldSize * 256, chunkWorldSize)
      );

      let drawCall = this.allocator.allocDrawCall(geometryIndex, localBox);
      drawcalls.push(drawCall);
      _renderVegetationGeometry(drawCall, vegetationData.ps, vegetationData.qs, i);
    }

    const onchunkremove = () => {
      drawcalls.forEach(drawcall => {
        this.allocator.freeDrawCall(drawcall);
      });
      tracker.offChunkRemove(chunk, onchunkremove);

      const firstLocalPhysicsObject = localPhysicsObjects[0];
      const firstLocalPhysicsObjectIndex = this.physicsObjects.indexOf(firstLocalPhysicsObject);
      this.physicsObjects.splice(firstLocalPhysicsObjectIndex, localPhysicsObjects.length);
    };
    tracker.onChunkRemove(chunk, onchunkremove);

  }
  
  #getShapeAddress(geometryIndex) {
    return this.shapeAddresses[geometryIndex];
  }
  #getShapeGeometry(geometryIndex){
    return this.physicsGeometries[geometryIndex];
  }
  
  #addPhysicsShape(shapeAddress, geometryIndex, px, py, pz, qx, qy, qz, qw) {    
    localVector.set(px, py, pz);
    localQuaternion.set(qx, qy, qz, qw);
    localVector2.set(1, 1, 1);
    localMatrix.compose(localVector, localQuaternion, localVector2)
      .premultiply(this.matrixWorld)
      .decompose(localVector, localQuaternion, localVector2);

    // const matrixWorld = _getMatrixWorld(this.mesh, contentMesh, localMatrix, positionX, positionZ, rotationY);
    // matrixWorld.decompose(localVector, localQuaternion, localVector2);
    const position = localVector;
    const quaternion = localQuaternion;
    const scale = localVector2;
    const dynamic = false;
    const external = true;

    const physicsGeometry = this.#getShapeGeometry(geometryIndex);
    const physicsObject = this.physics.addConvexShape(shapeAddress, position, quaternion, scale, dynamic, external,physicsGeometry);
  
    this.physicsObjects.push(physicsObject);

    return physicsObject;
  }
  
  grabInstance(physicsId){
    const phys = metaversefile.getPhysicsObjectByPhysicsId(physicsId);
    this.physics.removeGeometry(phys);
    const drawcall = this.instanceObjects.get(physicsId);
    drawcall.decrementInstanceCount();

  }
  getPhysicsObjects() {
    return this.physicsObjects;
  }
}

//

export default e => {
  const app = useApp();
  const camera = useCamera();
  const physics = usePhysics();
  const {createAppUrlSpriteSheet, SpritesheetMesh} = useSpriting();

  app.name = 'litter';

  const frameCbs = [];
  e.waitUntil((async () => {
    await Promise.all(litterUrls.map(async (u, index) => {
      const meshSize = 3;
      const _loadFullModel = async () => {
        const mesh = await metaversefile.createAppAsync({
          start_url: u,
        });
        mesh.position.y = 0.5;
        mesh.position.x = (-litterUrls.length / 2 + index) * meshSize;
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
        treeMesh2.position.x = (-litterUrls.length / 2 + index) * meshSize;
        treeMesh2.position.z += meshSize;
        treeMesh2.scale.multiplyScalar(2);

        app.add(treeMesh2);
        treeMesh2.updateMatrixWorld();
        
        return treeMesh2;
      };
      const _loadSpritesheet = async () => {
        const spritesheet = await createAppUrlSpriteSheet(u, {
          // size: 2048,
          // numFrames: 8,
        });
        const {
          result,
          numFrames,
          // frameSize,
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
        spritesheetMesh.position.x = (-litterUrls.length / 2 + index) * meshSize;
        spritesheetMesh.position.z += meshSize * 2;
        spritesheetMesh.scale.multiplyScalar(2);
        app.add(spritesheetMesh);
        spritesheetMesh.updateMatrixWorld();

        // animate
        const frameCb = () => {
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
        frameCbs.push(frameCb);
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
    for (const frameCb of frameCbs) {
      frameCb();
    }
  });

  return app;
};