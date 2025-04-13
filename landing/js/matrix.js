export const schema = { type: 'array' };
export function update() {
  var object3D = this.el.object3D;
  var data = this.data;
  object3D.matrix.fromArray(data);
}
