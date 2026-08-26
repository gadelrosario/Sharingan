(function(root){
  'use strict';
  const APP_VERSION=Object.freeze({phase:'Jōnin',milestone:'4.4.3',label:'Jōnin 4.4.3'});
  function applyVersionMetadata(documentRef){
    if(!documentRef)return;
    documentRef.title=`Gerard Fantasy HQ — ${APP_VERSION.label}`;
    documentRef.documentElement.dataset.appVersion=APP_VERSION.label;
    documentRef.querySelectorAll('[data-app-version]').forEach(node=>{
  if(node !== documentRef.documentElement){
    node.textContent=APP_VERSION.label;
  }
});
  }
  root.FantasyHQAppVersion=APP_VERSION;
  root.applyFantasyHQVersion=applyVersionMetadata;
  if(root.document){applyVersionMetadata(root.document);root.document.addEventListener('DOMContentLoaded',()=>applyVersionMetadata(root.document),{once:true});}
  if(typeof module!=='undefined'&&module.exports)module.exports=Object.freeze({APP_VERSION,applyVersionMetadata});
})(typeof window!=='undefined'?window:globalThis);
