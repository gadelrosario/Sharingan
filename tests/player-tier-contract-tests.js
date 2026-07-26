(function(global){
  'use strict';
  function run(){
    const failures=[];let passCount=0;
    const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);else passCount++};
    const contract=global.PlayerTierContract,values=player=>[contract.getPositionTier(player),contract.getOverallTier(player),contract.getDecisionTier(player)];
    check('matching tiers',values({pos:'WR',posTier:'S',overallTier:'S'}),['S','S','S']);
    check('legitimate differing tiers',values({pos:'WR',posTier:'S',overallTier:'A'}),['S','A','S']);
    check('invalid position falls through',values({pos:'WR',posTier:'INVALID',overallTier:'A'}),[null,'A','A']);
    check('blank position falls through',contract.getDecisionTier({pos:'WR',posTier:'',overallTier:'B'}),'B');
    check('missing position falls through',contract.getDecisionTier({pos:'WR',overallTier:'A'}),'A');
    check('lowercase normalizes',values({pos:'WR',posTier:'s',overallTier:'a'}),['S','A','S']);
    check('both missing compatibility fallback',contract.getDecisionTier({pos:'WR'}),'C');
    check('both missing reason',contract.getTierDiagnostic({pos:'WR'}).reason,'no valid S-F decision tier is available; compatibility fallback C used');
    check('depth preserved',values({pos:'WR',posTier:'Depth'}),['Depth',null,'C']);
    check('kicker numeric preserved',values({pos:'K',posTier:1}),['1',null,'C']);
    check('defense numeric preserved',values({pos:'D/ST',posTier:2}),['2',null,'C']);
    check('invalid overall rejected',contract.getOverallTier({overallTier:'INVALID'}),null);
    check('source tier excluded',values({pos:'WR',bdgeTier:'Elite WR1'}),[null,null,'C']);
    check('JSN explicit tiers',values({pos:'WR',posTier:'S',overallTier:'A'}),['S','A','S']);
    return {passCount,failCount:failures.length,failures};
  }
  global.PlayerTierContractTests={run};
})(typeof window!=='undefined'?window:globalThis);
