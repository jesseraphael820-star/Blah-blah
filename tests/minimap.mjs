import './shim.js';
import zlib from 'node:zlib'; import fs from 'node:fs';
import { generateWorld } from '../src/world/gen.js';
const m = generateWorld();
const C = {0:[92,154,62],1:[47,94,42],2:[138,106,68],3:[200,170,110],4:[227,207,143],5:[50,119,160],6:[30,80,120],7:[62,90,58],8:[74,61,42],9:[232,241,246],10:[182,219,238],11:[122,112,104],12:[70,60,55],13:[94,89,85],14:[200,190,180],15:[125,82,50],16:[160,100,50],20:[110,74,44],21:[138,132,122],23:[76,90,44]};
const S=2, W=m.w*S, H=m.h*S; const raw=Buffer.alloc((W*3+1)*H);
for(let y=0;y<H;y++){raw[y*(W*3+1)]=0;for(let x=0;x<W;x++){const t=m.get((x/S)|0,(y/S)|0);const c=C[t]||[255,0,255];const i=y*(W*3+1)+1+x*3;raw[i]=c[0];raw[i+1]=c[1];raw[i+2]=c[2];}}
for(const o of m.objects){ if(o.kind!=='tree'&&o.kind!=='building'&&o.kind!=='flag') continue; const x=(o.x/16*S)|0,y=(o.y/16*S)|0; if(x<0||y<0||x>=W||y>=H)continue; const c=o.kind==='tree'?[20,50,20]:o.kind==='flag'?[255,0,0]:[255,255,0]; const i=y*(W*3+1)+1+x*3; raw[i]=c[0];raw[i+1]=c[1];raw[i+2]=c[2]; }
const crc=(b)=>{let c,crc=0xffffffff;for(let n=0;n<b.length;n++){c=(crc^b[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xffffffff)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
fs.writeFileSync(process.argv[2],png);
