(function () {

  AFRAME.registerSystem('cached-model', {
    init: function () {
      this.promises = new Map();
      this.meshes = new Map();
    },
    seen: function (cacheKey) {
      return !!(this.promises.get(cacheKey) || this.meshes.get(cacheKey));
    },
    get: function (cacheKey) {
      var mesh = this.meshes.get(cacheKey);
      if (mesh) {
        return Promise.resolve(mesh);
      }
      else {
        return this.promises.get(cacheKey);
      }
    },
    set: function (cacheKey, promise) {
      this.promises.set(cacheKey, promise);
      promise.then(function (mesh) {
        this.meshes.set(cacheKey, mesh);
      }.bind(this));
    }
  });

  function setObject3D (mesh) {
    this.el.setObject3D('mesh', mesh.clone());
    // TODO We should actually emit a 'object3dset' event here but n-mesh-collider would stop working
    this.el.emit('model-loaded');
  }

  function waitForAndResolveModel (resolve) {
    this.el.addEventListener('model-loaded', function () {
      resolve(this.el.object3DMap.mesh);
    }.bind(this));
  }

  AFRAME.registerComponent('cached-obj-model', {
    dependencies: ['obj-model'],

    schema: {
      mtl: { type: 'src' },
      obj: { type: 'src' }
    },

    init: function () {
      var system = this.el.sceneEl.systems['cached-model'];
      if (system.seen(this.data.obj + this.data.mtl)) {
        system.get(this.data.obj + this.data.mtl).then(setObject3D.bind(this));
      }
      else {
        system.set(this.data.obj + this.data.mtl, new Promise(waitForAndResolveModel.bind(this)));
        this.el.setAttribute('obj-model', {
          obj: 'url(' + this.data.obj + ')',
          mtl: this.data.mtl ? ('url(' + this.data.mtl + ')') : '',
        });
      }
    }
  });

  var extendDeep = AFRAME.utils.extendDeep;

  AFRAME.registerPrimitive('cached-obj-model', extendDeep({}, AFRAME.primitives.getMeshMixin(), {
    mappings: {
      src: 'cached-obj-model.obj',
      mtl: 'cached-obj-model.mtl'
    }
  }));

  AFRAME.registerComponent('cached-gltf-model', {
    dependencies: ['gltf-model'],

    schema: {
      src: { type: 'src' }
    },

    init: function () {
      var system = this.el.sceneEl.systems['cached-model'];
      if (system.seen(this.data.src)) {
        system.get(this.data.src).then(setObject3D.bind(this));
      }
      else {
        system.set(this.data.src, new Promise(waitForAndResolveModel.bind(this)));
        this.el.setAttribute('gltf-model', this.data.src);
      }
    }
  });

  AFRAME.registerPrimitive('cached-gltf-model', extendDeep({}, AFRAME.primitives.getMeshMixin(), {
    mappings: {
      src: 'cached-gltf-model.src'
    }
  }));

}());