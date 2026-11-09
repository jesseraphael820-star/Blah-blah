// Ribbon trail that follows a sword's base and tip during swings.
import * as THREE from 'three';

export class SwordTrail {
  constructor(scene, n = 14) {
    this.n = n;
    this.pts = [];
    const pos = new Float32Array(n * 2 * 3);
    const alpha = new Float32Array(n * 2);
    const idx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aAttr = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('alpha', this.aAttr);
    this.geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 1 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ float a = floor(vA * uOpacity * 4.0) / 4.0; if (a < 0.02) discard; gl_FragColor = vec4(uColor * a, a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.active = false;
    this.fade = 0;
  }
  setColor(hex) { this.mat.uniforms.uColor.value.setHex(hex); }
  push(base, tip) {
    this.pts.unshift([base.clone(), tip.clone()]);
    if (this.pts.length > this.n) this.pts.pop();
  }
  update(dt, emitting) {
    if (emitting) this.fade = 1; else this.fade = Math.max(0, this.fade - dt * 5);
    if (!emitting && this.pts.length && this.fade <= 0) this.pts.length = 0;
    this.mesh.visible = this.pts.length > 1 && this.fade > 0;
    if (!this.mesh.visible) return;
    const P = this.posAttr.array, A = this.aAttr.array;
    const last = this.pts[this.pts.length - 1];
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[i] || last;
      P.set([p[0].x, p[0].y, p[0].z], i * 6);
      P.set([p[1].x, p[1].y, p[1].z], i * 6 + 3);
      const a = this.pts[i] ? (1 - i / this.n) : 0;
      A[i * 2] = a * 0.15; A[i * 2 + 1] = a * 0.9;
    }
    this.mat.uniforms.uOpacity.value = this.fade;
    this.posAttr.needsUpdate = true; this.aAttr.needsUpdate = true;
  }
}
