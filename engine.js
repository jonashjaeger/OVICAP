/* OVICAP v1.0 scientific engine. No external dependencies. */
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OVICAP = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const VERSION = '1.0.0';
  const DEMO = {
    id:'karleby-example', name:'Karleby 63 + 194 · worked example', site:'Karleby 63 + 194', period:'Middle Neolithic',
    morphSheep:9, morphGoat:0, ambiguous:1437,
    zooSheep:33, zooGoat:0, zooOther:1, zooFail:11,
    strategy:'targeted', threeTaxa:true, prior:0.5,
    notes:'Illustrative reconstruction: total 1,446 caprine NISP and 9 morphologically identified sheep from the paper; remaining 1,437 provisionally placed in the ambiguous pool. Sample counts 33 sheep, 0 goat, 1 deer, 11 inconclusive. Not a published assemblage-level allocation or random sample.'
  };
  function emptyScenario(){return {id:'',name:'Untitled assemblage',site:'',period:'',morphSheep:0,morphGoat:0,ambiguous:0,zooSheep:0,zooGoat:0,zooOther:0,zooFail:0,strategy:'unknown',threeTaxa:true,prior:0.5,notes:''};}
  const integerKeys=['morphSheep','morphGoat','ambiguous','zooSheep','zooGoat','zooOther','zooFail'];
  function normalize(input){
    const x={...emptyScenario(),...input};
    for(const k of integerKeys) x[k]=Number(x[k]);
    x.prior=Number(x.prior);
    x.threeTaxa=(x.threeTaxa===true || x.threeTaxa==='true' || x.threeTaxa===1 || x.threeTaxa==='1');
    if(!['random','targeted','unknown'].includes(x.strategy)) x.strategy='unknown';
    return x;
  }
  function validate(input){
    const x=normalize(input), errors=[];
    for(const k of integerKeys){if(!Number.isSafeInteger(x[k]) || x[k]<0 || x[k]>2000000)errors.push(k+' must be a non-negative whole number (maximum 2,000,000).');}
    if(!(x.prior>0 && x.prior<=25))errors.push('Prior concentration must be greater than 0 and no greater than 25.');
    const tested=x.zooSheep+x.zooGoat+x.zooOther+x.zooFail;
    if(tested>x.ambiguous)errors.push('ZooMS analyses cannot exceed the ambiguous NISP pool. Do not count sampled fragments twice.');
    return {x,errors,tested,diagnostic:x.zooSheep+x.zooGoat+x.zooOther,remaining:x.ambiguous-x.zooSheep-x.zooGoat-x.zooOther};
  }
  // Deterministic xorshift32 generator for repeatable scenarios.
  function rng(seed=7919){let s=(seed>>>0)||1;return function(){s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)+0.5)/4294967296;};}
  function normal(r){return Math.sqrt(-2*Math.log(Math.max(1e-15,r())))*Math.cos(2*Math.PI*r());}
  function gamma(k,r){
    if(k<=0)throw Error('Gamma shape must be > 0');
    if(k<1) return gamma(k+1,r)*Math.pow(r(),1/k);
    const d=k-1/3,c=1/Math.sqrt(9*d);
    for(;;){let z=normal(r),v=1+c*z;if(v<=0)continue;v=v*v*v;const u=r();if(u<1-0.0331*Math.pow(z,4)||Math.log(u)<0.5*z*z+d*(1-v+Math.log(v)))return d*v;}
  }
  function beta(a,b,r){let x=gamma(a,r),y=gamma(b,r);return x/(x+y);}
  // Exact binomial variate in O(log n) beta-variate splits, with
  // direct Bernoulli draws for a small remainder.
  function binomial(n,p,r){
    if(p<=0)return 0;if(p>=1)return n;
    let acc=0;
    while(n>20){
      const k=Math.floor(n/2)+1;
      const x=beta(k,n-k+1,r);
      if(x<p){acc+=k;n-=k;p=(p-x)/(1-x);}else{n=k-1;p=p/x;}
      p=Math.max(0,Math.min(1,p));
      if(p<=0)return acc;if(p>=1)return acc+n;
    }
    for(let i=0;i<n;i++)if(r()<p)acc++;
    return acc;
  }
  function quantile(sorted,q){if(!sorted.length)return null;const j=(sorted.length-1)*q,lo=Math.floor(j),hi=Math.ceil(j);return sorted[lo]+(sorted[hi]-sorted[lo])*(j-lo);}
  function stat(arr){const sorted=[...arr].sort((a,b)=>a-b);return {mean:arr.reduce((a,b)=>a+b,0)/arr.length,lo:quantile(sorted,.025),median:quantile(sorted,.5),hi:quantile(sorted,.975)};}
  function estimate(input,{draws=6000,seed=20261019}={}){
    const v=validate(input);if(v.errors.length)throw new Error(v.errors.join(' '));
    const x=v.x,r=rng(seed),a=x.prior,remaining=v.remaining;
    const s=[],g=[],o=[],prop=[],totalCaprines=[];
    let aboveOnePercent=0;
    for(let i=0;i<draws;i++){
      const S=gamma(x.zooSheep+a,r),G=gamma(x.zooGoat+a,r);
      const O=x.threeTaxa?gamma(x.zooOther+a,r):0;
      const den=S+G+O,ps=S/den,pg=G/den;
      const nS=binomial(remaining,ps,r);
      const nG=binomial(remaining-nS,pg/(1-ps),r);
      const nO=remaining-nS-nG;
      const sv=x.morphSheep+x.zooSheep+nS,gv=x.morphGoat+x.zooGoat+nG,ov=x.zooOther+nO;
      s.push(sv);g.push(gv);o.push(ov);totalCaprines.push(sv+gv);
      const goatShare=G/(S+G);prop.push(goatShare*100);
      if(goatShare>=1/100)aboveOnePercent++;
    }
    return {input:x,flags:flags(v),draws, observedTotal:x.morphSheep+x.morphGoat+x.ambiguous,
      tested:v.tested, diagnostic:v.diagnostic, unresolved:remaining, confirmationRate:v.tested?v.diagnostic/v.tested:null,
      sheep:stat(s),goat:stat(g),other:stat(o),caprines:stat(totalCaprines),goatPercent:stat(prop),
      pGoatAtLeast1pc:aboveOnePercent/draws, distributions:{sheep:s,goat:g,other:o,goatPercent:prop}};
  }
  function flags(v){const x=v.x, warnings=[];
    if(x.strategy!=='random')warnings.push(x.strategy==='targeted'?'Targeted sampling: extrapolation is a scenario only; posterior intervals do not correct for element/context selection.':'Sampling design unknown: extrapolation relies on an unverified representativeness assumption.');
    if(v.diagnostic===0)warnings.push('No successful taxonomic results: the estimates depend entirely on the prior.');
    if(v.tested && x.zooFail/v.tested>.25)warnings.push('High ZooMS failure rate: species-dependent success could bias the distribution.');
    if(!x.threeTaxa && x.zooOther>0)warnings.push('Two-taxon mode assumes no additional non-caprines among unresolved remains; known non-caprines stay excluded.');
    if(x.morphSheep+x.morphGoat>0)warnings.push('Morphologically species-specific NISP are treated as correct and are not uncertainty-adjusted.');
    warnings.push('NISP estimates are numbers of bone/tooth specimens, not numbers of individual animals.');
    return warnings;
  }
  function detectionBinomial(p,n,q=1){if(n<=0||p<=0||q<=0)return 0;return -Math.expm1(n*Math.log1p(-Math.min(1,p*q)));}
  function detectionFinite(N,K,n){
    N=Math.floor(N);K=Math.floor(K);n=Math.floor(n);
    if(!(N>0&&K>=0&&K<=N&&n>=0&&n<=N))return null;
    if(K===0||n===0)return 0;if(n>N-K)return 1;
    let logP0=0;
    // Equivalent products: choose the shorter for large finite assemblages.
    if(n<=K){for(let i=0;i<n;i++)logP0+=Math.log1p(-K/(N-i));}
    else{for(let i=0;i<K;i++)logP0+=Math.log1p(-n/(N-i));}
    return -Math.expm1(logP0);
  }
  function sampleTarget(p,q,confidence=.95){if(!(p>0&&q>0&&p<=1&&q<=1&&confidence>0&&confidence<1))return null;return Math.ceil(Math.log1p(-confidence)/Math.log1p(-p*q));}
  function zeroSuccessUpper(n,confidence=.95){if(!n)return null;return 1-Math.pow(1-confidence,1/n);}
  function escapeCsv(v){const s=String(v==null?'':v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function toCSV(rows){if(!rows.length)return '';const cols=Object.keys(rows[0]);return [cols.join(','),...rows.map(row=>cols.map(k=>escapeCsv(row[k])).join(','))].join('\r\n')+'\r\n';}
  // Small RFC 4180 parser; handles quoted commas, quotes and multiline cells.
  function parseCSV(text){let rows=[],row=[],val='',inside=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];if(inside){if(c==='"'&&text[i+1]==='"'){val+='"';i++;}else if(c==='"')inside=false;else val+=c;}
      else if(c==='"')inside=true;else if(c===','){row.push(val);val='';}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(val);if(row.some(c=>c.trim()!==''))rows.push(row);row=[];val='';}
      else val+=c;
    }
    if(inside)throw Error('CSV has an unclosed quoted field.');
    if(val.length||row.length){row.push(val);if(row.some(c=>c.trim()!==''))rows.push(row);}
    if(!rows.length)return [];
    const headers=rows.shift().map(s=>s.replace(/^\uFEFF/,'').trim());
    return rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));
  }
  const CSV_FIELDS=['name','site','period','morphSheep','morphGoat','ambiguous','zooSheep','zooGoat','zooOther','zooFail','strategy','threeTaxa','prior','notes'];
  function scenarioRows(arr){return arr.map(x=>Object.fromEntries(CSV_FIELDS.map(k=>[k,x[k]??''])));}
  return {VERSION,DEMO,emptyScenario,integerKeys,normalize,validate,rng,gamma,beta,binomial,estimate,flags,stat,
    detectionBinomial,detectionFinite,sampleTarget,zeroSuccessUpper,toCSV,parseCSV,CSV_FIELDS,scenarioRows};
});
