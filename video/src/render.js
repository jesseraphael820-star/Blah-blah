const {chromium}=require('playwright');const fs=require('fs');
(async()=>{
 const [,,mode,fpsArg]=process.argv;const fps=+fpsArg||30;
 const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:1920,height:1080}});
 p.on('console',m=>console.log('PAGE',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+__dirname+'/index.html');await p.waitForFunction('window.renderAt');
 const total=await p.evaluate('TOTAL');
 fs.mkdirSync('frames',{recursive:true});
 const times=mode=='test'?[3,5,14,23,32,41,50,59,68,77,83]:[...Array(Math.round(total*fps)).keys()].map(i=>i/fps);
 let n=0;
 for(const t of times){await p.evaluate(t=>renderAt(t),t);
  await p.screenshot({path:mode=='test'?`test_${t}.jpg`:`frames/f${String(n).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});n++;
  if(n%150==0)console.log(n,'/',times.length)}
 console.log('total',total);await b.close()})();
