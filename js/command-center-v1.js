/**
 * Draft Command Center V1
 * Transparent recommendation engine with configurable weighted formula
 * 
 * Scoring Components:
 * - 40% Best Player Available (BPA) Value Score
 * - 30% Roster Need / TeamFit Score  
 * - 20% Positional Scarcity Score
 * - 10% Tier Drop Urgency Score
 */

const DraftCommandCenterV1 = (() => {
  'use strict';
  
  // Configuration - centralized weights and thresholds
  const CONFIG = {
    weights: {
      value: 0.40,        // Best Player Available value
      teamFit: 0.30,      // Roster need and fit
      scarcity: 0.20,     // Position scarcity and tier drops
      urgency: 0.10       // Tier drop urgency
    },
    thresholds: {
      criticalNeed: 0.85,   // Position need strength
      highScarcity: 0.75,   // Scarcity threshold
      tierDropWarning: 8    // Picks until significant tier drop
    }
  };

  /**
   * Calculate Value Score (40%)
   * Based on overall rank, tier, and value gap vs next best option
   */
  function calculateValueScore(player, availablePlayers) {
    if (!player) return 0;
    
    // Normalize overall rank (1-250 scale, lower is better)
    const rank = player.overall || 250;
    const rankScore = Math.max(0, (250 - rank) / 250) * 60; // 0-60 scale
    
    // Tier bonus
    const tierBonus = getTierBonus(player.overallTier || player.posTier);
    
    // Value gap vs next best available player in same position
    const positionPool = availablePlayers
      .filter(p => p.pos === player.pos && p.id !== player.id)
      .map(p => p.overall || 250)
      .sort((a, b) => a - b);
    
    const nextBestRank = positionPool[0] || 250;
    const valueGap = Math.max(0, nextBestRank - rank);
    const gapBonus = Math.min(20, valueGap / 10); // Up to 20 point bonus
    
    return Math.round(rankScore + tierBonus + gapBonus);
  }

  /**
   * Calculate TeamFit Score (30%)
   * Based on roster needs and position strength
   */
  function calculateTeamFitScore(player, rosterNeeds, counts) {
    if (!player) return 0;
    
    const pos = player.pos;
    const positionNeed = rosterNeeds[pos] || 0; // 0 = filled, 1 = critical need
    
    // Base need score
    let needScore = 0;
    if (positionNeed >= 0.8) needScore = 60;      // Critical need
    else if (positionNeed >= 0.6) needScore = 45; // High need
    else if (positionNeed >= 0.4) needScore = 30; // Moderate need
    else if (positionNeed >= 0.2) needScore = 15; // Low need
    else needScore = 5;                           // Filled
    
    // Starter slot bonus for skill positions
    let starterBonus = 0;
    if (pos === 'QB' && counts.QB === 0) starterBonus = 15;
    else if (pos === 'RB' && counts.RB < 2) starterBonus = 15;
    else if (pos === 'WR' && counts.WR < 3) starterBonus = 15;
    else if (pos === 'TE' && counts.TE === 0) starterBonus = 15;
    
    return Math.round(needScore + starterBonus);
  }

  /**
   * Calculate Scarcity Score (20%)
   * Based on how many good players remain at position vs need
   */
  function calculateScarcityScore(player, availablePlayers, round) {
    if (!player) return 0;
    
    const pos = player.pos;
    const positionPool = availablePlayers.filter(p => p.pos === pos);
    
    // Count tier-1 players remaining
    const tier1Players = positionPool.filter(p => {
      const tier = p.overallTier || p.posTier || 'C';
      return ['S', 'A'].includes(tier);
    }).length;
    
    // Scarcity score based on remaining tier-1 players
    let scarcityScore = 0;
    if (tier1Players <= 1) scarcityScore = 60;  // Rare
    else if (tier1Players <= 2) scarcityScore = 45;
    else if (tier1Players <= 4) scarcityScore = 30;
    else if (tier1Players <= 8) scarcityScore = 15;
    else scarcityScore = 5;
    
    // Boost if this is a tier-1 player
    if ((player.overallTier === 'S' || player.overallTier === 'A') ||
        (player.posTier === 'S' || player.posTier === 'A')) {
      scarcityScore += 10;
    }
    
    return Math.min(60, Math.round(scarcityScore));
  }

  /**
   * Calculate Urgency Score (10%)
   * Based on how soon other positions will be picked
   */
  function calculateUrgencyScore(player, availablePlayers, round, teamsUntilNextPick) {
    if (!player) return 0;
    
    const pos = player.pos;
    
    // Tier drop analysis: when do we run out of good players at this position?
    const positionPool = availablePlayers.filter(p => p.pos === pos);
    const tier1AtPos = positionPool.filter(p => {
      const t = p.overallTier || p.posTier || 'C';
      return ['S', 'A'].includes(t);
    }).length;
    
    let urgencyScore = 0;
    
    // If this is tier-1 and we're running low, urgency increases
    if ((player.overallTier === 'S' || player.overallTier === 'A' ||
         player.posTier === 'S' || player.posTier === 'A')) {
      
      if (tier1AtPos <= 2) urgencyScore = 40;          // Critical - last tier-1s
      else if (tier1AtPos <= 4) urgencyScore = 25;     // Warning - few remain
      else if (teamsUntilNextPick >= 6) urgencyScore = 10; // Someone will snipe
      else urgencyScore = 5;
    } else {
      urgencyScore = 5; // Lower urgency for non-tier-1
    }
    
    return Math.min(40, Math.round(urgencyScore));
  }

  /**
   * Get tier bonus for value scoring
   */
  function getTierBonus(tier) {
    const t = String(tier || 'C').toUpperCase();
    const bonuses = { 'S': 15, 'A': 10, 'B': 5, 'C': 2, 'D': 0, 'E': -5, 'F': -10 };
    return bonuses[t] || 2;
  }

  /**
   * Calculate position needs (0=filled, 1=critical need)
   */
  function calculatePositionNeeds(counts, totalRounds, currentRound) {
    const needs = {
      QB: counts.QB >= 1 ? 0 : (currentRound <= 5 ? 0.8 : 0.6),
      RB: counts.RB >= 2 ? 0 : (currentRound <= 4 ? 0.9 : 0.7),
      WR: counts.WR >= 3 ? 0 : (currentRound <= 5 ? 0.8 : 0.6),
      TE: counts.TE >= 1 ? 0 : (currentRound <= 6 ? 0.7 : 0.5),
      K: counts.K >= 1 ? 0 : 0.1,
      DST: counts.DST >= 1 ? 0 : 0.1
    };
    return needs;
  }

  /**
   * Main recommendation scoring function
   * Returns score 0-100 with component breakdown
   */
  function scoreRecommendation(player, context) {
    if (!player) return { total: 0, components: {} };
    
    const {
      availablePlayers = [],
      counts = {},
      round = 1,
      teamsUntilNextPick = 3,
      rosterNeeds = {}
    } = context;
    
    const valueScore = calculateValueScore(player, availablePlayers);
    const fitScore = calculateTeamFitScore(player, rosterNeeds, counts);
    const scarcityScore = calculateScarcityScore(player, availablePlayers, round);
    const urgencyScore = calculateUrgencyScore(player, availablePlayers, round, teamsUntilNextPick);
    
    const total = Math.round(
      (valueScore * CONFIG.weights.value) +
      (fitScore * CONFIG.weights.teamFit) +
      (scarcityScore * CONFIG.weights.scarcity) +
      (urgencyScore * CONFIG.weights.urgency)
    );
    
    return {
      total: Math.max(0, Math.min(100, total)),
      components: {
        value: Math.round(valueScore * CONFIG.weights.value),
        teamFit: Math.round(fitScore * CONFIG.weights.teamFit),
        scarcity: Math.round(scarcityScore * CONFIG.weights.scarcity),
        urgency: Math.round(urgencyScore * CONFIG.weights.urgency)
      },
      raw: {
        valueScore,
        fitScore,
        scarcityScore,
        urgencyScore
      }
    };
  }

  /**
   * Generate explanation for a recommendation
   */
  function generateExplanation(player, score, context) {
    if (!player) return 'No player selected.';
    
    const { components, raw } = score;
    const { counts, round, teamsUntilNextPick } = context;
    
    const parts = [];
    
    // Value explanation
    if (raw.valueScore >= 50) {
      const tier = player.overallTier || player.posTier || 'C';
      parts.push(`Elite-tier ${player.pos} with strong draft capital`);
    } else if (raw.valueScore >= 35) {
      parts.push(`Premium ${player.pos} value at this pick`);
    } else if (raw.valueScore >= 20) {
      parts.push(`Solid ${player.pos} at fair value`);
    }
    
    // Fit explanation
    if (raw.fitScore >= 50) {
      parts.push(`Fills critical roster need`);
    } else if (raw.fitScore >= 30) {
      parts.push(`Addresses position need`);
    }
    
    // Scarcity explanation
    if (raw.scarcityScore >= 45) {
      parts.push(`Limited top-tier options remain at position`);
    } else if (raw.scarcityScore >= 25) {
      parts.push(`Tier drop approaching at position`);
    }
    
    // Urgency explanation
    if (raw.urgencyScore >= 30 && teamsUntilNextPick >= 5) {
      parts.push(`Risk of position being sniped`);
    }
    
    return parts.slice(0, 3).join('; ') || 'Best available option';
  }

  /**
   * Get top recommendations with detailed scoring
   */
  function getTopRecommendations(players, context, topN = 5) {
    const { availablePlayers = [], counts = {}, round = 1, teamsUntilNextPick = 3 } = context;
    
    const rosterNeeds = calculatePositionNeeds(counts, 17, round);
    
    const scored = availablePlayers
      .map(p => ({
        ...p,
        commandCenterScore: scoreRecommendation(p, {
          availablePlayers,
          counts,
          round,
          teamsUntilNextPick,
          rosterNeeds
        })
      }))
      .sort((a, b) => b.commandCenterScore.total - a.commandCenterScore.total)
      .slice(0, topN)
      .map(p => ({
        ...p,
        explanation: generateExplanation(p, p.commandCenterScore, { counts, round, teamsUntilNextPick })
      }));
    
    return scored;
  }

  /**
   * Public API
   */
  return {
    CONFIG,
    scoreRecommendation,
    generateExplanation,
    getTopRecommendations,
    calculatePositionNeeds,
    
    // Testing utilities
    _calculateValueScore: calculateValueScore,
    _calculateTeamFitScore: calculateTeamFitScore,
    _calculateScarcityScore: calculateScarcityScore,
    _calculateUrgencyScore: calculateUrgencyScore
  };
})();

// Export for use in app.js
if (typeof window !== 'undefined') {
  window.DraftCommandCenterV1 = DraftCommandCenterV1;
}
