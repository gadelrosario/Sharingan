/* Local durable inbox only. No provider requests, credentials or external delivery. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NFLProactiveSyncV1=api;})(globalThis,function(){
'use strict';
function create({fetchFn=globalThis.fetch,base='https://localhost:8787',scope}={}) {
  async function request(path,body) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);
    try {
      const response=await fetchFn(base+'/api/nfl-monitoring/'+path,{method:body?'POST':'GET',
        cache:'no-store',signal:controller.signal,headers:body?{'Content-Type':'application/json'}:{},
        ...(body?{body:JSON.stringify({scope,...body})}:{})});
      if(!response.ok)throw Error('Durable state unavailable or persistence not approved');
      const result=await response.json();
      if(result.state&&result.state.key!==scope)throw Error('Durable scope mismatch');
      return result;
    } finally {clearTimeout(timer);}
  }
  return {load:()=>request('state?scope='+encodeURIComponent(scope)),
    checkpoint:(state,revision)=>request('checkpoint',{state,revision}),
    interact:(id,action,at)=>request('interaction',{id,action,at}),
    preferences:preferences=>request('preferences',{preferences})};
}
return {create};
});
