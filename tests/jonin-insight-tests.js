const JoninInsightTests = (() => {
  'use strict';
  const tests = [];
  const test = (name, fn) => tests.push({name, fn});
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const player = (id, name, pos, overall, tier = 'A') => ({id, name, pos, overall, overallTier: tier, team: 'TST'});
  const primary = player(1, 'Primary', 'WR', 20, 'A');
  const alternative = player(2, 'Alternative', 'RB', 23, 'A');
  const depth = [primary, alternative, player(3, 'Depth WR', 'WR', 27, 'A'), player(4, 'Later WR', 'WR', 39, 'B')];
  const breakdown = {projection: 90, value: 8, rosterFit: 4, scarcity: 3, risk: -2, final: 103};

  test('all explanation sections return content', () => {
    const insight = JoninInsightEngineV1.buildRecommendationInsight({player: primary, candidates:[{player:primary,finalScore:103,breakdown},{player:alternative,finalScore:97,breakdown:{...breakdown,final:97}}], availablePlayers:depth, counts:{WR:1}, positionStrength:'Thin', picksUntil:6, pick:28, breakdown, survivalRisk:40});
    ['value','teamFit','scarcity','risk','confidence'].forEach(key => assert(typeof insight.sections[key] === 'string' && insight.sections[key].trim(), `${key} missing`));
  });
  test('HTML-like player names are escaped as text', () => {
    const hostile = `<img src=x onerror="alert('x')"><script>alert(1)</script>`;
    const escaped = JoninInsightEngineV1.escapeHTML(hostile);
    assert(!escaped.includes('<img') && !escaped.includes('<script'), 'markup was not escaped');
    assert(escaped.includes('&lt;img') && escaped.includes('&quot;') && escaped.includes('&#39;'), 'expected entities are missing');
  });
  test('escaped render fragments cannot create elements or executable attributes', () => {
    const hostile = `<svg onload=alert(1)>Player</svg>`;
    const rendered = `<div class="whyNot">${JoninInsightEngineV1.escapeHTML(hostile)}</div>`;
    const openingTags = rendered.match(/<[^/][^>]*>/g) || [];
    assert(openingTags.length === 1 && openingTags[0] === '<div class="whyNot">', `unexpected injected element: ${openingTags.join(', ')}`);
    assert(!/<[^>]+\son(?:error|load)=/i.test(rendered), 'executable attribute was rendered');
  });
  test('null undefined and blank rankings use an honest fallback', () => {
    [null, undefined, '', '   ', 0].forEach(overall => {
      const incomplete = {...primary, overall};
      const insight = JoninInsightEngineV1.buildRecommendationInsight({player:incomplete,candidates:[{player:incomplete,finalScore:103,breakdown}],availablePlayers:[incomplete],counts:{WR:0},positionStrength:'Critical',picksUntil:6,pick:28,breakdown,survivalRisk:0});
      assert(insight.sections.value === 'Overall ranking is unavailable; no rank-based value claim is shown.', `dishonest rank fallback for ${String(overall)}`);
      assert(!insight.sections.value.includes('Ranked 0'), 'null ranking became zero');
    });
  });
  test('missing and blank tiers do not default to C', () => {
    [undefined, null, '', '   '].forEach(tier => {
      const incomplete = {...primary, overallTier:tier, posTier:tier};
      const window = JoninInsightEngineV1.opportunityWindow({player:incomplete,availablePlayers:[incomplete],picksUntil:6,candidates:[{finalScore:103}]});
      assert(window.label === 'Guidance unavailable', `unexpected wait label for missing tier: ${window.label}`);
      assert(window.reason.includes('tier') && !window.reason.includes('C-tier'), 'missing tier was presented as C');
    });
  });
  test('missing comparison and wait inputs return honest neutral text', () => {
    const comparison = JoninInsightEngineV1.whyNot({recommended:primary,candidates:[{player:primary,finalScore:103,breakdown}]});
    const window = JoninInsightEngineV1.opportunityWindow({player:{...primary,overall:null,overallTier:null},candidates:[{finalScore:103}]});
    assert(comparison.preferred.includes('No available alternative'), 'Why Not fallback is not explicit');
    assert(window.label === 'Guidance unavailable' && window.reason.includes('missing'), 'Can-I-wait fallback is not explicit');
  });
  test('complete-data explanations remain stable', () => {
    const insight = JoninInsightEngineV1.buildRecommendationInsight({player:primary,candidates:[{player:primary,finalScore:103,breakdown},{player:alternative,finalScore:97,breakdown:{...breakdown,final:97}}],availablePlayers:depth,counts:{WR:1},positionStrength:'Thin',picksUntil:6,pick:28,breakdown,survivalRisk:40});
    assert(insight.sections.value === 'Available 8 picks after overall rank 20; existing value modifiers add 8.', 'complete value explanation changed');
    assert(insight.sections.teamFit === 'WR is thin on your roster; fit adds 4.', 'complete roster-fit explanation changed');
    assert(insight.sections.risk === '40/95 current survival-risk signal before your next turn.', 'complete risk explanation changed');
    assert(insight.sections.confidence.startsWith('Heuristic confidence — '), 'confidence is not visibly heuristic');
  });
  test('confidence stays between 0 and 100', () => {
    const confidence = JoninInsightEngineV1.confidenceFor({player:primary,candidates:[{finalScore:103},{finalScore:100}],breakdown,tierDepth:2});
    assert(confidence.score >= 0 && confidence.score <= 100, 'confidence out of range');
  });
  test('close candidates lower confidence', () => {
    const close = JoninInsightEngineV1.confidenceFor({player:primary,candidates:[{finalScore:103},{finalScore:102}],breakdown,tierDepth:3});
    const clear = JoninInsightEngineV1.confidenceFor({player:primary,candidates:[{finalScore:103},{finalScore:90}],breakdown,tierDepth:3});
    assert(close.score < clear.score, `close ${close.score} should be below clear ${clear.score}`);
  });
  test('clear separation raises confidence', () => {
    const tied = JoninInsightEngineV1.confidenceFor({player:primary,candidates:[{finalScore:103},{finalScore:103}],breakdown,tierDepth:3});
    const separated = JoninInsightEngineV1.confidenceFor({player:primary,candidates:[{finalScore:103},{finalScore:91}],breakdown,tierDepth:3});
    assert(separated.score >= 82, `clear leader should be high confidence, got ${separated.score}`);
    assert(separated.score > tied.score, 'clear separation did not raise confidence');
  });
  test('Why Not selects a valid available alternative', () => {
    const result = JoninInsightEngineV1.whyNot({recommended:primary,candidates:[{player:primary,finalScore:103,breakdown},{player:alternative,finalScore:97,breakdown:{...breakdown,rosterFit:8,final:97}}]});
    assert(result.alternative && result.alternative.id === alternative.id, 'valid alternative not selected');
    assert(result.scoreDifference === 6, 'score difference incorrect');
  });
  test('score breakdown reconciles with final score', () => {
    assert(JoninInsightEngineV1.componentTotal(breakdown) === breakdown.final, 'breakdown does not reconcile');
  });
  test('opportunity window emits every supported label deterministically', () => {
    const scenarios = [
      {player:primary,availablePlayers:[primary,alternative],picksUntil:8,candidates:[{finalScore:103},{finalScore:95}]},
      {player:primary,availablePlayers:depth,picksUntil:6,candidates:[{finalScore:103},{finalScore:100}]},
      {player:primary,availablePlayers:[...depth,player(5,'WR 3','WR',22,'A'),player(6,'WR 4','WR',24,'A'),player(7,'WR 5','WR',25,'A')],picksUntil:2,candidates:[{finalScore:103},{finalScore:102}]}
    ];
    const labels = scenarios.map(input => JoninInsightEngineV1.opportunityWindow(input).label);
    assert(labels.join('|') === 'Draft now|Risky to wait|Probably safe to wait', `unexpected labels: ${labels.join(', ')}`);
  });
  test('end-of-draft components all explain themselves', () => {
    const evaluation={starterStrength:86,ceiling:84,value:82,construction:93,benchUpside:74,bestPick:primary,rank:2,score:87};
    const result=JoninInsightEngineV1.explainDraftGrade(evaluation,{counts:{RB:4,WR:5},starterCount:11,benchCount:6,ceilingPlayers:4,upsideBench:3,playerCount:17,bestValueDelta:8,teamCount:10,constructionNotes:[]});
    ['starters','ceiling','value','construction','benchUpside','bestValue','projectedFinish'].forEach(key=>assert(result[key] && result[key].includes(key==='bestValue'?'Primary':key==='projectedFinish'?'#2':':'),`${key} missing detail`));
  });

  function run(){let passCount=0,failCount=0;tests.forEach(({name,fn})=>{try{fn();console.log(`✓ ${name}`);passCount++;}catch(error){console.error(`✗ ${name}: ${error.message}`);failCount++;}});console.log(`Jonin Insight: ${passCount} passed, ${failCount} failed`);return{passCount,failCount,total:tests.length};}
  return {run};
})();
if(typeof window!=='undefined')window.JoninInsightTests=JoninInsightTests;
