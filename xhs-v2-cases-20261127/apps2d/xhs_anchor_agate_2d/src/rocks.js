import { rng, TAU, polygon, roundRect, text } from './math.js';
const r=rng(3811);
export const dust=Array.from({length:46},()=>({x:r(),y:r(),size:.5+r()*1.4,speed:r(),phase:r()*TAU,side:r()}));
export const rockFacets=Array.from({length:60},()=>({x:r(),y:r(),w:2+r()*8,h:2+r()*7,c:r()}));

export function drawRock(ctx,x,y,scale,seed=1) {
  const rand=rng(seed);ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(0,20,62,12,0,0,TAU);ctx.fill();
  const pts=[[-52,12],[-46,-12],[-20,-30],[17,-33],[48,-13],[55,10],[31,26],[-16,30]];polygon(ctx,pts);
  const g=ctx.createLinearGradient(0,-30,0,30);g.addColorStop(0,'#8e8673');g.addColorStop(.3,'#57594f');g.addColorStop(.6,'#393b34');g.addColorStop(1,'#242923');ctx.fillStyle=g;ctx.fill();
  ctx.save();polygon(ctx,pts);ctx.clip();
  for(let i=0;i<90;i++){
    const xx=-55+rand()*115,yy=-35+rand()*70,w=1+rand()*7,h=1+rand()*5;
    polygon(ctx,[[xx-w,yy],[xx,yy-h],[xx+w,yy+1],[xx+1,yy+h]]);
    ctx.fillStyle=`rgba(${100+rand()*80},${90+rand()*65},${70+rand()*65},${.16+rand()*.3})`;ctx.fill();
  }
  for(let i=0;i<6;i++){
    ctx.beginPath();ctx.moveTo(-60,i*9-21);ctx.bezierCurveTo(-25,i*8-30,10,i*12-5,62,i*7-15);ctx.strokeStyle='rgba(217,207,173,.27)';ctx.lineWidth=1.5;ctx.stroke();
  }
  ctx.restore();polygon(ctx,pts);ctx.strokeStyle='#b7aa8755';ctx.lineWidth=.8;ctx.stroke();ctx.restore();
}
