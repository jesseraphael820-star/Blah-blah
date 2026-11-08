const {chromium}=require('playwright');const fs=require('fs');
(async()=>{
 const [,,mode]=process.argv;const fps=30;
 const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:1080,height:1920}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+__dirname+'/index.html');await p.waitForFunction('window.renderAt');
 const total=await p.evaluate('TOTAL');fs.writeFileSync('cuts.json',JSON.stringify({cuts:await p.evaluate('CUTS'),events:await p.evaluate('EVENTS'),total}));
 fs.mkdirSync('frames',{recursive:true});
 const times=mode=='test'?(process.argv[3]?JSON.parse(process.argv[3]):[1.5,3.2,6.5,10.5,14.5,19,23.5,28,32,36]):[...Array(Math.round(total*fps)).keys()].map(i=>i/fps);
 let n=0;for(const t of times){await p.evaluate(t=>renderAt(t),t);
  await p.screenshot({path:mode=='test'?`test_${n}.jpg`:`frames/f${String(n).padStart(5,'0')}.jpg`,type:'jpeg',quality:90});n++}
 console.log('total',total);await b.close()})();
