/**
 * Draft Command Center V1 - Test Suite
 * Tests for recommendation scoring, ranking, and explanation generation
 */

const DraftCommandCenterTests = (() => {
  'use strict';
  
  const tests = [];
  let passCount = 0, failCount = 0;
  
  // Test utilities
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }
  
  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
  }
  
  function assertRange(value, min, max, message) {
    if (value < min || value > max) {
      throw new Error(`${message}\nExpected range [${min}, ${max}]\nActual: ${value}`);
    }
  }
  
  function test(name, fn) {
    tests.push({ name, fn });
  }
  
  function run() {
    console.log('='.repeat(70));
    console.log('Draft Command Center V1 - Test Suite');
    console.log('='.repeat(70));
    
    tests.forEach(({ name, fn }, idx) => {
      try {
        fn();
        console.log(`✓ ${idx + 1}. ${name}`);
        passCount++;
      } catch (err) {
        console.error(`✗ ${idx + 1}. ${name}`);
        console.error(`  ${err.message}`);
        failCount++;
      }
    });
    
    console.log('='.repeat(70));
    console.log(`Results: ${passCount} passed, ${failCount} failed (${tests.length} total)`);
    console.log('='.repeat(70));
    
    return { passCount, failCount, total: tests.length };
  }
  
  // ========== TESTS ==========
  
  // Test 1: Recommendation score range
  test('Recommendation score is between 0-100', () => {
    const mockPlayer = { id: 1, name: 'Test', pos: 'RB', overall: 50, overallTier: 'A' };
    const context = {
      availablePlayers: [mockPlayer],
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 1,
      teamsUntilNextPick: 3
    };
    
    const score = DraftCommandCenterV1.scoreRecommendation(mockPlayer, context);
    assertRange(score.total, 0, 100, 'Score out of range');
  });
  
  // Test 2: Score components sum to total (approximately)
  test('Score components sum to total', () => {
    const mockPlayer = { id: 1, name: 'Test', pos: 'RB', overall: 50, overallTier: 'A' };
    const context = {
      availablePlayers: [mockPlayer],
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 3,
      teamsUntilNextPick: 4
    };
    
    const score = DraftCommandCenterV1.scoreRecommendation(mockPlayer, context);
    const componentSum = score.components.value + score.components.teamFit + 
                         score.components.scarcity + score.components.urgency;
    
    // Should be approximately equal (within rounding error)
    assert(Math.abs(componentSum - score.total) <= 2, 
      `Components don't sum to total. Components: ${componentSum}, Total: ${score.total}`);
  });
  
  // Test 3: Higher ranked players score higher (value component)
  test('Better ranked players score higher', () => {
    const elite = { id: 1, name: 'Elite', pos: 'RB', overall: 10, overallTier: 'A' };
    const mid = { id: 2, name: 'Mid', pos: 'RB', overall: 80, overallTier: 'C' };
    
    const context = {
      availablePlayers: [elite, mid],
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 5,
      teamsUntilNextPick: 3
    };
    
    const eliteScore = DraftCommandCenterV1.scoreRecommendation(elite, context);
    const midScore = DraftCommandCenterV1.scoreRecommendation(mid, context);
    
    assert(eliteScore.total > midScore.total, 
      `Elite player scored lower than mid-tier. Elite: ${eliteScore.total}, Mid: ${midScore.total}`);
  });
  
  // Test 4: Critical position needs boost score
  test('Critical position needs boost recommendation score', () => {
    const player = { id: 1, name: 'QB', pos: 'QB', overall: 150, overallTier: 'C' };
    
    // Context with no QB drafted
    const contextNoQB = {
      availablePlayers: [player],
      counts: { QB: 0, RB: 2, WR: 3, TE: 1, K: 0, DST: 0 },
      round: 8,
      teamsUntilNextPick: 3
    };
    
    // Context with QB already drafted
    const contextWithQB = {
      availablePlayers: [player],
      counts: { QB: 1, RB: 2, WR: 3, TE: 1, K: 0, DST: 0 },
      round: 8,
      teamsUntilNextPick: 3
    };
    
    const scoreNoQB = DraftCommandCenterV1.scoreRecommendation(player, contextNoQB);
    const scoreWithQB = DraftCommandCenterV1.scoreRecommendation(player, contextWithQB);
    
    assert(scoreNoQB.total > scoreWithQB.total,
      `QB with need didn't score higher. NoQB: ${scoreNoQB.total}, WithQB: ${scoreWithQB.total}`);
  });
  
  // Test 5: Recommendations are sorted by score
  test('Top recommendations sorted by score (descending)', () => {
    const players = [
      { id: 1, name: 'A', pos: 'RB', overall: 10, overallTier: 'A' },
      { id: 2, name: 'B', pos: 'WR', overall: 15, overallTier: 'A' },
      { id: 3, name: 'C', pos: 'RB', overall: 100, overallTier: 'C' },
      { id: 4, name: 'D', pos: 'WR', overall: 110, overallTier: 'C' }
    ];
    
    const context = {
      availablePlayers: players,
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 1,
      teamsUntilNextPick: 4
    };
    
    const recs = DraftCommandCenterV1.getTopRecommendations(players, context, 4);
    
    for (let i = 0; i < recs.length - 1; i++) {
      assert(recs[i].commandCenterScore.total >= recs[i + 1].commandCenterScore.total,
        `Recommendations not sorted. Position ${i}: ${recs[i].commandCenterScore.total}, ` +
        `Position ${i+1}: ${recs[i+1].commandCenterScore.total}`);
    }
  });
  
  // Test 6: Position needs calculation
  test('Position needs calculated correctly', () => {
    const counts = { QB: 0, RB: 1, WR: 2, TE: 0, K: 0, DST: 0 };
    
    const needs = DraftCommandCenterV1.calculatePositionNeeds(counts, 17, 3);
    
    assert(needs.QB > 0.7, `QB need should be high: ${needs.QB}`);
    assert(needs.RB > 0.6, `RB need should be moderate: ${needs.RB}`);
    assert(needs.WR > 0.4, `WR need should be low: ${needs.WR}`);
    assert(needs.TE > 0.6, `TE need should be moderate: ${needs.TE}`);
  });
  
  // Test 7: Explanation generation returns non-empty string
  test('Explanation generation produces valid output', () => {
    const player = { id: 1, name: 'Test', pos: 'RB', overall: 30, overallTier: 'A' };
    const context = {
      availablePlayers: [player],
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 2,
      teamsUntilNextPick: 5
    };
    
    const score = DraftCommandCenterV1.scoreRecommendation(player, context);
    const explanation = DraftCommandCenterV1.generateExplanation(player, score, context);
    
    assert(typeof explanation === 'string', 'Explanation is not a string');
    assert(explanation.length > 0, 'Explanation is empty');
    assert(explanation.length < 200, 'Explanation is too long');
  });
  
  // Test 8: Duplicate prevention - same player ID doesn't appear twice
  test('Top recommendations have unique player IDs', () => {
    const players = [
      { id: 1, name: 'A', pos: 'RB', overall: 10, overallTier: 'A' },
      { id: 2, name: 'B', pos: 'WR', overall: 15, overallTier: 'A' },
      { id: 3, name: 'C', pos: 'RB', overall: 20, overallTier: 'B' }
    ];
    
    const context = {
      availablePlayers: players,
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 1,
      teamsUntilNextPick: 3
    };
    
    const recs = DraftCommandCenterV1.getTopRecommendations(players, context, 3);
    const ids = recs.map(r => r.id);
    const uniqueIds = new Set(ids);
    
    assertEqual(ids.length, uniqueIds.size, 'Duplicate player IDs in recommendations');
  });
  
  // Test 9: Tier drop scarcity increases urgency
  test('Scarcity increases with fewer tier-1 players', () => {
    const tierAPlayers = [
      { id: 1, name: 'A', pos: 'RB', overall: 10, overallTier: 'A' }
    ];
    
    const tierCPlayers = [
      { id: 2, name: 'B', pos: 'RB', overall: 50, overallTier: 'C' },
      { id: 3, name: 'C', pos: 'RB', overall: 55, overallTier: 'C' }
    ];
    
    // Scenario 1: One tier-A available
    const context1 = {
      availablePlayers: [...tierAPlayers, ...tierCPlayers],
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 3,
      teamsUntilNextPick: 2
    };
    
    const score1 = DraftCommandCenterV1.scoreRecommendation(tierAPlayers[0], context1);
    
    // Scenario 2: Same player but with more tier-A options (lower scarcity)
    const moreTierA = [...tierAPlayers, 
      { id: 4, name: 'D', pos: 'RB', overall: 15, overallTier: 'A' }];
    
    const context2 = {
      availablePlayers: [...moreTierA, ...tierCPlayers],
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 3,
      teamsUntilNextPick: 2
    };
    
    const score2 = DraftCommandCenterV1.scoreRecommendation(tierAPlayers[0], context2);
    
    assert(score1.total > score2.total,
      `Scarce tier-A didn't score higher. Scarce: ${score1.total}, Abundant: ${score2.total}`);
  });
  
  // Test 10: Missing data doesn't cause errors
  test('Handles players with missing overall rank', () => {
    const playerNoRank = { id: 1, name: 'Mark Andrews', pos: 'TE', overall: null, posTier: 'A' };
    
    const context = {
      availablePlayers: [playerNoRank],
      counts: { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
      round: 1,
      teamsUntilNextPick: 3
    };
    
    const score = DraftCommandCenterV1.scoreRecommendation(playerNoRank, context);
    assertRange(score.total, 0, 100, 'Score with missing rank out of range');
    
    const explanation = DraftCommandCenterV1.generateExplanation(playerNoRank, score, context);
    assert(explanation.length > 0, 'Explanation is empty for unranked player');
  });
  
  // Test 11: Recommendation score improves for matching position needs
  test('RB scores higher when RB need is critical', () => {
    const player = { id: 1, name: 'RB', pos: 'RB', overall: 80, overallTier: 'B' };
    
    const contextNeedRB = {
      availablePlayers: [player],
      counts: { QB: 1, RB: 0, WR: 3, TE: 1, K: 0, DST: 0 },
      round: 5,
      teamsUntilNextPick: 3
    };
    
    const contextHaveRB = {
      availablePlayers: [player],
      counts: { QB: 1, RB: 2, WR: 1, TE: 1, K: 0, DST: 0 },
      round: 5,
      teamsUntilNextPick: 3
    };
    
    const scoreNeed = DraftCommandCenterV1.scoreRecommendation(player, contextNeedRB);
    const scoreHave = DraftCommandCenterV1.scoreRecommendation(player, contextHaveRB);
    
    assert(scoreNeed.total > scoreHave.total,
      `RB didn't score higher when needed. Need: ${scoreNeed.total}, Have: ${scoreHave.total}`);
  });
  
  // Test 12: Position needs scale by round
  test('Position needs adjust by draft round', () => {
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
    
    const round1Needs = DraftCommandCenterV1.calculatePositionNeeds(counts, 17, 1);
    const round10Needs = DraftCommandCenterV1.calculatePositionNeeds(counts, 17, 10);
    
    // QB need should decrease as round progresses
    assert(round1Needs.QB >= round10Needs.QB,
      `QB need didn't decrease by round. Round 1: ${round1Needs.QB}, Round 10: ${round10Needs.QB}`);
  });
  
  return { test, run };
})();

// Run tests if this file is loaded
if (typeof window !== 'undefined') {
  window.DraftCommandCenterTests = DraftCommandCenterTests;
}
