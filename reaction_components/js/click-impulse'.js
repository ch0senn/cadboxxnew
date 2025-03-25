AFRAME.registerComponent('click-impulse', {
        init: function () {
          var el = this.el;
          
          el.addEventListener('click', function () {
            el.body.applyImpulse(
            /* impulse */
            new CANNON.Vec3(
             THREE.Math.randInt(-20, 20),
             THREE.Math.randInt(-20, 20),
             THREE.Math.randInt(-20, 20)
            ),
            /* world position */ new CANNON.Vec3().copy(el.getDOMAttribute('position'))
            ); 
          });
          
        }
      });