(function(global){
  'use strict';
  function run(){
    const failures=[];let passCount=0;const assert=(condition,message)=>{if(!condition)failures.push(message);else passCount++};
    const slots=['QB','RB1','RB2','WR1','WR2','WR3','TE','FLEX1','FLEX2','K','DEF','BENCH1','BENCH2','BENCH3','BENCH4','BENCH5','BENCH6'];
    const player=(id,pos,name=`${pos}${id}`)=>({id,pos,name,team:'TST',bye:9}),entries=items=>items.map((p,index)=>({id:p?.id??`missing-${index}`,player:p,draftOrder:index+1}));
    const assign=items=>global.RosterViewV1.assignSlots({slots,draftedEntries:entries(items)}),at=(view,slot)=>view.allRows.find(row=>row.slot===slot);
    let view=assign([]);assert(view.starters.length===11&&view.bench.length===6&&view.allRows.every(row=>!row.player),'empty roster preserves every configured slot');
    view=assign([player(1,'QB')]);assert(at(view,'QB').playerId===1,'QB fills QB');
    view=assign([player(1,'RB'),player(2,'RB'),player(3,'RB')]);assert(at(view,'RB1').playerId===1&&at(view,'RB2').playerId===2&&at(view,'FLEX1').playerId===3,'RB starters fill before FLEX');
    view=assign([player(1,'WR'),player(2,'WR'),player(3,'WR'),player(4,'WR')]);assert(at(view,'WR1').playerId===1&&at(view,'WR3').playerId===3&&at(view,'FLEX1').playerId===4,'WR starters fill before FLEX');
    view=assign([player(1,'TE'),player(2,'TE')]);assert(at(view,'TE').playerId===1&&at(view,'FLEX1').playerId===2,'second TE fills eligible FLEX');
    view=assign([player(1,'K'),player(2,'DST'),player(3,'QB')]);assert(at(view,'K').playerId===1&&at(view,'DEF').playerId===2&&!view.starters.filter(row=>row.kind==='FLEX').some(row=>[1,2,3].includes(row.playerId)),'K DST and second QB never enter FLEX');
    const mixed=[player(1,'QB'),player(2,'RB'),player(3,'RB'),player(4,'WR'),player(5,'WR'),player(6,'WR'),player(7,'TE'),player(8,'RB'),player(9,'WR'),player(10,'K'),player(11,'DST'),player(12,'QB')];view=assign(mixed);const ids=view.allRows.map(row=>row.playerId).filter(id=>id!=null);assert(ids.length===mixed.length&&new Set(ids).size===mixed.length,'mixed roster contains every player exactly once');
    assert(at(view,'BENCH1').playerId===12,'bench preserves remaining draft order');
    const before=assign(mixed),undone=assign(mixed.slice(0,-1)),replayed=assign(mixed);assert(at(undone,'BENCH1').player===null&&JSON.stringify(before)===JSON.stringify(replayed),'undo vacates slot and replay is deterministic');
    assert(assign([]).allRows.every(row=>row.player===null),'reset returns every slot to empty');
    assert(JSON.stringify(assign(mixed))===JSON.stringify(assign(mixed.map(p=>({...p})))),'saved IDs restore identical assignment');
    view=global.RosterViewV1.assignSlots({slots,draftedEntries:[{id:9999,player:null,draftOrder:1}]});assert(view.unresolved.length===1&&at(view,'BENCH1').playerId===9999,'unknown player ID remains visibly represented');
    const overflowItems=[...mixed,...Array.from({length:8},(_,i)=>player(20+i,'RB'))];view=assign(overflowItems);assert(view.overflow.length>0&&view.allRows.filter(row=>row.player).length===overflowItems.length,'players beyond bench capacity remain in overflow');
    return {passCount,failCount:failures.length,failures};
  }
  global.RosterViewTests={run};
})(typeof window!=='undefined'?window:globalThis);
