(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
}(function () { 'use strict';

  // remix of https://github.com/supermedium/superframe/tree/master/components/gltf-part
  var LOADING_MODELS = {};
  var MODELS = {};

  AFRAME.registerComponent("gltf-part", {
    schema: {
      buffer: {default: true},
      part: {type: "string"},
      src: {type: "asset"}
    },

    update: function () {
      var el = this.el;
      if (!this.data.part && this.data.src) { return; }
      this.getModel(function (modelPart) {
        if (!modelPart) { return; }
        el.setObject3D("mesh", modelPart);
      });
    },

    /**
     * Fetch, cache, and select from GLTF.
     *
     * @param {modelLoadedCallback} cb - Called when the model is loaded
     * @returns {object} - Selected subset of model.
     */
    getModel: function (cb) {
      var self = this;

      // Already parsed, grab it.
      if (MODELS[this.data.src]) {
        cb(this.selectFromModel(MODELS[this.data.src]));
        return;
      }

      // Currently loading, wait for it.
      if (LOADING_MODELS[this.data.src]) {
        return LOADING_MODELS[this.data.src].then(function (model) {
          cb(self.selectFromModel(model));
        });
      }

      // Not yet fetching, fetch it.
      LOADING_MODELS[this.data.src] = new Promise(function (resolve) {
        new THREE.GLTFLoader().load(self.data.src, function (gltfModel) {
          var model = gltfModel.scene || gltfModel.scenes[0];
          MODELS[self.data.src] = model;
          delete LOADING_MODELS[self.data.src];
          cb(self.selectFromModel(model));
          resolve(model);
        }, function () { }, console.error);
      });
    },

    /**
     * Search for the part name and look for a mesh.
     */
    selectFromModel: function (model) {
      var part;

      part = model.getObjectByName(this.data.part);
      if (!part) {
        console.error("[gltf-part] `" + this.data.part + "` not found in model.");
        return;
      }

      return part.clone()
    }
  });

  // modification of the 'material' component from https://aframe.io/releases/0.9.0/aframe.min.js

  (function() {

  var utils = AFRAME.utils;

  var error = utils.debug('components:materialx:error');
  var shaders = AFRAME.shaders;

  /**
   * Material component.
   *
   * @member {object} shader - Determines how material is shaded. Defaults to `standard`,
   *         three.js's implementation of PBR. Another standard shading model is `flat` which
   *         uses MeshBasicMaterial.
   */
  AFRAME.registerComponent('materialx', {
    schema: {
      alphaTest: {default: 0.0, min: 0.0, max: 1.0},
      depthTest: {default: true},
      depthWrite: {default: true},
      flatShading: {default: false},
      name: {default: ''},
      npot: {default: false},
      offset: {type: 'vec2', default: {x: 0, y: 0}},
      opacity: {default: 1.0, min: 0.0, max: 1.0},
      remap: {default: ''},
      repeat: {type: 'vec2', default: {x: 1, y: 1}},
      shader: {default: 'standard', oneOf: Object.keys(AFRAME.shaders), schemaChange: true},
      side: {default: 'front', oneOf: ['front', 'back', 'double']},
      transparent: {default: false},
      vertexColors: {type: 'string', default: 'none', oneOf: ['face', 'vertex']},
      visible: {default: true},
      blending: {default: 'normal', oneOf: ['none', 'normal', 'additive', 'subtractive', 'multiply']}
    },

    multiple: true,

    init: function () {
      this.system = this.el.sceneEl.systems['material'];
      this.material = null;
      this.oldMaterials = [];
    },

    /**
     * Update or create material.
     *
     * @param {object|null} oldData
     */
    update: function (oldData) {
      var data = this.data;
      if (!this.shader || data.shader !== oldData.shader) {
        // restore old materials, so if we remap again we will remember the originals
        replaceMaterial(this.el, oldData.remap, this.oldMaterials, []);
        this.updateShader(data.shader);
      }
      this.shader.update(this.data);
      this.updateMaterial(oldData);
    },

    updateSchema: function (data) {
      var currentShader;
      var newShader;
      var schema;
      var shader;

      newShader = data && data.shader;
      currentShader = this.oldData && this.oldData.shader;
      shader = newShader || currentShader;
      schema = shaders[shader] && shaders[shader].schema;

      if (!schema) { error('Unknown shader schema ' + shader); }
      if (currentShader && newShader === currentShader) { return; }
      this.extendSchema(schema);
      this.updateBehavior();
    },

    updateBehavior: function () {
      var key;
      var sceneEl = this.el.sceneEl;
      var schema = this.schema;
      var self = this;
      var tickProperties;

      function tickTime (time, delta) {
        var key;
        for (key in tickProperties) {
          tickProperties[key] = time;
        }
        self.shader.update(tickProperties);
      }

      this.tick = undefined;

      tickProperties = {};
      for (key in schema) {
        if (schema[key].type === 'time') {
          this.tick = tickTime;
          tickProperties[key] = true;
        }
      }

      if (!sceneEl) { return; }
      if (this.tick) {
        sceneEl.addBehavior(this);
      } else {
        sceneEl.removeBehavior(this);
      }
    },

    updateShader: function (shaderName) {
      var data = this.data;
      var Shader = shaders[shaderName] && shaders[shaderName].Shader;
      var shaderInstance;

      if (!Shader) { throw new Error('Unknown shader ' + shaderName); }

      // Get material from A-Frame shader.
      shaderInstance = this.shader = new Shader();
      shaderInstance.el = this.el;
      shaderInstance.init(data);
      this.setMaterial(shaderInstance.material);
      this.updateSchema(data);
    },

    /**
     * Set and update base material properties.
     * Set `needsUpdate` when needed.
     */
    updateMaterial: function (oldData) {
      var data = this.data;
      var material = this.material;
      var oldDataHasKeys;

      // Base material properties.
      material.alphaTest = data.alphaTest;
      material.depthTest = data.depthTest !== false;
      material.depthWrite = data.depthWrite !== false;
      material.name = data.name;
      material.opacity = data.opacity;
      material.flatShading = data.flatShading;
      material.side = parseSide(data.side);
      material.transparent = data.transparent !== false || data.opacity < 1.0;
      material.vertexColors = parseVertexColors(data.vertexColors);
      material.visible = data.visible;
      material.blending = parseBlending(data.blending);

      // Check if material needs update.
      for (oldDataHasKeys in oldData) { break; }
      if (oldDataHasKeys &&
          (oldData.alphaTest !== data.alphaTest ||
           oldData.side !== data.side ||
           oldData.vertexColors !== data.vertexColors)) {
        material.needsUpdate = true;
      }
    },

    /**
     * Remove material on remove (callback).
     * Dispose of it from memory and unsubscribe from scene updates.
     */
    remove: function () {
      // var defaultMaterial = new THREE.MeshBasicMaterial();
      var material = this.material;
      // var object3D = this.el.getObject3D('mesh');
      // if (object3D) { object3D.material = defaultMaterial; }
      replaceMaterial(this.el, this.data.remap, this.oldMaterials, []);
      this.oldMaterials.length = 0;
      disposeMaterial(material, this.system);
    },

    /**
     * (Re)create new material. Has side-effects of setting `this.material` and updating
     * material registration in scene.
     *
     * @param {object} data - Material component data.
     * @param {object} type - Material type to create.
     * @returns {object} Material.
     */
    setMaterial: function (material) {
      var el = this.el;
      var system = this.system;
      var remapName = this.data.remap;
      var hasMaterials = false;
      var oldMaterials = this.oldMaterials;

      if (this.material) { disposeMaterial(this.material, system); }

      this.material = material;
      system.registerMaterial(material);

      // Set on mesh. If mesh does not exist, wait for it.
      // mesh = el.getObject3D('mesh');
      // if (mesh) {
      //   mesh.material = material;
      // } else {
      hasMaterials = replaceMaterial(el, remapName, [material], oldMaterials);
      if (!hasMaterials) {
        el.addEventListener('object3dset', function waitForMesh (evt) {
          if (evt.detail.type !== 'mesh' || evt.target !== el) { return; }
          // el.getObject3D('mesh').material = material;
          replaceMaterial(el, remapName, [material], oldMaterials);
          el.removeEventListener('object3dset', waitForMesh);
        });
      }
    }
  });

  /**
   * Return a three.js constant determining which material face sides to render
   * based on the side parameter (passed as a component property).
   *
   * @param {string} [side=front] - `front`, `back`, or `double`.
   * @returns {number} THREE.FrontSide, THREE.BackSide, or THREE.DoubleSide.
   */
  function parseSide (side) {
    switch (side) {
      case 'back': {
        return THREE.BackSide;
      }
      case 'double': {
        return THREE.DoubleSide;
      }
      default: {
        // Including case `front`.
        return THREE.FrontSide;
      }
    }
  }

  /**
   * Return a three.js constant determining vertex coloring.
   */
  function parseVertexColors (coloring) {
    switch (coloring) {
      case 'face': {
        return THREE.FaceColors;
      }
      case 'vertex': {
        return THREE.VertexColors;
      }
      default: {
        return THREE.NoColors;
      }
    }
  }

  /**
   * Return a three.js constant determining blending
   *
   * @param {string} [blending=normal]
   * - `none`, additive`, `subtractive`,`multiply` or `normal`.
   * @returns {number}
   */
  function parseBlending (blending) {
    switch (blending) {
      case 'none': {
        return THREE.NoBlending;
      }
      case 'additive': {
        return THREE.AdditiveBlending;
      }
      case 'subtractive': {
        return THREE.SubtractiveBlending;
      }
      case 'multiply': {
        return THREE.MultiplyBlending;
      }
      default: {
        return THREE.NormalBlending;
      }
    }
  }

  /**
   * Dispose of material from memory and unsubscribe material from scene updates like fog.
   */
  function disposeMaterial (material, system) {
    material.dispose();
    system.unregisterMaterial(material);
  }

  /**
   * Replace all materials of a given name with a new material.
   * 
   * @param {object} el - element to replace material on
   * @param {string} nameGlob - regex of name of the material to replace. use '' for the material from getObject3D('mesh')
   * @param {object} newMaterials - list of materials to use
   * @param {object} replacedList - materials that have been replaced
   * @returns {object[]} - list of replaced materials
   */
  function replaceMaterial (el, nameGlob, newMaterials, outReplacedList) {
    var hasMaterials = false;
    outReplacedList.length = 0;

    if (newMaterials.length === 0) {
      return true
    }

    if (nameGlob === '') {
      var object3D = el.getObject3D('mesh');

      if (object3D && object3D.material) {
        outReplacedList.push(object3D.material);
        object3D.material = newMaterials[0];
        hasMaterials = true;
      }
    } else {
      var object3D = el.object3D;
      var nameRegex = globToRegex(nameGlob);
      var regex = new RegExp('^' + nameRegex + '$');
      var newIndex = 0;

      if (object3D) {
        object3D.traverse(function (obj) {
          if (obj && obj.material) {
            hasMaterials = true;

            if (Array.isArray(obj.material)) {
              for (var i = 0, n = obj.material.length; i < n; i++) {
                if (regex.test(obj.material[i].name)) {
                  outReplacedList.push(obj.material[i]);
                  obj.material[i] = newMaterials[newIndex];
                  newIndex = (newIndex + 1) % newMaterials.length;
                }
              }
            } else if (regex.test(obj.material.name)) {
              outReplacedList.push(obj.material);
              obj.material = newMaterials[newIndex];
              newIndex = (newIndex + 1) % newMaterials.length;
            }
          }
        });
      }
    }

    return hasMaterials;
  }

  function globToRegex(glob) {
    return glob.replace(/[\.\{\}\(\)\^\[\]\$]/g, '\\$&').replace(/[\*\?]/g, '.$&');
  }

  })();

  const ZERO = Object.freeze({x: 0, y: 0, z: 0});
  const UNIT_X = Object.freeze({x: 1, y: 0, z: 0});
  const UNIT_Y = Object.freeze({x: 0, y: 1, z: 0});
  const UNIT_Z = Object.freeze({x: 0, y: 0, z: 1});

  const SQRT_1_2 = Math.sqrt(0.5);
  const IDENTITY = Object.freeze({x:0, y:0, z:0, w:1});
  const ROTATE_X_180 = Object.freeze({x:1, y:0, z:0, w:0});
  const ROTATE_Y_180 = Object.freeze({x:0, y:1, z:0, w:0});
  const ROTATE_Z_180 = Object.freeze({x:0, y:0, z:1, w:0});
  const ROTATE_X_90 = Object.freeze({x:SQRT_1_2, y:0, z:0, w:SQRT_1_2});
  const ROTATE_Y_90 = Object.freeze({x:0, y:SQRT_1_2, z:0, w:SQRT_1_2});
  const ROTATE_Z_90 = Object.freeze({x:0, y:0, z:SQRT_1_2, w:SQRT_1_2});

  function setFromUnscaledAffine4(out, aff) {
    const m11 = aff[0], m12 = aff[4], m13 = aff[8];
    const m21 = aff[1], m22 = aff[5], m23 = aff[9];
    const m31 = aff[2], m32 = aff[6], m33 = aff[10];
    const trace = m11 + m22 + m33;
    let s;

    if ( trace > 0 ) {

      s = 0.5 / Math.sqrt( trace + 1.0 );

      out.w = 0.25 / s;
      out.x = ( m32 - m23 ) * s;
      out.y = ( m13 - m31 ) * s;
      out.z = ( m21 - m12 ) * s;

    } else if ( m11 > m22 && m11 > m33 ) {

      s = 2.0 * Math.sqrt( 1.0 + m11 - m22 - m33 );

      out.w = ( m32 - m23 ) / s;
      out.x = 0.25 * s;
      out.y = ( m12 + m21 ) / s;
      out.z = ( m13 + m31 ) / s;

    } else if ( m22 > m33 ) {

      s = 2.0 * Math.sqrt( 1.0 + m22 - m11 - m33 );

      out.w = ( m13 - m31 ) / s;
      out.x = ( m12 + m21 ) / s;
      out.y = 0.25 * s;
      out.z = ( m23 + m32 ) / s;

    } else {

      s = 2.0 * Math.sqrt( 1.0 + m33 - m11 - m22 );

      out.w = ( m21 - m12 ) / s;
      out.x = ( m13 + m31 ) / s;
      out.y = ( m23 + m32 ) / s;
      out.z = 0.25 * s;

    }
    return out
  }

  function invertAndMultiplyVecXYZ(out, aff, v) {
    const n11 = aff[0], n21 = aff[1], n31 = aff[2];
    const n12 = aff[4], n22 = aff[5], n32 = aff[6];
    const n13 = aff[8], n23 = aff[9], n33 = aff[10];
    const tx = aff[12], ty = aff[13], tz = aff[14];

    const t11 = n33 * n22 - n32 * n23;
    const t12 = n32 * n13 - n33 * n12;
    const t13 = n23 * n12 - n22 * n13;

    const det = n11 * t11 + n21 * t12 + n31 * t13;
    const invDet = 1/det;

    // invert the rotation matrix
    const m11 = t11 * invDet;
    const m21 = ( n31 * n23 - n33 * n21 ) * invDet;
    const m31 = ( n32 * n21 - n31 * n22 ) * invDet;

    const m12 = t12 * invDet;
    const m22 = ( n33 * n11 - n31 * n13 ) * invDet;
    const m32 = ( n31 * n12 - n32 * n11 ) * invDet;

    const m13 = t13 * invDet;
    const m23 = ( n21 * n13 - n23 * n11 ) * invDet;
    const m33 = ( n22 * n11 - n21 * n12 ) * invDet;

    // apply inv(aff)*(v - t)
    const ax = v.x - tx, ay = v.y - ty, az = v.z - tz;
    out.x = m11*ax + m12*ay + m13*az;
    out.y = m21*ax + m22*ay + m23*az;
    out.z = m31*ax + m32*ay + m33*az;

    return out
  }

  function determinant(aff) {
    const n11 = aff[0], n21 = aff[1], n31 = aff[2];
    const n12 = aff[4], n22 = aff[5], n32 = aff[6];
    const n13 = aff[8], n23 = aff[9], n33 = aff[10];

    const t11 = n33 * n22 - n32 * n23;
    const t12 = n32 * n13 - n33 * n12;
    const t13 = n23 * n12 - n22 * n13;

    return n11 * t11 + n21 * t12 + n31 * t13
  }

  const decompose = (function() {
    let affCopy = new Float32Array(16);

    return function decompose(aff, outPosition = undefined, outQuaternion = undefined, outScale = undefined) {
      if (outPosition) {
        outPosition.x = aff[12];
        outPosition.y = aff[13];
        outPosition.z = aff[14];
      }
    
      if (outScale || outQuaternion) {
        const sx = Math.hypot(aff[0], aff[1], aff[2]);
        const sy = Math.hypot(aff[4], aff[5], aff[6]);
        const sz = Math.hypot(aff[8], aff[9], aff[10]);
      
        if (outScale) {
          outScale.x = sx;
          outScale.y = sy;
          outScale.z = sz;
        }
      
        if (outQuaternion) {
          const det = determinant(aff);
          const invSX = det < 0 ? -1/sx : 1/sx; // invert scale on one axis for negative determinant
          const invSY = 1/sy;
          const invSZ = 1/sz;
    
          affCopy.set(aff);
          affCopy[0] *= invSX;
          affCopy[1] *= invSX;
          affCopy[2] *= invSX;
          affCopy[4] *= invSY;
          affCopy[5] *= invSY;
          affCopy[6] *= invSY;
          affCopy[8] *= invSZ;
          affCopy[9] *= invSZ;
          affCopy[10] *= invSZ;
    
          setFromUnscaledAffine4(outQuaternion, affCopy);
        }
      }
    
      return aff
    }  
  })();

  const setFromObject3D = (function() {
    let tempPosition = new THREE.Vector3();
    let tempQuaternion = new THREE.Quaternion();
    let tempScale = new THREE.Vector3();
    let tempBox3 = new THREE.Box3();

    return function setFromObject3D(ext, object3D) {
      if (object3D.children.length === 0) {
        return ext
      }

      // HACK we force the worldmatrix to identity for the object, so we can get a bounding box
      // based around the origin
      tempPosition.copy(object3D.position);
      tempQuaternion.copy(object3D.quaternion);
      tempScale.copy(object3D.scale);

      object3D.position.set(0,0,0);
      object3D.quaternion.set(0,0,0,1);
      object3D.scale.set(1,1,1);

      tempBox3.setFromObject(object3D); // expensive for models
      // ext.setFromObject(object3D) // expensive for models

      object3D.position.copy(tempPosition);
      object3D.quaternion.copy(tempQuaternion);
      object3D.scale.copy(tempScale);
      object3D.updateMatrixWorld(true);

      ext.min.x = tempBox3.min.x;
      ext.min.y = tempBox3.min.y; 
      ext.min.z = tempBox3.min.z; 
      ext.max.x = tempBox3.max.x; 
      ext.max.y = tempBox3.max.y; 
      ext.max.z = tempBox3.max.z; 

      return ext
    }
  })();

  function volume(ext) {
    return (ext.max.x - ext.min.x)*(ext.max.y - ext.min.y)*(ext.max.z - ext.min.z)
  }

  /**
   * Returns the distance between pointA and the surface of boxB. Negative values indicate
   * that pointA is inside of boxB
   * 
   * @param {{x,y,z}} pointA - point
   * @param {{x,y,z}} boxBMin - min extents of boxB
   * @param {{x,y,z}} boxBMax - max extents of boxB
   * @param {float32[16]} affineB - colum-wise matrix for B
   * @param {{x,y,z}} extraScale - additional scale to apply to the output distance
   */
  const pointToBox = (function() {
    let vertA = {};
    let scaleA = {};

    return function pointToBox(pointA, boxBMin, boxBMax, affineB) {
      decompose( affineB, undefined, undefined, scaleA );
      invertAndMultiplyVecXYZ( vertA, affineB, pointA );
      const vx = vertA.x, vy = vertA.y, vz = vertA.z;
      const minx = boxBMin.x - vx, miny = boxBMin.y - vy, minz = boxBMin.z - vz;
      const maxx = vx - boxBMax.x, maxy = vy - boxBMax.y, maxz = vz - boxBMax.z;
      const dx = Math.max(maxx, minx)*scaleA.x;
      const dy = Math.max(maxy, miny)*scaleA.y;
      const dz = Math.max(maxz, minz)*scaleA.z;

      // for points inside (dx and dy and dz < 0) take the smallest distent to an edge, otherwise
      // determine the hypotenuese to the outside edges
      return dx <= 0 && dy <= 0 && dz <= 0 ? Math.max(dx, dy, dz) : Math.hypot(Math.max(0, dx), Math.max(0, dy), Math.max(0, dz))
    }
  })();

  /**
   * Based on donmccurdy/aframe-extras/sphere-collider.js
   *
   * Implement bounding sphere collision detection for entities with a mesh.
   *
   * @property {string} objects - Selector of the entities to test for collision.
   * @property {string} watch - If true, also check against new entities added to the scene.
   *
   */
  AFRAME.registerComponent("simple-hands", {
    schema: {
      objects: {default: ""},
      offset: {type: "vec3"},
      radius: {default: 0.05},
      watch: {default: true},
      bubble: {default: true},
      debug: {default: false},
    },

    init() {
      this.observer = null;
      this.els = [];
      this.hoverEl = undefined;
      this.grabEl = undefined;
      this.sphereDebug = undefined;
      
      this.onTriggerUp = this.onTriggerUp.bind(this);
      this.onTriggerDown = this.onTriggerDown.bind(this);
    },

    remove() {
      this.pause();
    },

    play() {
      const sceneEl = this.el.sceneEl;

      if (this.data.watch) {
        this.observer = new MutationObserver(this.update.bind(this, null));
        this.observer.observe(sceneEl, {childList: true, subtree: true});
      }

      this.el.addEventListener("triggerdown", this.onTriggerDown);
      this.el.addEventListener("triggerup", this.onTriggerUp);
    },

    pause() {
      this.el.removeEventListener("triggerdown", this.onTriggerDown);
      this.el.removeEventListener("triggerup", this.onTriggerUp);

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    },

    /**
     * Update list of entities to test for collision.
     */
    update(oldData) {
      const data = this.data;
      let objectEls;

      // Push entities into list of els to intersect.
      if (data.objects) {
        objectEls = this.el.sceneEl.querySelectorAll(data.objects);
      } else {
        // If objects not defined, intersect with everything.
        objectEls = this.el.sceneEl.children;
      }

      if (!AFRAME.utils.deepEqual(data.offset, oldData.offset) || data.radius !== oldData.radius) {

        if (data.debug) {
          if (this.sphereDebug) {
            this.el.object3D.remove( this.sphereDebug );
          }
          let sphereGeo = new THREE.SphereBufferGeometry(data.radius, 6, 6);
          sphereGeo.translate(data.offset.x, data.offset.y, data.offset.z);
          let wireGeo = new THREE.WireframeGeometry(sphereGeo);
          this.sphereDebug = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({color: 0xffff00}) );
          this.el.object3D.add(this.sphereDebug);
        }
    
      }

      // Convert from NodeList to Array
      this.els = Array.prototype.slice.call(objectEls);
    },

    tick: (function () {
      let obj3DPosition = new THREE.Vector3();
      let handOffset = new THREE.Vector3();

      return function () {
        const data = this.data;
        const handObject3D = this.el.object3D;
        const handRadius = data.radius;

        let newHoverEl = undefined;

        if (!this.grabEl) {

          let minScore = Number.MAX_VALUE;
    
          handOffset.copy(data.offset).applyMatrix4(handObject3D.matrixWorld);

          for (let el of this.els) {
            if (!el.isEntity || !el.object3D) { 
              continue 
            }
    
            let obj3D = el.object3D;  
            if (!obj3D.boundingSphere || !obj3D.boundingBox || obj3D.boundingBox.isEmpty()) {
              this.generateBoundingBox(obj3D);
            }
    
            if (obj3D.boundingBox.isEmpty()) { 
              continue 
            }
    
            // Bounding sphere collision detection
            obj3DPosition.copy(obj3D.boundingSphere.center).applyMatrix4(obj3D.matrixWorld);
            const radius = obj3D.boundingSphere.radius*Math.max(obj3D.scale.x, obj3D.scale.y, obj3D.scale.z);
            const distance = handOffset.distanceTo(obj3DPosition);
            if (distance < radius + handRadius) {

              // Bounding box collision check
              const distanceToBox = pointToBox(handOffset, obj3D.boundingBox.min, obj3D.boundingBox.max, obj3D.matrixWorld.elements);
              // console.log("box", el.id, distanceToBox)

              if (distanceToBox < handRadius) {
                const score = volume( obj3D.boundingBox );
                // console.log("score", el.id, score)
                if (score < minScore) {
                  minScore = score;
                  newHoverEl = el;
                }
              }
            }
          }

          // if (newHoverEl) console.log("closest", newHoverEl.id)
        }

        if (this.hoverEl && this.hoverEl !== newHoverEl) {
          this.sendEvent(this.hoverEl, "hoverend");
        }
        if (newHoverEl && newHoverEl !== this.hoverEl) {
          this.sendEvent(newHoverEl, "hoverstart");
        } 
        this.hoverEl = newHoverEl;
      }
    })(),

    generateBoundingBox(obj3D) {
      // cache boundingBox and boundingSphere
      obj3D.boundingBox = obj3D.boundingBox || new THREE.Box3();
      obj3D.boundingSphere = obj3D.boundingSphere || new THREE.Sphere();
      setFromObject3D(obj3D.boundingBox, obj3D);

      if (!obj3D.boundingBox.isEmpty()) {
        obj3D.boundingBox.getBoundingSphere(obj3D.boundingSphere);

        if (this.data.debug) {
          let tempBox = new THREE.Box3();
          tempBox.copy(obj3D.boundingBox);
          obj3D.boundingBoxDebug = new THREE.Box3Helper(tempBox);
          obj3D.boundingBoxDebug.name = "simpleHandsDebug";
          obj3D.add(obj3D.boundingBoxDebug);
        }
      }
    },

    sendEvent(targetEl, eventName) {
      const bubble = this.data.bubble;
      // console.log(eventName, targetEl.id)
      targetEl.emit(eventName, {hand: this.el}, bubble);
      this.el.emit(eventName, {target: targetEl}, bubble);
    },

    onTriggerDown(e) {
      if (this.hoverEl) {
        this.grabEl = this.hoverEl;
        this.sendEvent(this.grabEl, "grabstart");
      }
    },

    onTriggerUp(e) {
      if (this.grabEl) {
        this.sendEvent(this.grabEl, "grabend");
        this.grabEl = undefined;
      }
    }
  });

  // Copyright 2018-2019 harlyq
  // MIT license

  function ScopedListener() {
    let elements = [];
    let event;
    let callback;

    function set(el, selector, scope, eventName, callbackFn) {
      remove();
      elements = getElementsInScope(el, selector, scope);
      event = eventName;
      callback = callbackFn;
    }

    function add() {
      if (event && callback) {
        for (let el of elements) {
          console.log("scopedListener:add", el.id, event);
          el.addEventListener(event, callback);
        }
      }
    }

    function remove() {
      if (event && callback) {
        for (let el of elements) {
          console.log("scopedListener:remove", el.id, event);
          el.removeEventListener(event, callback);
        }
      }
    }

    function getElementsInScope(el, selector, scope, eventEl) {
      switch (scope) {
        case "self": return selector === "" ? [el] : el.querySelectorAll(selector) || [el]
        case "parent": return selector === "" ? [el] : el.parentNode.querySelectorAll(selector) || [el]
        case "event": {
          const bestEl = eventEl ? eventEl : el;
          return selector === "" ? [bestEl] : bestEl.querySelectorAll(selector) || [bestEl]
        }
        case "document": 
        default:
          return selector === "" ? [el] : document.querySelectorAll(selector) || [el]
      }
    }

    return {
      set,
      add,
      remove,
      getElementsInScope,
    }
  }

  // Copyright 2018-2019 harlyq
  // MIT license

  function BasicTimer() {
    let sendEventTimer;
    let timeOfStart;
    let timeoutCallback;
    let timeRemaining;

    function start(delay, callback) {
      stop();
      
      if (delay > 0) {
        sendEventTimer = setTimeout(callback, delay*1000);
        timeOfStart = Date.now();
        timeoutCallback = callback;
      } else {
        callback();
      }
    }

    function stop() {
      clearTimeout(self.sendEventTimer);
      sendEventTimer = undefined;
      timeOfStart = undefined;
      timeRemaining = undefined;
      timeoutCallback = undefined;
    }

    function pause() {
      if (sendEventTimer) {
        let remaining = Date.now() - timeOfStart;
        stop();
        timeRemaining = remaining;
      }
    }

    function resume() {
      if (timeRemaining) {
        start(timeRemaining, timeoutCallback);
        timeRemaining = undefined;
      }
    }

    return {
      start,
      stop,
      pause,
      resume
    }
  }

  // Copyright 2018-2019 harlyq
  // MIT license

  function BasicRandom() {
    const MAX_UINT32 = 0xffffffff;
    let seed = -1;
    
    function setSeed(s) {
      seed = s;
    }
    
    function random() {
      if (seed < 0) {
        return Math.random()
      }
    
      seed = (1664525*seed + 1013904223) % MAX_UINT32;
      return seed/MAX_UINT32
    }
    
    function randomInt(n) {
      return ~~(random()*n)
    }
    
    function randomNumber(min, max) {
      if (min === max) { return min }
      return random()*(max - min) + min
    }
    
    return {
      setSeed,
      random,
      randomInt,
      randomNumber,
    }
  }

  // Copyright 2018-2019 harlyq

  // console.assert(deepEqual(null, null))
  // console.assert(deepEqual(undefined, undefined))
  // co
  nsole.assert(deepEqual([], []))
  // console.assert(deepEqual([1], [1]))
  // console.assert(deepEqual([1,2,3], [1,2,3]))
  // console.assert(!deepEqual([1,2], [1,2,3]))
  // console.assert(!deepEqual([1,2,3], [1,2]))
  // console.assert(deepEqual({a:1, b:"c"}, {a:1, b:"c"}))
  // console.assert(!deepEqual({a:1, b:"c"}, {a:1, b:"d"}))
  // console.assert(!deepEqual({a:1, b:"c"}, {a:2, b:"c"}))
  // console.assert(!deepEqual({a:1, b:"c"}, null))
  // console.assert(deepEqual({a:[1,2], b:{x: 3, y:4}}, {a:[1,2], b:{x: 3, y:4}}))

  // builds a value from a 'root' and an array of 'attributes', each attribute is considered as the child of the previous attribute
  function buildPath(root, attributes) {
    let path = root;
    let parts = attributes.slice().reverse();
    while (path && parts.length > 0) {
      path = path[parts.pop()];
    }

    return path
  }

  console.assert(buildPath({a: 1, b: {c: {x: "hello"}, d: 3}}, ["b","c","x"]) === "hello");
  console.assert(buildPath({a: 1, b: {c: {x: "hello"}, d: 3}}, ["b","c","y"]) === undefined);
  console.assert(buildPath({a: 1, b: {c: {x: "hello"}, d: 3}}, ["a"]) === 1);
  console.assert(buildPath({a: 1, b: {c: {x: "hello"}, d: 3}}, ["b","w"]) === undefined);


  // stringifies an object, specifically sets colors as hexstrings and coordinates as space separated numbers
  function convertToString(thing) {
    if (typeof thing == "object") {
      if (Array.isArray(thing)) {
        return thing.map(convertToString)
      }

      if (thing instanceof THREE.Color) {
        return "#" + thing.getHexString()
      }

      if ("x" in thing || "y" in thing || "z" in thing || "w" in thing) {
        return AFRAME.utils.coordinates.stringify(thing)
      }
    }

    return thing.toString()
  }


  // *value* can be boolean, string, color or array of numbers
  const setProperty = (() => {
    const trim = x => x.trim();
    const OBJECT3D_FAST_SET = {
      "rotation": x => isNaN(x) ? 0 : THREE.Math.degToRad(x),
      "position": x => isNaN(x) ? 0 : x,
      "scale": x => isNaN(x) ? 1 : x,
    };
    
    return function setProperty(target, prop, value) {
      let fn = OBJECT3D_FAST_SET[prop];
      if (fn) {
        if (Array.isArray(value)) ; else if (typeof value === "object") {
          value = [value.x, value.y, value.z];
        } else {
          value = value.split(" ").map(trim);
        }
        value.length = 3;
        target.object3D[prop].set(...value.map(fn));
        return
      }
    
      const parts = prop.split(".");
      if (parts.length <= 2) {
        // component or component.property
        parts[0] = parts[0].replace(/[A-Z]/g, x => "-" + x.toLowerCase()); // convert component names from camelCase to kebab-case
        if (value) {
          AFRAME.utils.entity.setComponentProperty(target, parts.join("."), convertToString(value)); // does this work for vectors??
        } else {
          target.removeAttribute(parts.join("."));
        }
        return
      }
    
      // e.g. object3dmap.mesh.material.uniforms.color
      const path = buildPath(target, parts);
      if (path) {
        // this only works for boolean, string, color and an array of one element
        path[part] = Array.isArray(value) && value.length === 1 ? value[0] : value;
      } else {
        console.warn(`unknown path for setProperty() '${prop}'`);
      }
    }   
    
  })();


  // Convert a string "1 2 3" into a type and value {type: "numbers", value: [1,2,3]}
  const parseValue = (function() {
    const isTHREE = typeof THREE !== "undefined";
    const COLOR_WHITE = isTHREE ? new THREE.Color() : undefined;
    const COLOR_BLACK = isTHREE ? new THREE.Color(0,0,0) : undefined;
    const toNumber = str => Number(str.trim());

    let tempColor = isTHREE ? new THREE.Color() : undefined;
    
    return function parseValue(str) {
      if (str === "") return {type: "any", value: ""}

      let vec = str.split(" ").filter(x => x !== "").map(toNumber);
      if (!vec.every(isNaN)) return {type: "numbers", value: vec}
    
      if (isTHREE) {
        let oldWarn = console.warn; console.warn = () => {}; // HACK disable warnings that threejs spams about invalid colors
        let col = new THREE.Color(str.trim());
        if (col.equals(COLOR_WHITE) && tempColor.copy(COLOR_BLACK).setStyle(str).equals(COLOR_BLACK)) col = undefined; // if input colour is the same as the starting color, then input was invalid
        console.warn = oldWarn;
        if (col) return {type: "color", value: col}
      }
    
      return {type: "string", value: str.trim()}
    }
  })();

  // console.assert(deepEqual(parseValue(""), {type: "any", value: ""}))
  // console.assert(deepEqual(parseValue("1"), {type: "numbers", value: [1]}))
  // console.assert(deepEqual(parseValue(" 2  3  4"), {type: "numbers", value: [2,3,4]}))
  // console.assert(deepEqual(parseValue(" 2.5 "), {type: "numbers", value: [2.5]}))
  // console.assert(deepEqual(parseValue(" 2,3 ,4 "), {type: "string", value: "2,3 ,4"}))
  // console.assert(parseValue("red").type === "color" && parseValue("red").value.getHexString() === "ff0000")
  // console.assert(parseValue("#123").type === "color" && parseValue("#123").value.getHexString() === "112233")

  // Copyright 2018-2019 harlyq
  // import {deepEqual} from "./aframe-utils"

  function trim(str) {
    return str.trim()
  }

  // console.assert(deepEqual(parseValue(""), {type: "any", value: ""}))
  // console.assert(deepEqual(parseValue("1"), {type: "numbers", value: [1]}))
  // console.assert(deepEqual(parseValue(" 2  3  4"), {type: "numbers", value: [2,3,4]}))
  // console.assert(deepEqual(parseValue(" 2.5 "), {type: "numbers", value: [2.5]}))
  // console.assert(deepEqual(parseValue(" 2,3 ,4 "), {type: "string", value: "2,3 ,4"}))
  // console.assert(parseValue("red").type === "color" && parseValue("red").value.getHexString() === "ff0000")
  // console.assert(parseValue("#123").type === "color" && parseValue("#123").value.getHexString() === "112233")
  // console.assert(parseValue("  burple "), {type: "string", value: "burple"})

  // Convert a string "1..3" into {type: "numbers", range: [[1],[3]]}
  // Convert a string "1|2|3" into {type: "string", options: ["1","2","3"]}
  function parseRangeOption(str) {
    let range = str.split("..");
    if (range.length > 1) {
      const start = parseValue(range[0]);
      const end = parseValue(range[1]);
    
      if (start.type !== end.type && start.type !== "any" && end.type !== "any") {
        console.error(`incompatible types for range ${str}`);
      } else {
        return { type: start.type !== "any" ? start.type : end.type, range: [start.value, end.value]}
      }
    }

    let options = str.split("|");
    return { type: "string", options: options.map(trim) }
  }

  // console.assert(deepEqual(parseRangeOption("1 2 3"), { type: "string", options: ["1 2 3"]}))
  // console.assert(deepEqual(parseRangeOption("1 2..3 4 5"), { type: "numbers", range: [[1,2],[3,4,5]]}))
  // console.assert(deepEqual(parseRangeOption("a|b|c"), { type: "string", options: ["a","b","c"]}))
  // console.assert(deepEqual(parseRangeOption("1 2||3"), { type: "string", options: ["1 2","","3"]}))
  // console.assert(deepEqual(parseRangeOption("..3"), { type: "numbers", range: ["",[3]]}))
  // console.assert(deepEqual(parseRangeOption("a..b"), { type: "string", range: ["a","b"]}))

  function randomizeOptions(options, randFn) {
    return options[Math.floor(randFn()*options.length)]
  }

  function randomizeRange(type, range, randFn) {
    const min = range[0];
    const max = range[1];
    const randomNumber = (min, max) => {
      if (min === max) return min
      return randFn()*(max - min) + min
    };

    if (type === "numbers") {
      const m = Math.min(min.length, max.length); // count the least elements
      let result = max.length > m ? max.slice() : min.slice(); // copy the larger array
      for (let i = 0; i < m; i++) {
        result[i] = randomNumber(min[i], max[i]); // randomize the parts where values exist for both min and max
      }
      return result
    }
    
    if (type === "color") {
      return new THREE.Color(randomNumber(min.r, max.r), randomNumber(min.g, max.g), randomNumber(min.b, max.b))
    }

    return randFn() > 0.5 ? min : max
  }


  // const stringParts = ["a","ab","bc"];
  // const vecParts = [[1,2,3],[10,20]]
  // for (let i = 0; i < 50; i++) {
  //   console.assert(randomizeOptions(["x"], Math.random) === "x")
  //   console.assert(stringParts.includes(randomizeOptions(stringParts, Math.random)))
  //   console.assert(["a", "b"].includes(randomizeRange("string", ["a", "b", "c"], Math.random)))
    
  //   const x = randomizeRange("numbers", [[1],[2]], Math.random)
  //   console.assert(x >= 1 && x < 2)

  //   const y = randomizeRange("numbers", vecParts, Math.random)
  //   console.assert(y.length === 3 && y[0] >= vecParts[0][0] && y[0] < vecParts[1][0] && y[1] >= vecParts[0][1] && y[1] < vecParts[1][1] && y[2] === vecParts[0][2])
  // }


  //-----------------------------------------------------------------------------
  // "wait-set" component for setting attributes on this or other elements after a delay or event
  // 
  AFRAME.registerComponent("wait-set", {
    schema: {
      delay: { default: 0 },
      event: { default: "" },
      source: { default: "" },
      sourceScope: { default: "document", oneOf: ["parent", "self", "document"] },
      target: { default: "" },
      targetScope: { default: "document", oneOf: ["parent", "self", "document", "event"] },
      seed: { type: "int", default: -1 },
    },
    multiple: true,

    init() {
      this.setProperties = this.setProperties.bind(this);
      this.startDelay = this.startDelay.bind(this);

      this.eventTargetEl = undefined;
      this.rules = {};
      this.sources = [];

      this.waitListener = ScopedListener();
      this.waitTimer = BasicTimer();
      this.psuedoRandom = BasicRandom();
    },

    remove() {
      this.waitListener.remove();
      this.waitTimer.stop();
    },

    updateSchema(newData) {
      const originalSchema = AFRAME.components[this.name].schema;
      let newSchema = {};

      for (let prop in newData) {
        if (!(prop in originalSchema)) {
          newSchema[prop] = { default: "" };
        }
      }

      // extend the schema so the new rules appear in the inspector
      if (Object.keys(newSchema).length > 0) {
        this.extendSchema(newSchema);
      }
    },

    update(oldData) {
      const originalSchema = AFRAME.components[this.name].schema;
      const data = this.data;

      if (data.seed !== oldData.seed) {
        this.psuedoRandom.setSeed(data.seed);
      }

      for (let prop in this.rules) {
        if (!(prop in data)) {
          delete this.rules[prop]; // property is no longer present
        }
      }

      for (let prop in data) {
        if (!(prop in originalSchema) && data[prop] !== oldData[prop]) {
          this.rules[prop] = parseRangeOption(data[prop]);
        }
      }

      if (data.event !== oldData.event || data.source !== oldData.source || data.sourceScope !== oldData.sourceScope) {
        this.waitListener.set(this.el, data.source, data.sourceScope, data.event, this.startDelay);
      }

      if (data.delay !== oldData.delay && (this.delayTimer || data.event === "")) {
        this.startDelay();
      }
    },

    pause() {
      this.waitListener.remove();
      this.waitTimer.pause();
    },

    play() {
      this.waitTimer.resume();
      this.waitListener.add();
    },

    startDelay(e) {
      // console.log("wait-set:startDelay", e.target.id, this.data.event)
      this.eventTargetEl = e ? e.target : undefined;
      this.waitTimer.start(this.data.delay, this.setProperties);
    },

    setProperties() {
      const elements = this.waitListener.getElementsInScope(this.el, this.data.target, this.data.targetScope, this.eventTargetEl);

      for (let el of elements) {
        for (let prop in this.rules) {
          let rule = this.rules[prop];

          const value = rule.options ? randomizeOptions(rule.options, this.psuedoRandom.random) : randomizeRange(rule.type, rule.range, this.psuedoRandom.random);
          // console.log("wait-set:setProperties", el.id, prop, value)
          setProperty(el, prop, value);
        }
      }
    },
  });

  const warn = AFRAME.utils.debug("puzzle-3d:warn");
  const radToDeg = THREE.Math.radToDeg;
  const degToRad = THREE.Math.degToRad;

  /**
   * puzzle-3d AFrame Component
   */
  AFRAME.registerComponent("puzzle-3d", {
    schema: {
      goalRotations: {
        type: "string"
      },
      goalPositions: {
        type: "string"
      },
      goalMixin: {
        default: ""
      },
      positionTolerance: {
        default: 0.05
      },
      angleTolerance: {
        default: 20
      },
      snapIndex: {
        type: "int",
        default: -1
      }
    },

    multiple: true,

    init() {
      this.state = { name: "free" };
      this.grabHand = undefined;
      this.grabMatrix = new THREE.Matrix4(); // object matrix relative to the hand axis
      this.goalPositions = [];
      this.goalQuaternions = [];
      this.goalHandPositions = [];
      this.goalHandQuaternions = [];
      this.ghostEntity = undefined;

      this.el.addEventListener("grabstart", this.onGrabStart.bind(this));
      this.el.addEventListener("grabend", this.onGrabEnd.bind(this));
    },

    remove() {
      this.el.sceneEl.removeChild(this.ghostEl);
    },

    update(oldData) {
      const data = this.data;

      if (oldData.goalMixin !== data.goalMixin) {
        this.setupGhost(data.goalMixin);
      }

      if (oldData.goalPositions !== data.goalPositions) {
        const positionStrs = data.goalPositions.split(",");
        this.goalPositions = positionStrs.
          filter(str => str.trim()).
          map(str => AFRAME.utils.coordinates.parse(str)).
          map(vec => new THREE.Vector3().copy(vec));
    
        if (this.ghostEl) {
          this.ghostEl.setAttribute("position", positionStrs[0]);
        }
      }

      if (oldData.goalRotations !== data.goalRotations) {
        const rotationStrs = data.goalRotations.split(",");
        const euler = new THREE.Euler();
        this.goalQuaternions = rotationStrs.
          filter(str => str.trim()).
          map(str => AFRAME.utils.coordinates.parse(str)).
          map(vec => new THREE.Quaternion().setFromEuler( euler.set(degToRad(vec.x), degToRad(vec.y), degToRad(vec.z), "YXZ") ));

        if (this.ghostEl) {
          this.ghostEl.setAttribute("rotation", rotationStrs[0]);
        }
      }

      // possibly snap into place on startup
      if (oldData.snapIndex !== data.snapIndex && data.snapIndex >= 0 && data.snapIndex < this.goalPositions.length && data.snapIndex < this.goalQuaternions.length) {
        this.setState({ name: "snap", value: data.snapIndex });
      }
    },

    tick() {
      if (this.grabHand) {
        const data = this.data;
        const obj3D = this.el.object3D;
        const handObj3D = this.grabHand.object3D;

        let snapIndex = -1;
        for (let i = 0; i < this.goalHandPositions.length; i++) {
          const distance = handObj3D.position.distanceTo(this.goalHandPositions[i]);
          const angle = radToDeg(handObj3D.quaternion.angleTo(this.goalHandQuaternions[i]));
    
          // console.log(distance, angle)
          if (distance < data.positionTolerance && angle < data.angleTolerance) {
            snapIndex = i;
            break
          } 
        }

        if (snapIndex !== -1) {
          this.setState({ name: "snap", value: snapIndex });
        } else {
          this.setState({ name: "free" });
          // TODO make this work when parented to something
          obj3D.matrix.multiplyMatrices(handObj3D.matrixWorld, this.grabMatrix);
          obj3D.matrix.decompose(obj3D.position, obj3D.quaternion, obj3D.scale);
        }
      }
    },

    setState(s) {
      if (this.state.name !== s.name || this.state.value !== s.value) {
        this.leaveState(this.state, s);
        this.enterState(s, this.state);
        this.state = s;
        console.log("state", s);
      }
    },

    leaveState(from) {
      if (from.name === "snap" && from.value === 0) {
        this.ghostEl.object3D.visible = true;
      }
    },

    enterState(to) {
      if (to.name === "snap") {
        this.el.emit("puzzlesnap", {value: to.value}, true);
        const obj3D = this.el.object3D;
        obj3D.position.copy(this.goalPositions[to.value]);
        obj3D.quaternion.copy(this.goalQuaternions[to.value]);

        // the ghost is only relative to the 0th goalPosition
        if (to.value === 0) {
          this.ghostEl.object3D.visible = false;
        } else {
          this.ghostEl.object3D.visible = true;
        }

      } else if (to.name === "free") {
        this.el.emit("puzzlefree", {}, true);
      }
    },

    onGrabStart(e) {
      // console.log("puzzle3d grabstart", e.detail.hand.id)
      this.grabHand = e.detail.hand;
      this.setupSnap(this.grabHand.object3D);
    },

    onGrabEnd(e) {
      // console.log("puzzle3d end", e.detail.hand.id)
      if (e.detail.hand === this.grabHand) {
        this.grabHand = undefined;
      }
    },

    setupGhost(ghostMixin) {
      if (this.ghostEl) {
        this.el.sceneEl.removeChild(ghostEntity);
        this.ghostEl = undefined;
      }

      if (ghostMixin) {
        let ghostEntity = document.createElement("a-entity");

        this.el.sceneEl.appendChild(ghostEntity);
        if (this.el.id) {
          ghostEntity.setAttribute("id", "goal-" + this.el.id);
        }
        this.ghostEl = ghostEntity;
    
        this.el.addEventListener("object3dset", (e) => {
          if (e.target === this.el && e.detail.type) {
            this.ghostEl.setObject3D(e.detail.type, this.el.getObject3D(e.detail.type).clone());
          }
		  
		  
        });
    
        this.el.addEventListener("object3dremove", (e) => {
          if (e.target === this.el && e.detail.type) {
            this.ghostEl.removeObject3D(e.detail.type);
          }
        });
    
        if (this.el.object3D) {
          this.el.object3D.children.forEach(part => this.ghostEl.object3D.add(part.clone));
          this.ghostEl.object3DMap = this.el.object3DMap;
        }
    
        this.ghostEl.setAttribute("scale", this.el.getAttribute("scale"));
        this.ghostEl.setAttribute("mixin", ghostMixin);    
      }
    },

    setupSnap: (function () {
      let handOffsetMatrix = new THREE.Matrix4();
      let handGoalMatrix = new THREE.Matrix4();
      let tempScale = new THREE.Vector3();

      function calcGoalHandMatrix(obj3D, handObj3D, goalPosition, goalQuaternion, outPosition, outQuaternion) {
        // put the hand matrix into object space, then map that onto the goal space to determine the 
        // hand position when we are at the goal
        handOffsetMatrix.getInverse(obj3D.matrixWorld).multiply(handObj3D.matrixWorld);
        handGoalMatrix.compose(goalPosition, goalQuaternion, obj3D.scale).multiply(handOffsetMatrix);
        handGoalMatrix.decompose(outPosition, outQuaternion, tempScale);

        // {
        //   let axes = new THREE.AxesHelper(0.1)
        //   axes.applyMatrix(handGoalMatrix)
        //   obj3D.el.sceneEl.object3D.add(axes)
        // }
      }

      let tempPosition = new THREE.Vector3();
      let tempQuaternion = new THREE.Quaternion();

      return function setupSnap(handObj3D) {
        const obj3D = this.el.object3D;
        this.grabMatrix.getInverse(handObj3D.matrixWorld).multiply(obj3D.matrix);
    
        const n = Math.min(this.goalPositions.length, this.goalQuaternions.length);
        this.goalHandPositions.length = 0;
        this.goalHandQuaternions.length = 0;

        for (let i = 0; i < n; i++) {
          calcGoalHandMatrix(obj3D, handObj3D, this.goalPositions[i], this.goalQuaternions[i], tempPosition, tempQuaternion);
          this.goalHandPositions.push(new THREE.Vector3().copy(tempPosition));
          this.goalHandQuaternions.push(new THREE.Quaternion().copy(tempQuaternion));
        }
      }
    
    })(),

  });

}));
