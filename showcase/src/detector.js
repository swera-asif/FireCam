// Experimental heuristics, not a trained model or validated fire detector.
// Red/orange moving pixels and moving neutral pixels can be lamps, people,
// steam, or exposure changes. Absence of a cue never establishes safety.
export function inspectFrame(rgba, previous=null) {
  if(!rgba?.length || rgba.length%4) throw Error('Invalid image frame');
  const count=rgba.length/4; let bright=0,warm=0,flicker=0,haze=0,motion=0;
  const temporal=previous?.length===rgba.length;
  for(let p=0;p<rgba.length;p+=4){
    const [r,g,b]=[rgba[p],rgba[p+1],rgba[p+2]];
    const light=(r+g+b)/3; bright+=light;
    const delta=temporal?(Math.abs(r-previous[p])+Math.abs(g-previous[p+1])+Math.abs(b-previous[p+2]))/3:0;
    if(delta>20)motion++;
    if(r>155&&g>65&&r>g*1.12&&g>b*1.2){warm++;if(delta>16)flicker++;}
    if(light>65&&light<220&&Math.max(r,g,b)-Math.min(r,g,b)<24&&temporal&&delta>12)haze++;
  }
  const warmFraction=warm/count,flickerFraction=flicker/count,hazeFraction=haze/count,motionFraction=motion/count;
  const obscured=bright/count<20 || (temporal&&motionFraction>.8);
  // Only part of a real flame changes between one-second frames, so a warm region counts once
  // some of it flickers; a still orange object stays quiet.
  const flame=warmFraction>.025&&(!temporal||flickerFraction>.005);
  return {
    label:obscured?'Uncertain — dark view or camera/exposure movement':flame?'Possible flame-colour cue — review required':hazeFraction>.06?'Possible smoke/steam motion cue — review required':'No configured cue found — safety unknown',
    cue:!obscured&&(flame||hazeFraction>.06),
    obscured, temporal,
    detail:temporal?'Compared two frames using colour and motion rules. Smoke and steam cannot be reliably distinguished.':'Single-image colour check only. Motion and smoke rules need consecutive frames.',
    warmFraction,flickerFraction,hazeFraction,motionFraction
  };
}
export class CuePersistence {
  constructor(){this.hits=0;}
  next(result){this.hits=result.cue?this.hits+1:0;return this.hits>=3;}
}
