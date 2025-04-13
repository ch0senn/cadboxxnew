//Reading World Position or Rotation of the Camera

AFRAME.registerComponent('rotation-reader', {
  /**
   * We use IIFE (immediately-invoked function expression) to only allocate one
   * vector or euler and not re-create on every tick to save memory.
   */
  tick: (function () {
    var position = new THREE.Vector3();
    var quaternion = new THREE.Quaternion();

    return function () {
      this.el.object3D.getWorldPosition(position);
      this.el.object3D.getWorldQuaternion(quaternion);
      // position and rotation now contain vector and quaternion in world space.
    };
  })
});

//Reading Position or Rotation of the Camera
AFRAME.registerComponent('rotation-reader', {
  tick: function () {
    // `this.el` is the element.
    // `object3D` is the three.js object.

    // `rotation` is a three.js Euler using radians. `quaternion` also available.
    console.log(this.el.object3D.rotation);

    // `position` is a three.js Vector3.
    console.log(this.el.object3D.position);
  }
});

//fixing entities to camera
<a-entity camera look-controls>
  <a-entity geometry="primitive: plane; height: 0.2; width: 0.2" position="0 0 -1"
            material="color: gray; opacity: 0.5"></a-entity>
</a-entity>
//vartiste utils.js
import {Pool} from './pool.js'

function whenLoadedSingle(entity, fn) {
  if (entity.hasLoaded)
  {
    fn()
  }
  else
  {
    entity.addEventListener('loaded', fn)
  }
}

function whenLoadedAll(entities, fn) {
  let allLoaded = entities.map(() => false)
  for (let i = 0; i < entities.length; ++i)
  {
    let ii = i
    let entity = entities[ii]
    whenLoadedSingle(entity, () => {
      allLoaded[ii] = true
      if (allLoaded.every(t => t)) fn()
    })
  }
}

function awaitLoadingSingle(entity) {
  return new Promise((r, e) => whenLoadedSingle(entity, r))
}

async function awaitLoadingAll(entities) {
  for (let entity of entities)
  {
    await awaitLoadingSingle(entity)
  }
}

// General Utilities, accessible via `window.VARTISTE.Util`
class VARTISTEUtil {
  // Returns `{width, height}` as integers greater than 0
  validateSize({width, height}) {
    width = parseInt(width)
    height = parseInt(height)
    if (!(Number.isInteger(width) && width > 0)) {
      console.trace()
      throw new Error(`Invalid composition width ${width}`)
    }
    if (!(Number.isInteger(height) && height > 0)) {
      console.trace()
      throw new Error(`Invalid composition height ${height}`)
    }
    return {width, height}
  }

  // Executes function `fn` when `entity` has finished loading, or immediately
  // if it has already loaded. `entity` may be a single `a-entity` element, or
  // an array of `a-entity` elements. If `fn` is not provided, it will return a
  // `Promise` that will resolve when `entity` is loaded (or immediately if
  // `entity` is already loaded).
  whenLoaded(entity, fn) {
    if (Array.isArray(entity) && fn) return whenLoadedAll(entity, fn)
    if (Array.isArray(entity)) return awaitLoadingAll(entity)
    if (fn) return whenLoadedSingle(entity, fn)
    return awaitLoadingSingle(entity)
  }

  // Copies `matrix` into `obj`'s (a `THREE.Object3D`) `matrix`, and decomposes
  // it to `obj`'s position, rotation, and scale
  applyMatrix(matrix, obj) {
    obj.matrix.copy(matrix)
    matrix.decompose(obj.position, obj.rotation, obj.scale)
  }

  // If `destination` is provided, resizes `destination` to the same size as
  // `canvas` and copies `canvas` contents to `destination`. If `destination` is
  // not provided, it creates a new canvas with the same size and contents as
  // `canvas`.
  cloneCanvas(canvas, destination = undefined) {
    if (typeof destination === 'undefined') destination = document.createElement('canvas')
    destination.width = canvas.width
    destination.height = canvas.height
    destination.getContext('2d').drawImage(canvas, 0, 0)
    return destination
  }

  // Moves `obj` (`THREE.Object3D`) to the same spot as `target` (`THREE.Object3D`), accounting for the various matrix
  // transformations and parentages to get it there.
  positionObject3DAtTarget(obj, target, {scale, transformOffset, transformRoot} = {}) {
    if (typeof transformRoot === 'undefined') transformRoot = obj.parent

    target.updateMatrixWorld()
    let destMat = this.pool('dest', THREE.Matrix4)
    destMat.copy(target.matrixWorld)

    if (transformOffset) {
      let transformMat = this.pool('transformMat', THREE.Matrix4)
      transformMat.makeTranslation(transformOffset.x, transformOffset.y, transformOffset.z)
      destMat.multiply(transformMat)
    }

    if (scale) {
      let scaleVect = this.pool('scale', THREE.Vector3)
      scaleVect.setFromMatrixScale(destMat)
      scaleVect.set(scale.x / scaleVect.x, scale.y / scaleVect.y, scale.z / scaleVect.z)
      destMat.scale(scaleVect)
    }

    let invMat = this.pool('inv', THREE.Matrix4)

    transformRoot.updateMatrixWorld()
    invMat.copy(transformRoot.matrixWorld).invert()
    destMat.premultiply(invMat)

    Util.applyMatrix(destMat, obj)
  }

  // Returns the `THREE.Object3D` that contains the true world transformation
  // matrix for the camera. Works both on desktop and in VR
  cameraObject3D() {
    // return document.querySelector('#camera').object3D//.getObject3D('camera-matrix-helper')
     return document.querySelector('a-scene').is('vr-mode') && document.querySelector('a-scene').hasWebXR ? document.querySelector('#camera').getObject3D('camera-matrix-helper') : document.querySelector('#camera').object3D
  }

  // Brings `initialEl` right in front of the camera
  flyToCamera(initialEl, {propogate = true, ...opts} = {}) {
    let target = this.cameraObject3D()

    let flyingEl = initialEl

    while (propogate && flyingEl['redirect-grab'])
    {
      flyingEl = flyingEl['redirect-grab']
    }

    this.positionObject3DAtTarget(flyingEl.object3D, target, {transformOffset: {x: 0, y: 0, z: -0.5}, ...opts})
  }

  // Registers a `ComponentSystem`. A `ComponentSystem` is a `Component` which
  // is automatically added to the `a-scene`, just like a system. It can be
  // accessed from both `sceneEl.systems` and `sceneEl.components`. The main
  // purpose of this is to have auto-registering systems which also have the
  // schema update events of components.
  registerComponentSystem(name, obj)
  {
    AFRAME.registerComponent(name, obj)
    AFRAME.registerSystem('_' + name, {
      init() {
        this.el.sceneEl.setAttribute(name, "")
        this.el.sceneEl.systems[name] = this.el.sceneEl.components[name]
      }
    })
  }

  // Executes `fn` on all ancestors of `el`
  traverseAncestors(el, fn)
  {
    el = el.parentEl
    while (el)
    {
      fn(el)
      el = el.parentEl
    }
  }

  // Uses THREE.Object3D.traverse to find the first object where `fn` returns
  // `true`
  traverseFind(obj3D, fn, {visibleOnly = false} = {})
  {
    if (fn(obj3D)) return obj3D;

    for (let c of obj3D.children)
    {
      if (visibleOnly && !c.visible) continue
      let res = this.traverseFind(c, fn, {visibleOnly})
      if (res) return res
    }

    return;
  }

  // Uses THREE.Object3D.traverse to find all objects where `fn` returns
  // `true`
  traverseFindAll(obj3D, fn, {outputArray = [], visibleOnly = false} = {})
  {
    if (fn(obj3D)) outputArray.push(obj3D)

    for (let c of obj3D.children)
    {
      if (visibleOnly && !c.visible) continue
      this.traverseFindAll(c, fn, {outputArray, visibleOnly})
    }

    return outputArray;
  }

  // Uppercases the first letter of each word
  titleCase(str) {
    return str.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1))
  }

  unenumerable(obj, prop)
  {
    return
    let pname = "__" + prop
    let initVal = obj[prop]
    Object.defineProperty(obj, prop, {enumerable: false, get: () => obj[pname], set: (v) => obj[pname] = v})
    obj[pname] = initVal
  }

  // Makes it easier to see what's going on with `canvas` (either downloads or displays it)
  debugCanvas(canvas) {
    document.querySelector('a-scene').systems['settings-system'].download(canvas.toDataURL(), {extension: 'png', suffix: 'debug'}, "Debug Image")
  }

  divideCanvasRegions(numberOfRegions, {margin = 0} = {}) {
    // There's a math way to do this. I can't figure it out right now...
    let numberOfHorizontalCuts = 1
    let numberOfVerticalCuts = 1

    while (numberOfHorizontalCuts * numberOfVerticalCuts < numberOfRegions)
    {
      if (numberOfVerticalCuts > numberOfHorizontalCuts)
      {
        numberOfHorizontalCuts++
      }
      else
      {
        numberOfVerticalCuts++
      }
    }

    let boxes = []
    for (let y = 0; y < numberOfHorizontalCuts; ++y)
    {
      for (let x = 0; x < numberOfVerticalCuts; ++x)
      {
        let newBox = new THREE.Box2(new THREE.Vector2(x / numberOfVerticalCuts, y / numberOfHorizontalCuts),
                                  new THREE.Vector2((x + 1) / numberOfVerticalCuts, (y + 1) / numberOfHorizontalCuts))

        newBox.expandByScalar(- margin)
        boxes.push(newBox)
      }
    }

    return boxes
  }

  uvWrapClamp(val) {
    val = val % 1.0
    //v = (v === 0 && val > 0) ? 1.0 : v
    //v = (v < 0) ?  1.0 - v : v
    return val
  }

  resolveGrabRedirection(targetEl) {
    let target = targetEl
    for (let redirection = targetEl['redirect-grab']; redirection; redirection = target['redirect-grab'])
    {
      target = redirection
    }
    return target
  }

  deinterleaveAttributes(geometry) {
    for (let name in geometry.attributes)
    {
      let attr = geometry.attributes[name]
      if (!attr) continue
      if (!attr.isInterleavedBufferAttribute) continue
      let arr = []
      // arr.length = attr.count * attr.itemSize

      console.log(name, attr)

      for (let i = 0; i < attr.count; ++i)
      {
        arr.push(attr.getX(i))
        if (attr.itemSize >= 2) arr.push(attr.getY(i))
        if (attr.itemSize >= 3) arr.push(attr.getZ(i))
        if (attr.itemSize >= 4) arr.push(attr.getW(i))
      }

      geometry.setAttribute(name, new THREE.Float32BufferAttribute(arr, attr.itemSize))
    }
  }

  // Linearly interpolates two transformation matrices
  interpTransformMatrices(alpha, start, end, {result} = {})
  {
    if (!result) result = new THREE.Matrix4
    let startPose = this.pool('startPose', THREE.Vector3)
    let endPose = this.pool('endPose', THREE.Vector3)

    let startQuat = this.pool('startQuat', THREE.Quaternion)
    let endQuat = this.pool('endQuat', THREE.Quaternion)

    let startScale = this.pool('startScale', THREE.Vector3)
    let endScale = this.pool('endScale', THREE.Vector3)

    start.decompose(startPose, startQuat, startScale)
    end.decompose(endPose, endQuat, endScale)
    startPose.lerp(endPose, alpha)
    startQuat.slerp(endQuat, alpha)
    startScale.lerp(endScale, alpha)
    result.compose(startPose, startQuat, startScale)
    return result
  }

  // Returns true if `canvas` has no pixels with an alpha less than 1.0
  isCanvasFullyOpaque(canvas) {
    let ctx = canvas.getContext('2d')
    let data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 3; i < data.data.length; i += 4)
    {
      if (data.data[i] < 255) return false
    }

    return true
  }

  callLater(fn) {
    return new Promise((r, e) => {
      window.setTimeout(() => {
        fn()
        r()
      }, 1)
    })
  }

  // recursiveBoundingBox(object, {box = undefined} = {})
  // {
  //   if (!box) box = new THREE.Box3
  //
  //
  // }
}

const Util = new VARTISTEUtil();

Pool.init(Util)

window.VARTISTE = {Util}

export {Util}

//end utils
//
whenLoaded (entity, fn)
Executes function fn when entity has finished loading, or immediately if it has already loaded. entity may be a single a-entity element, or an array of a-entity elements. If fn is not provided, it will return a Promise that will resolve when entity is loaded (or immediately if entity is already loaded).
//
applyMatrix (matrix, obj)
Copies matrix into obj's (a THREE.Object3D) matrix, and decomposes it to obj's position, rotation, and scale
//
positionObject3DAtTarget (obj, target, {scale, transformOffset, transformRoot} = {})
Moves obj (THREE.Object3D) to the same spot as target (THREE.Object3D), accounting for the various matrix transformations and parentages to get it there.
//
registerComponentSystem (name, obj)
Registers a ComponentSystem. A ComponentSystem is a Component which is automatically added to the a-scene, just like a system. It can be accessed from both sceneEl.systems and sceneEl.components. The main purpose of this is to have auto-registering systems which also have the schema update events of components.
//
traverseAncestors (el, fn)
Executes fn on all ancestors of el
//
// A moveable container for other components, consisting of a handlebar and a
// wood-like background. You can create a mixin with the id `shelf-bg` or
// `shelf-handle` to modify the background or handlebar, respectively.
AFRAME.registerComponent('shelf', {
  dependencies: ['grab-activate', 'bypass-hidden-updates'],
  schema: {
    width: {default: 4},
    height: {default: 3},

    // Background & grabber offset relative to contents
    offset: {type: 'vec3', default: '0 0 0'},

    //  Enables the [frame](#frame) component for the shelf when true
    frame: {default: true},
    closeable: {default: false},
    hideOnly: {default: true},
    pinnable: {default: true},

    grabRoot: {default: true},

    // If this shelf is summoned by a popup button. (Will be set automatically
    // when used with the `popup-button` component)
    popup: {default: false},

    // Title bar
    name: {type: 'string'},
  },
  events: {
    componentchanged: function(e) {
      if (e.detail.name === 'visible')
      {
        this.el.sceneEl.emit('refreshobjects')
      }
    }
  },
  init() {
    var container = document.createElement("a-entity")
    container.innerHTML = shelfHtml
    container.querySelectorAll('.clickable').forEach((e) => e['redirect-grab'] = this.el)
    this.container = container
    this.el.prepend(container)

    if (this.data.grabRoot)
    {
      this.el.classList.add('grab-root')
    }

    let inBillboard = false
    for (let parent = this.el.parentEl; parent; parent = parent.parentEl)
    {
      if (parent.hasAttribute('billboard'))
      {
        inBillboard = true
        break
      }
    }

    if (!inBillboard)
    {
      // this.el.setAttribute('billboard', "")
    }
  },
  update() {
    if (this.container.hasLoaded)
    {
      this.container.querySelector('.bg').setAttribute('geometry', {width: this.data.width, height: this.data.height})
      this.container.setAttribute('position', this.data.offset)

      if (!this.el.hasAttribute('frame') && this.data.frame)
      {
        Util.whenLoaded(this.container.querySelector('.bg'), () => {
          this.el.setAttribute('frame', {
            outline: false,
            closable: this.data.closeable,
            pinnable: this.data.pinnable,
            hideOnly: this.data.hideOnly,
            geometryTarget: this.container.querySelector('.bg'),
            name: this.data.name
          })
        })
      }

      if (this.data.popup && this.data.frame)
      {
        // this.el.setAttribute('six-dof-tool', "reparentOnActivate: true; summonable: false")
        Util.whenLoaded(this.container.querySelector('.bg'), () => {
          this.el.setAttribute('frame', 'closePopup', true)
        })
      }

      let handle = this.container.querySelector('.handle')
      handle.setAttribute('position', `0 -${this.data.height / 2 + handle.getAttribute('geometry').radius} 0`)
      handle.setAttribute('geometry', 'height', this.data.width * 1)
    }
    else
    {
      this.container.addEventListener('loaded', e => this.update())
    }
  }
});
//end shelf
//
// System to handle caching and sharing of materials for icon buttons. At the
// moment, it is best not to change these values dynamically.
AFRAME.registerSystem('icon-button', {
  schema: {
    shader: {default: 'matcap'},
    iconShader: {default: 'flat'},
    matcap: {default: '#asset-matcap', type: 'map'},
    metalness: {default: 0.3},
    roughness: {default: 1.0}
  },
  init() {
    this.width = 0.4
    this.depth = 0.05
    // this.geometry = new THREE.BufferGeometry().fromGeometry(RoundEdgedBox(this.width, this.width, this.depth - 0.005))
    // this.geometry = new THREE.BoxBufferGeometry(this.width, this.width, this.depth - 0.005)
    new THREE.GLTFLoader().load(document.getElementById('asset-button').getAttribute('src'), (gltf) => {
      let scaleMatrix = new THREE.Matrix4().makeScale(this.width, this.width, this.depth - 0.005)
      this.geometry = gltf.scene.getObjectByProperty('type', 'Mesh').geometry
      this.geometry.applyMatrix(scaleMatrix)
    })
    this.frontGeometry = new THREE.PlaneBufferGeometry(this.width - 0.01, this.width - 0.01)
    this.colorManagement = this.el.getAttribute('renderer').colorManagement;

    this.blankFaceMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      alphaTest: 0.01
    })
    this.faceMaterials = {}

    this.bgMaterials = {}

    if (this.data.shader === 'matcap')
    {
      this.bgMaterial = new THREE.MeshMatcapMaterial()
      this.bgMaterial.matcap = new THREE.Texture()
      this.bgMaterial.matcap.image = this.data.matcap
      this.bgMaterial.matcap.encoding = THREE.LinearEncoding
      this.bgMaterial.matcap.needsUpdate = true
    }
    else if (this.data.shader === 'standard')
    {
      this.bgMaterial = new THREE.MeshStandardMaterial({metalness: 0.3, roughness: 1.0})
    }
    else
    {
      this.bgMaterial = new THREE.MeshBasicMaterial()
    }

    this.tmpColor = new THREE.Color()
  }
})

// Creates a square, clickable button with an icon on front.
//
// #### Usage Notes
//
// - Multiple `icon-button` will automatically arrange themselves in a row
// depending on how many siblings it has in its parent element.
// - `icon-button` has an implicit [`propogate-grab`](#propogate-grab), so
//   placing them as children of a grabbable entity will automatically redirect
//   grabs of the icon-button to the grabbable parent.
AFRAME.registerComponent('icon-button', {
  dependencies: ['button-style'],

  // Should be a selector for an image asset, or a texture map (anything that
  // can go into a `material` `map` property should work)
  schema: {type:'string', default: ""},
  events: {
    stateadded: function(e) { this.updateStateColor() },
    stateremoved: function(e) { this.updateStateColor() },
    componentchanged: function(e) { if (e.detail.name === 'button-style') this.updateStateColor() },
    'raycaster-intersected': function(e) { this.el.addState(STATE_HOVERED)},
    'raycaster-intersected-cleared': function(e) { this.el.removeState(STATE_HOVERED)},
  },
  init() {
    let width = this.system.width
    let height = width
    let depth = this.system.depth

    this.state = STATE_NORMAL

    let buttonStyle
    if (this.el.hasAttribute('button-style'))
    {
       buttonStyle = this.el.getAttribute('button-style')
    }
    else
    {
      buttonStyle = DEFAULT_BUTTON_STYLE
    }

    this.style = buttonStyle

    if (buttonStyle.buttonType === 'plane')
    {
      depth = 0.001
    }

    this.el.setObject3D('mesh', new THREE.Mesh(this.system.frontGeometry, this.system.blankFaceMaterial))
    // this.el.setObject3D('mesh', new THREE.Mesh(this.system.frontGeometry, new THREE.MeshStandardMaterial({transparent: true, fog: false)))

    // Inline propogate-grab
    for (let parent = this.el.parentEl; parent; parent = parent.parentEl)
    {
      if (parent['redirect-grab'] || parent.classList.contains('clickable') || parent.classList.contains('grab-root'))
      {
        this.el['redirect-grab'] = parent
        break;
      }
    }

    this.el.classList.add('clickable')

    let indexId = Array.from(this.el.parentEl.children).filter(e => e.hasAttribute('icon-button')).indexOf(this.el)
    this.el.object3D.position.z += depth
    this.el.object3D.position.x += (width + 0.05) * indexId

    let bg;
    if (buttonStyle.buttonType === 'plane')
    {
      bg = new THREE.Mesh(this.system.frontGeometry, this.system.bgMaterial)
      bg.position.set(0,0,- 0.01)
    }
    else
    {
      bg = new THREE.Mesh(this.system.geometry, this.system.bgMaterial)
      bg.position.set(0,0,- depth / 2)
    }

    this.el.getObject3D('mesh').add(bg)
    this.bg = bg

    this.el.addEventListener('click', (e) => {
      this.clickTime = this.el.sceneEl.time
      if (e.detail.cursorEl)
      {
        Sfx.click(e.detail.cursorEl)
      }
      this.addState(STATE_PRESSED)
      //this.setColor(buttonStyle.clickColor)
    })

    this.el.addEventListener('object3dset', (e) => {
      this.updateAspect()
      this.updateStateColor()
    })

    this.updateStateColor()

    this.el.actionTooltips = {trigger: 'Click Button'}

    this.tick = AFRAME.utils.throttleTick(this.tick, 80, this)
  },
  update(oldData) {
    if (this.system.faceMaterials[this.data])
    {
      this.el.getObject3D('mesh').material = this.system.faceMaterials[this.data]
    }
    else
    {
      this.el.setAttribute('material', {
        alphaTest: 0.01,
        color: '#FFF',
        fog: false,
        src: this.data,
        transparent: true,
        shader: this.system.data.iconShader,
        opacity: this.data === "" ? 0.0 : 1.0
      })

      if (!((this.data instanceof HTMLImageElement) || this.data.startsWith("data")))
      {
        this.system.faceMaterials[this.data] = this.el.getObject3D('mesh').material
      }
    }
    this.updateAspect()
  },
  addState(state) {
    this.el.addState(state)
  },
  removeState(state) {
    this.el.removeState(state)
  },
  updateStateColor() {
    if (this.el.is(STATE_PRESSED))
    {
      this.setColor(this.style.clickColor)
      return
    }
    if (this.el.is(STATE_HOVERED))
    {
      this.setColor(this.style.intersectedColor)
      return
    }
    if (this.el.is(STATE_TOGGLED))
    {
      this.setColor(this.style.toggleOnColor)
      return
    }

    this.setColor(this.style.color)
  },
  setColor(color) {
    let threeColor = this.system.tmpColor
    threeColor.setStyle(color)
    if (this.system.colorManagement) threeColor.convertSRGBToLinear()

    if (this.system.bgMaterials[threeColor.getHex()])
    {
      this.bg.material = this.system.bgMaterials[threeColor.getHex()]
    }
    else
    {
      this.bg.material = this.system.bgMaterial.clone()
      this.bg.material.color.copy(threeColor)
      this.bg.material.needsUpdate = true
      this.system.bgMaterials[threeColor.getHex()] = this.bg.material
    }

    // this.bg.material.needsUpdate = true
  },
  updateAspect() {
    return
    if (this.style && this.style.keepAspect)
    {
      let material = this.el.getObject3D('mesh').material
      if (!material || !material.map) return
      let img = material.map.image
      let aspect = img.width / img.height
      // this.el.setAttribute('geometry', {height: 0.4 / aspect})
    }
  },
  tick(t,ts) {
    if (this.clickTime)
    {
      if (t - this.clickTime > 300) {
        let buttonStyle = this.el.components['button-style'].data
        this.removeState(STATE_PRESSED)
      }
    }
  }
})

// Turns an [`icon-button`](#icon-button) into a toggleable button. Can store
// the toggle state internally, or set and track a property on a component.
AFRAME.registerComponent('toggle-button', {
  dependencies: ['icon-button'],
  schema: {
    // Which element contains the component to set the property on
    target: {type: 'selector'},
    // Which component to set the property on
    component: {type: 'string'},
    // Which property to toggle
    property: {type: 'string'},

    // State of being toggled, when not using target and component
    toggled: {type: 'boolean', default: false}
  },
  events: {
    click: function() {
      if (this.data.target)
      {
        if (this.data.property)
        {
          this.data.target.setAttribute(this.data.component, {[this.data.property]: !this.data.target.getAttribute(this.data.component)[this.data.property]})
        }
        else
        {
          this.data.target.setAttribute(this.data.component, !this.data.target.getAttribute(this.data.component))
        }
      }
      else if (this.data.system)
      {
        this.el.sceneEl.systems[this.data.system].data[this.data.property] = !this.el.sceneEl.systems[this.data.system].data[this.data.property]
        this.setToggle(this.el.sceneEl.systems[this.data.system].data[this.data.property])
      }
      else
      {
        this.data.toggled = !this.data.toggled
        this.setToggle(this.data.toggled)
      }
    }
  },
  update(oldData) {
    if (this.data.target !== oldData.target)
    {
      if (oldData.target)
      {
        oldData.target.removeEventListener('componentchanged', this.componentchangedlistener)
      }

      if (this.data.target)
      {
        this.componentchangedlistener = (e) => {
          if (e.detail.name === this.data.component)
          {
            this.setToggle(!!this.data.target.getAttribute(this.data.component)[this.data.property], {update: false})
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.el, this.data.target], () => {
          this.setToggle(!!this.data.target.getAttribute(this.data.component)[this.data.property], {update: false})
        })
      }
      else
      {
        if (this.data.toggled !== oldData.toggled)
        {
          this.setToggle(this.data.toggled)
        }
      }
    }
  },
  setToggle(value) {
    this.data.toggled = value
    if (value)
    {
      this.el.addState(STATE_TOGGLED)
      this.el.components['icon-button'].updateStateColor()
    }
    else
    {
      this.el.removeState(STATE_TOGGLED)
    }
  }
})

// Calls a method of a system or system-component (a component on the scene
// element) when the element recieves a `click` event.
AFRAME.registerComponent('system-click-action', {
  schema: {
    // You should set either system or component
    system: {type: 'string'},
    // You should set either system or component
    component: {type: 'string'},

    // The name of the method to call when clicked
    action: {type: 'string'}
  },
  events: {
    click: function() {
      if (!this.data.action) return;
      console.log("Clicking", this)

      if (this.data.component.length)
      {
        this.el.sceneEl.components[this.data.component][this.data.action]()
      }
      else if (this.data.system.length)
      {
        this.el.sceneEl.systems[this.data.system][this.data.action]()
      }
      else
      {
        try {
          Util.traverseAncestors(this.el, (el) => {
            if (!el.hasAttribute('system-click-action')) return
            let data = el.getAttribute('system-click-action')
            if (data.component)
            {
              this.el.sceneEl.components[data.component][this.data.action]()
              throw 0
            }
            else if (data.system)
            {
              this.el.sceneEl.components[data.system][this.data.action]()
              throw 0
            }
          })
        }
        catch (e) {
          if (e !== 0)
          {
            console.error(e)
          }
        }
      }
    }
  }
})

// Automatically arrange multply rows of `icon-button`s. This will set its
// y-position based on how many icon-rows there are before it in the parent
// element.
AFRAME.registerComponent('icon-row', {
  init() {
    let indexId = Array.from(this.el.parentEl.children).filter(e => e.hasAttribute('icon-row')).indexOf(this.el)
    this.el.object3D.position.y -= (0.4 + 0.1) * indexId
  }
})
//end icon button
//
// Turns an [`icon-button`](#icon-button) into a toggleable button. Can store
// the toggle state internally, or set and track a property on a component.
AFRAME.registerComponent('toggle-button', {
  dependencies: ['icon-button'],
  schema: {
    // Which element contains the component to set the property on
    target: {type: 'selector'},
    // Which component to set the property on
    component: {type: 'string'},
    // Which property to toggle
    property: {type: 'string'},

    // State of being toggled, when not using target and component
    toggled: {type: 'boolean', default: false}
  },
  events: {
    click: function() {
      if (this.data.target)
      {
        if (this.data.property)
        {
          this.data.target.setAttribute(this.data.component, {[this.data.property]: !this.data.target.getAttribute(this.data.component)[this.data.property]})
        }
        else
        {
          this.data.target.setAttribute(this.data.component, !this.data.target.getAttribute(this.data.component))
        }
      }
      else if (this.data.system)
      {
        this.el.sceneEl.systems[this.data.system].data[this.data.property] = !this.el.sceneEl.systems[this.data.system].data[this.data.property]
        this.setToggle(this.el.sceneEl.systems[this.data.system].data[this.data.property])
      }
      else
      {
        this.data.toggled = !this.data.toggled
        this.setToggle(this.data.toggled)
      }
    }
  },
  update(oldData) {
    if (this.data.target !== oldData.target)
    {
      if (oldData.target)
      {
        oldData.target.removeEventListener('componentchanged', this.componentchangedlistener)
      }

      if (this.data.target)
      {
        this.componentchangedlistener = (e) => {
          if (e.detail.name === this.data.component)
          {
            this.setToggle(!!this.data.target.getAttribute(this.data.component)[this.data.property], {update: false})
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.el, this.data.target], () => {
          this.setToggle(!!this.data.target.getAttribute(this.data.component)[this.data.property], {update: false})
        })
      }
      else
      {
        if (this.data.toggled !== oldData.toggled)
        {
          this.setToggle(this.data.toggled)
        }
      }
    }
  },
  setToggle(value) {
    this.data.toggled = value
    if (value)
    {
      this.el.addState(STATE_TOGGLED)
      this.el.components['icon-button'].updateStateColor()
    }
    else
    {
      this.el.removeState(STATE_TOGGLED)
    }
  }
})

// Calls a method of a system or system-component (a component on the scene
// element) when the element recieves a `click` event.
AFRAME.registerComponent('system-click-action', {
  schema: {
    // You should set either system or component
    system: {type: 'string'},
    // You should set either system or component
    component: {type: 'string'},

    // The name of the method to call when clicked
    action: {type: 'string'}
  },
  events: {
    click: function() {
      if (!this.data.action) return;
      console.log("Clicking", this)

      if (this.data.component.length)
      {
        this.el.sceneEl.components[this.data.component][this.data.action]()
      }
      else if (this.data.system.length)
      {
        this.el.sceneEl.systems[this.data.system][this.data.action]()
      }
      else
      {
        try {
          Util.traverseAncestors(this.el, (el) => {
            if (!el.hasAttribute('system-click-action')) return
            let data = el.getAttribute('system-click-action')
            if (data.component)
            {
              this.el.sceneEl.components[data.component][this.data.action]()
              throw 0
            }
            else if (data.system)
            {
              this.el.sceneEl.components[data.system][this.data.action]()
              throw 0
            }
          })
        }
        catch (e) {
          if (e !== 0)
          {
            console.error(e)
          }
        }
      }
    }
  }
})

// Automatically arrange multply rows of `icon-button`s. This will set its
// y-position based on how many icon-rows there are before it in the parent
// element.
AFRAME.registerComponent('icon-row', {
  init() {
    let indexId = Array.from(this.el.parentEl.children).filter(e => e.hasAttribute('icon-row')).indexOf(this.el)
    this.el.object3D.position.y -= (0.4 + 0.1) * indexId
  }
})
//end toggle btn
//
// Calls a method of a system or system-component (a component on the scene
// element) when the element recieves a `click` event.
AFRAME.registerComponent('system-click-action', {
  schema: {
    // You should set either system or component
    system: {type: 'string'},
    // You should set either system or component
    component: {type: 'string'},

    // The name of the method to call when clicked
    action: {type: 'string'}
  },
  events: {
    click: function() {
      if (!this.data.action) return;
      console.log("Clicking", this)

      if (this.data.component.length)
      {
        this.el.sceneEl.components[this.data.component][this.data.action]()
      }
      else if (this.data.system.length)
      {
        this.el.sceneEl.systems[this.data.system][this.data.action]()
      }
      else
      {
        try {
          Util.traverseAncestors(this.el, (el) => {
            if (!el.hasAttribute('system-click-action')) return
            let data = el.getAttribute('system-click-action')
            if (data.component)
            {
              this.el.sceneEl.components[data.component][this.data.action]()
              throw 0
            }
            else if (data.system)
            {
              this.el.sceneEl.components[data.system][this.data.action]()
              throw 0
            }
          })
        }
        catch (e) {
          if (e !== 0)
          {
            console.error(e)
          }
        }
      }
    }
  }
})
//end system-click-action

// Automatically arrange multply rows of `icon-button`s. This will set its
// y-position based on how many icon-rows there are before it in the parent
// element.
AFRAME.registerComponent('icon-row', {
  init() {
    let indexId = Array.from(this.el.parentEl.children).filter(e => e.hasAttribute('icon-row')).indexOf(this.el)
    this.el.object3D.position.y -= (0.4 + 0.1) * indexId
  }
})
//end icon-row
//start edit-field
import {Util} from './util.js'

// App-wide edit field properties
AFRAME.registerSystem('edit-field', {
  schema: {
    // Controls the global scaling of the edit field pop-ups. Applied on top of
    // any individual edit-field popup scaling properties
    popupScale: {type: 'vec3', default: '1 1 1'}
  }
})

// Creates an edit button, which pops up a keyboard to edit the text in the
// elements `text` component. The keyboard can be edited either through clicking
// the 3D buttons with the mouse or laser-controller, or by typing on a physical
// keyboard connected to the computer, or by speech recognition on supported
// browsers.
AFRAME.registerComponent('edit-field', {
  dependencies: ["text", 'popup-button'],
  schema: {
    // Tooltip to go on the edit button
    tooltip: {type: 'string'},

    // What kind of keyboard to pop up. Either 'number' or 'string'
    type: {type: 'string', default: 'number'},

    // [Optional] If set, will edit another elements component property
    target: {type: 'selector'},
    // If `target` is set, this is the component to edit
    component: {type: 'string'},
    // If `target` is set, this is the property to edit
    property: {type: 'string'},

    // When true, this will clear the current value of the property when editing
    // (mainly to avoid the user having to backspace everything)
    autoClear: {type: 'boolean', default: false}
  },
  events: {
    'popuplaunched': function(e) { this.connectKeyboard()},
    'popupclosed': function(e) { this.disconnectKeyboard()}
  },
  init() {
    this.el.setAttribute('popup-button', 'scale', this.system.data.scale)
    this.numpad = this.el.components['popup-button'].popup
    let {numpad} = this

    this.inputField = document.createElement('input')
    this.inputField.classList.add('keyboard-form')
    this.inputField.editField = this
    document.body.append(this.inputField)

    this.inputField.addEventListener('keyup', (e) => {
      if (event.key === "Enter")
      {
        this.ok()
      }
    })

    this.inputField.addEventListener('input', (e) => {
      this.setValue(this.inputField.value)
      // this.numpad.querySelector('.value').setAttribute('text', {value: this.inputField.value})
    })

    numpad.addEventListener('click', e => this.buttonClicked(e))

    this.el.addEventListener('popuplaunched', e => {
      numpad.querySelector('.value').setAttribute('text', {value: this.el.getAttribute('text').value})
      numpad.setAttribute('visible', true)
      numpad.querySelector('*[shelf]').setAttribute('shelf', 'name', this.data.tooltip)
      if (this.data.type === 'number' || this.data.autoClear)
      {
        this.setValue("", {update: false})
      }
    })
  },
  update(oldData) {
    this.el.setAttribute('popup-button', {
      icon: "#asset-lead-pencil",
      tooltip: this.data.tooltip,
      popup: (this.data.type === 'string' ? "keyboard" : "numpad")
    })

    if (this.data.target !== oldData.target)
    {
      if (oldData.target)
      {
        oldData.target.removeEventListener('componentchanged', this.componentchangedlistener)
      }

      if (this.data.target)
      {
        this.componentchangedlistener = (e) => {
          if (e.detail.name === this.data.component)
          {
            this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property].toString(), {update: false})
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.numpad, this.el, this.data.target], () => {
          this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property].toString(), {update: false})
        })
      }
    }
  },
  remove() {
    this.inputField.remove()
  },

  // Directly sets the value of the edit field to `value`
  setValue(value, {update=true} = {}) {
    this.numpad.querySelector('.value').setAttribute('text', {value})
    this.el.setAttribute('text', {value})
    this.inputField.value = value
    if (update && this.data.target)
    {
      this.data.target.setAttribute(this.data.component, {[this.data.property]: value})
    }
  },
  buttonClicked(e) {
    console.log(e)
    let o = e.target.object3D
    let parentVisible = true
    o.traverseAncestors(a => parentVisible = parentVisible && a.visible)

    this.inputField.focus()

    let numpad = this.numpad
    if (e.target.hasAttribute('action'))
    {
      this[e.target.getAttribute('action')](e)
    }
    else if (e.target.hasAttribute('text'))
    {
      let buttonValue = e.target.getAttribute('text').value
      let existingValue = this.el.getAttribute('text').value
      this.setValue(existingValue + buttonValue, {update: false})
    }
  },

  // Backspaces the edited text
  backspace(e) {
    this.setValue(this.el.getAttribute('text').value.slice(0, -1), {update: false})
  },

  // Accepts the edit field popup
  ok(e) {
    this.setValue(this.el.getAttribute('text').value)
    this.el.components['popup-button'].closePopup()
    this.el.emit("editfinished", {value: this.el.getAttribute('text').value})
  },

  // Clears the popup text
  clear(e) {
    this.setValue("")
  },

  // Pastes to the edit field
  async paste(e) {
    this.inputField.focus()
    if (!navigator.clipboard) {
      document.execCommand("paste")
      return
    }

    this.setValue(await navigator.clipboard.readText())
  },
  connectKeyboard() {
    console.log("Connecting keyboard")
    this.inputField.focus()
    // let form = document.createElement('input')
    // this.keyUpListener = e => {
    //   console.log("Keyboard got key", e.key)
    //   let ne = new e.constructor(e.type, e)
    //   form.dispatchEvent(ne)
    //   e.preventDefault()
    //   // e.stopPropagation()
    //   // let buttonValue = e.key
    //   // let existingValue = this.el.getAttribute('text').value
    //   this.setValue(form.value)
    // };
    // document.addEventListener('keyup', this.keyUpListener)
  },
  disconnectKeyboard() {
    this.inputField.blur()
    this.el.sceneEl.canvas.focus()
  }
})

// Creates or uses an [`icon-button`](#icon-button), which when clicked will create a popup at
// the location of the button
AFRAME.registerComponent('popup-button', {
  dependencies: ["text"],
  schema: {
    tooltip: {type: 'string'},
    icon: {type: 'string', default: '#asset-lead-pencil'},

    // Right now, this has to be one of the precompiled VARTISTE partials. I intend to make this more extensible.
    popup: {type: 'string', default: "numpad"},

    // Scale for the popup when shown
    scale: {type: 'vec3', default: '1 1 1'},

    autoScale: {default: false},

    // If true, the popup entity will not be loaded until the button is clicked
    deferred: {type: 'boolean', default: false}
  },
  init() {
    let editButton
    if (!this.el.hasAttribute('icon-button'))
    {
      this.el.setAttribute('text', {align: 'right'})
      let width = this.el.getAttribute('text').width

      editButton = document.createElement('a-entity')
      editButton.setAttribute('position', `${width / 2 + 0.3} 0 0`)
      editButton.setAttribute('icon-button', this.data.icon)
      this.el.append(editButton)
      editButton.addEventListener('click', e => this.launchPopup())
    }
    else
    {
      editButton = this.el
      this.el.addEventListener('click', e => {
        if (e.target === editButton) this.launchPopup()
      })
    }
    this.editButton = editButton

    let popup = document.createElement('a-entity')
    this.popup = popup

    popup.setAttribute('position', '0 0 0.1')
    popup.setAttribute('visible', 'false')

    if (!this.el.hasAttribute('icon-button'))
    {
      this.el.append(popup)
    }
    else {
      this.el.parentEl.append(popup)
    }

    popup.addEventListener('click', e => {
      if (!e.target.hasAttribute('popup-action')) return

      this[e.target.getAttribute('popup-action') + "Popup"]()
      // e.stopPropagation()
    })

    popup.addEventListener('popupaction', e => {
      this[e.detail + "Popup"]()
      e.stopPropagation()
      console.log("Trying to stop propogation", this.el, e)
    })
  },
  update(oldData) {
    if (this.data.tooltip)
    {
      this.editButton.setAttribute('tooltip', this.data.tooltip)
    }
    if (this.data.popup !== oldData.popup && !this.data.deferred)
    {
      this.popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
    }
    if (!this.popupLoaded && !this.data.deferred)
    {
      console.log("Initing popup", this.data.deferred, this.data);
      this.popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
  },

  // Launches the popup
  launchPopup() {
    let popup = this.popup
    if (!this.popupLoaded)
    {
      popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
    if (!this.shelfPopup && popup.children.length === 1 && popup.children[0].hasAttribute('shelf'))
    {
      this.shelfPopup = popup.children[0]
      Util.whenLoaded(this.shelfPopup, () => {
        this.shelfPopup.setAttribute('shelf', 'popup', true)
        this.shelfPopup.addEventListener('popupaction', e => {
          this.popup.emit('popupaction', e.detail)
          e.stopPropagation()
        })
      })
    }
    popup.setAttribute('position', '0 0 0.1')
    popup.object3D.updateMatrixWorld()

    if (!this.data.autoScale)
    {
      let invScale =  popup.object3D.parent.getWorldScale(new THREE.Vector3())
      invScale.x = this.data.scale.x / invScale.x
      invScale.y = this.data.scale.y / invScale.y
      invScale.z = this.data.scale.z / invScale.z
      popup.object3D.scale.copy(invScale)
    }

    popup.setAttribute('visible', true)
    this.el.sceneEl.emit('refreshobjects')
    this.el.emit('popuplaunched')
    if (this.shelfPopup)
    {
      Util.whenLoaded(this.shelfPopup, () => this.shelfPopup.emit('popupshown'))
    }
    else
    {
      popup.emit('popupshown')
    }
  },

  // Closes the popup
  closePopup() {
    this.popup.setAttribute('visible', false)
    this.popup.setAttribute('position', '0 -999999 0.1')
    this.el.emit('popupclosed');
    (this.shelfPopup || this.popup).emit('popuphidden')
  }
})

AFRAME.registerComponent('not-frustum-culled', {
  events: {
    object3dset: function(e) {
      this.el.object3D.traverse(o => o.frustumCulled = false)
    }
  },
  init() {
    this.el.object3D.frustumCulled = false
  }
})

//

//

//

//

//