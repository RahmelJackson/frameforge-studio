// Minimal QR Code encoder (byte mode, error correction level M, versions 1–10)
// for short pairing links. Returns a square matrix of booleans (true = dark).
const BLOCKS=[null,[10,[[1,16]]],[16,[[1,28]]],[26,[[1,44]]],[18,[[2,32]]],[24,[[2,43]]],[16,[[4,27]]],[18,[[4,31]]],[22,[[2,38],[2,39]]],[22,[[3,36],[2,37]]],[26,[[4,43],[1,44]]]];
const ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
const EXP=new Uint8Array(512),LOG=new Uint8Array(256);{let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d;}for(let i=255;i<512;i++)EXP[i]=EXP[i-255];}
const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
function generator(n){let g=[1];for(let i=0;i<n;i++){const next=new Array(g.length+1).fill(0);g.forEach((c,j)=>{next[j]^=c;next[j+1]^=mul(c,EXP[i]);});g=next;}return g;}
function ecc(data,n){const g=generator(n),r=[...data,...new Array(n).fill(0)];for(let i=0;i<data.length;i++){const f=r[i];if(f)for(let j=0;j<g.length;j++)r[i+j]^=mul(g[j],f);}return r.slice(data.length);}
function bch(value,poly,bits){let v=value<<bits;const top=Math.floor(Math.log2(poly));while(v&&Math.floor(Math.log2(v))>=top)v^=poly<<(Math.floor(Math.log2(v))-top);return (value<<bits)|v;}
export function qrMatrix(text){
 const bytes=[...new TextEncoder().encode(text)];let version=1;
 for(;version<=10;version++){const [,groups]=BLOCKS[version],cap=groups.reduce((n,[c,d])=>n+c*d,0),need=4+(version<10?8:16)+bytes.length*8;if(need<=cap*8)break;}
 if(version>10)throw Error('Text is too long for this QR encoder.');
 const [ecLen,groups]=BLOCKS[version],dataCap=groups.reduce((n,[c,d])=>n+c*d,0);
 const bits=[];const push=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>i)&1);};
 push(4,4);push(bytes.length,version<10?8:16);for(const b of bytes)push(b,8);
 push(0,Math.min(4,dataCap*8-bits.length));while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(''),2));for(let pad=0;data.length<dataCap;pad++)data.push(pad%2?0x11:0xec);
 const blocks=[];let at=0;for(const [count,size] of groups)for(let i=0;i<count;i++){const d=data.slice(at,at+size);at+=size;blocks.push({d,e:ecc(d,ecLen)});}
 const codewords=[];const maxD=Math.max(...blocks.map(b=>b.d.length));for(let i=0;i<maxD;i++)for(const b of blocks)if(i<b.d.length)codewords.push(b.d[i]);for(let i=0;i<ecLen;i++)for(const b of blocks)codewords.push(b.e[i]);
 const size=version*4+17,m=Array.from({length:size},()=>new Array(size).fill(null)),fixed=Array.from({length:size},()=>new Array(size).fill(false));
 const set=(r,c,v)=>{m[r][c]=v;fixed[r][c]=true;};
 const finder=(r,c)=>{for(let y=-1;y<=7;y++)for(let x=-1;x<=7;x++){const rr=r+y,cc=c+x;if(rr<0||cc<0||rr>=size||cc>=size)continue;const inner=y>=0&&y<=6&&x>=0&&x<=6&&(y===0||y===6||x===0||x===6||(y>=2&&y<=4&&x>=2&&x<=4));set(rr,cc,inner);}};
 finder(0,0);finder(0,size-7);finder(size-7,0);
 for(let i=8;i<size-8;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 const pos=ALIGN[version],last=pos.length-1;pos.forEach((r,i)=>pos.forEach((c,j)=>{if(i===0&&j===0||i===0&&j===last||i===last&&j===0)return;for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)set(r+y,c+x,Math.max(Math.abs(x),Math.abs(y))!==1);}));
 set(size-8,8,true);
 for(let i=0;i<9;i++){if(!fixed[8][i])set(8,i,false);if(!fixed[i][8])set(i,8,false);}for(let i=0;i<8;i++){set(8,size-1-i,false);set(size-1-i,8,false);}
 if(version>=7){const v=bch(version,0x1f25,12);for(let i=0;i<18;i++){const bit=((v>>i)&1)===1,a=Math.floor(i/3),b=i%3+size-11;set(a,b,bit);set(b,a,bit);}}
 const stream=codewords.flatMap(c=>Array.from({length:8},(_,i)=>(c>>(7-i))&1));let k=0,up=true;
 for(let col=size-1;col>0;col-=2){if(col===6)col--;for(let n=0;n<size;n++){const r=up?size-1-n:n;for(let d=0;d<2;d++){const c=col-d;if(fixed[r][c])continue;m[r][c]=k<stream.length?stream[k]===1:false;k++;}}up=!up;}
 const masks=[(r,c)=>(r+c)%2===0,(r)=>r%2===0,(r,c)=>c%3===0,(r,c)=>(r+c)%3===0,(r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,(r,c)=>(r*c)%2+(r*c)%3===0,(r,c)=>((r*c)%2+(r*c)%3)%2===0,(r,c)=>((r+c)%2+(r*c)%3)%2===0];
 const withFormat=(grid,mask)=>{const f=bch((0<<3)|mask,0x537,10)^0x5412,bit=i=>((f>>i)&1)===1,g=grid.map(row=>row.slice());
  for(let i=0;i<=5;i++)g[i][8]=bit(i);g[7][8]=bit(6);g[8][8]=bit(7);g[8][7]=bit(8);for(let i=9;i<15;i++)g[8][14-i]=bit(i);
  for(let i=0;i<8;i++)g[8][size-1-i]=bit(i);for(let i=8;i<15;i++)g[size-15+i][8]=bit(i);g[size-8][8]=true;return g;};
 const penalty=g=>{let p=0;for(let r=0;r<size;r++)for(const line of [g[r],g.map(row=>row[r])]){let run=1;for(let i=1;i<size;i++){if(line[i]===line[i-1]){run++;if(run===5)p+=3;else if(run>5)p++;}else run=1;}const s=line.map(v=>v?1:0).join('');p+=40*((s.match(/(?=10111010000|00001011101)/g)??[]).length);}
  for(let r=0;r<size-1;r++)for(let c=0;c<size-1;c++){const v=g[r][c];if(v===g[r+1][c]&&v===g[r][c+1]&&v===g[r+1][c+1])p+=3;}const dark=g.flat().filter(Boolean).length;p+=Math.floor(Math.abs(dark*100/(size*size)-50)/5)*10;return p;};
 let best=null;for(let mask=0;mask<8;mask++){const g=m.map((row,r)=>row.map((v,c)=>fixed[r][c]?v:v!==masks[mask](r,c)));const f=withFormat(g,mask),score=penalty(f);if(!best||score<best.score)best={score,f};}
 return best.f;
}
export function qrSvg(text,{border=4}={}){const g=qrMatrix(text),n=g.length+border*2;let d='';g.forEach((row,r)=>row.forEach((v,c)=>{if(v)d+=`M${c+border},${r+border}h1v1h-1z`;}));return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;}
