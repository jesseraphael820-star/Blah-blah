// Stub mínimo de canvas para testes em Node (sem renderização real)
class Ctx { constructor(c){this.canvas=c;} createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};} putImageData(){} drawImage(){} fillRect(){} clearRect(){} translate(){} scale(){} save(){} restore(){} beginPath(){} arc(){} fill(){} stroke(){} moveTo(){} lineTo(){} createRadialGradient(){return {addColorStop(){}}} getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)};} }
globalThis.OffscreenCanvas = class { constructor(w,h){this.width=w;this.height=h;} getContext(){ return this._c || (this._c = new Ctx(this)); } };
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
