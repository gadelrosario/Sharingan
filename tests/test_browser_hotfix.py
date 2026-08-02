import json
import pathlib
import re
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class BrowserHotfixTests(unittest.TestCase):
    def test_browser_dom_references_are_explicit(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        explicit_ids = {
            "poolStatus", "draftSlot", "managerSetup", "practiceChoice", "yahooChoice",
            "liveChoice", "mockRandomizer", "setupScreen", "appScreen", "draftReport",
            "changeBtn", "tabs", "modeBanner", "recommendation", "alternatives",
            "desktopBoard", "draftBoard", "roster", "mRoster", "strategies", "mStrategies",
            "round", "mRound", "pickLabel", "mPickLabel", "until", "mUntil",
            "myDraftReport", "leagueProjection", "allTeamReports", "yahooExportCard",
            "archiveCount", "desktopManagerTable", "sheetManagerTable", "managerRosterDetail",
        }
        dom_block = source.split("const DOM = Object.freeze({", 1)[1].split("});", 1)[0]
        for element_id in explicit_ids:
            self.assertIn(f'id="{element_id}"', html)
            self.assertRegex(dom_block, rf"\b{element_id}:\s*el\(['\"]{re.escape(element_id)}['\"]\)")
            self.assertIsNone(
                re.search(rf"(?<!DOM\.)\b{element_id}\.(?:classList|innerHTML|textContent|dataset|value|appendChild|scrollIntoView)", source),
                f"implicit DOM reference remains: {element_id}",
            )
        self.assertNotIn("onclick=\"managerRosterDetail.", source)

    def test_browser_like_startup_without_named_element_globals(self):
        command = r"""
const fs=require('fs'),vm=require('vm');
const playerData=JSON.parse(fs.readFileSync('data/players.json','utf8'));
class ClassList{constructor(){this.values=new Set()}add(...x){x.forEach(v=>this.values.add(v))}remove(...x){x.forEach(v=>this.values.delete(v))}toggle(x,on){if(on===undefined)on=!this.values.has(x);on?this.values.add(x):this.values.delete(x);return on}contains(x){return this.values.has(x)}[Symbol.iterator](){return this.values[Symbol.iterator]()}}
class Node{constructor(id=''){this.id=id;this.classList=new ClassList();this.children=[];this.dataset={};this.value='';this.textContent='';this.innerHTML='';this.disabled=true;this.style={}}appendChild(x){this.children.push(x);return x}append(...x){this.children.push(...x)}querySelector(){return null}querySelectorAll(){return []}scrollIntoView(){}}
const ids=[...fs.readFileSync('index.html','utf8').matchAll(/\bid=["']([^"']+)/g)].map(x=>x[1]);
const nodes=Object.fromEntries(ids.map(id=>[id,new Node(id)]));
const errors=[],rejections=[],alerts=[];
const document={getElementById:id=>nodes[id]||null,createElement:()=>new Node(),querySelector:()=>new Node(),querySelectorAll:()=>[],activeElement:null,body:new Node('body')};
const window={FantasyHQAppVersion:{phase:'Jōnin',milestone:'3.7',label:'Jōnin 3.7'},addEventListener:(type,fn)=>{if(type==='error')window.onError=fn;if(type==='unhandledrejection')window.onRejection=fn},location:{search:''},scrollTo(){}};
const context={window,document,navigator:{},fetch:async()=>({ok:true,json:async()=>playerData}),console:{log(){},warn(){},error(...x){errors.push(x.join(' '))}},alert:message=>alerts.push(message),performance:{now:()=>0},requestAnimationFrame:fn=>fn(),setTimeout,clearTimeout,URL,URLSearchParams,Blob,localStorage:{getItem:()=>null,setItem(){}},Math,Date,Map,Set,Object,Array,String,Number,Boolean,JSON,Promise,Error};
window.window=window;Object.assign(window,{document,navigator:context.navigator});vm.createContext(context);
vm.runInContext(fs.readFileSync('js/app.js','utf8'),context,{filename:'js/app.js'});
setTimeout(()=>{
 try{
  if(vm.runInContext('players.length',context)!==playerData.length)throw new Error('player pool did not load');
  if(nodes.managerSetup.children.length!==10)throw new Error('manager setup did not render');
  if(nodes.draftSlot.children.length!==10||nodes.draftSlot.value!==10)throw new Error('draft slot did not initialize');
  if(nodes.startDraftBtn.disabled||nodes.startDraftBtn.textContent!=='Start Draft')throw new Error('start button is not usable');
  vm.runInContext("chooseMode('practice');chooseMode('yahoo');chooseMode('live')",context);
  if(!nodes.liveChoice.classList.contains('selected'))throw new Error('mode selection did not render');
  vm.runInContext("renderAll=()=>{};renderLeagueDnaBar=()=>{}",context);
  for(const selectedMode of ['practice','yahoo','live']){
   vm.runInContext(`chooseMode('${selectedMode}');startDraft()`,context);
   if(!nodes.setupScreen.classList.contains('hidden')||nodes.appScreen.classList.contains('hidden'))throw new Error(selectedMode+' did not enter the draft interface');
   vm.runInContext('backToSetup()',context);
   if(nodes.setupScreen.classList.contains('hidden'))throw new Error(selectedMode+' did not return to setup');
  }
  if(alerts.length)throw new Error('draft-mode startup alert: '+alerts.join('; '));
  if(errors.length||rejections.length)throw new Error('startup errors: '+errors.concat(rejections).join('; '));
 }catch(error){console.error(error);process.exitCode=1}
},0);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_service_worker_filters_protocols_before_caching(self):
        source = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertRegex(source, r"protocol\s*!==\s*['\"]http:['\"]\s*&&\s*protocol\s*!==\s*['\"]https:['\"]")
        for scheme in ("chrome-extension:", "data:", "blob:"):
            self.assertNotIn(f'protocol==="{scheme}"', source)
        self.assertRegex(source, r'cache\.put\(event\.request,\s*copy\)')
        self.assertRegex(source, r"caches\.match\(['\"]\./index\.html['\"]\)")
        command = r"""
const fs=require('fs'),vm=require('vm'),handlers={},puts=[];
const self={addEventListener:(type,handler)=>handlers[type]=handler,skipWaiting(){},clients:{claim(){}}};
const caches={open:async()=>({addAll:async()=>{},put:async request=>puts.push(request.url)}),keys:async()=>[],delete:async()=>{},match:async()=>null};
const fetch=async request=>({clone:()=>({}),url:request.url});
vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),{self,caches,fetch,URL,Promise});
async function exercise(url){let responsePromise=null;handlers.fetch({request:{method:'GET',url},respondWith:value=>responsePromise=value});if(responsePromise)await responsePromise;await new Promise(resolve=>setTimeout(resolve,0));return Boolean(responsePromise)}
(async()=>{
 for(const url of ['chrome-extension://abc/file.js','data:text/plain,hello','blob:https://example.test/id'])if(await exercise(url))throw new Error('unsupported protocol intercepted: '+url);
 for(const url of ['http://example.test/app.js','https://example.test/app.js'])if(!(await exercise(url)))throw new Error('web protocol not intercepted: '+url);
 if(puts.length!==2||!puts.some(x=>x.startsWith('http:'))||!puts.some(x=>x.startsWith('https:')))throw new Error('web assets were not cached normally');
})().catch(error=>{console.error(error);process.exitCode=1});
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
