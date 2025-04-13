AFRAME.registerComponent("gui", {
        schema: {
          name: { type: "string" },
          properties: { type: "array" },
          position: { type: "vec3" },
          inheritPosition: { default: false }
        },
        init: function() {
          // setup mouse interaction
          var that = this;
          this.el.sceneEl.addEventListener("camera-set-active", function() {
            const scene = that.el.sceneEl.object3D;
            const { camera, renderer } = that.el.sceneEl;
            const gazeInput = dat.GUIVR.addInputObject(camera);
      
            dat.GUIVR.enableMouse(camera, renderer);
            scene.add(gazeInput.cursor);
    
            ['mousedown','touchstart']
            .forEach( function(e){
                window.addEventListener(e, function(){
                    gazeInput.pressed( true );
                }, false );
            });
    
            ['mouseup','touchend']
            .forEach( function(e){
                window.addEventListener(e, function(){
                    gazeInput.pressed( false );
                }, false );
            });
          });
      
          var scene = this.el.sceneEl.object3D;
          var gui = dat.GUIVR.create(this.data.name);
          //console.log("pos:", this.el.object3D.position.clone());
          var guiPos = new THREE.Vector3(0, 0, 0);
          if (this.data.position) {
            ["x", "y", "z"].forEach(function(axis) {
              guiPos[axis] = this[axis];
            }, this.data.position);
          }
          if (this.data.inheritPosition) {
            ["x", "y", "z"].forEach(function(axis) {
              guiPos[axis] += this[axis];
            }, this.el.object3D.position);
          }
          gui.position.set(guiPos.x, guiPos.y, guiPos.z);
      
          //console.log("data:", this.data.properties);
          var thisObject = this.el.object3D;
          this.data.properties.forEach(function(prop) {
            prop = prop.split(".");
            console.log("len", prop.length);
            var min = 0;
            var max = 10;
            if (prop.length == 1) {
              gui.add(thisObject[prop[0]], min, max);
            } else {
              var propController = gui.add(thisObject[prop[0]], prop[1], min, max);
              propController.name(prop[0] + "." + prop[1]);
            }
          });
          gui.name = this.data.name + "GUI";
          scene.add(gui);
        }
      });