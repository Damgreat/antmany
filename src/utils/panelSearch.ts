import { CellData, PanelData } from '../types';
import { isAntigenHeterozygous, isAntigenHomozygous } from './ruleOutUtils';

/**
 * Utility functions for searching and filtering panel cells based on antibody criteria
 */

/**
 * Find cells that match specific antibody criteria
 * @param panelData The panel data to search within
 * @param requiredAntibodies Antibodies that must be positive
 * @param ruleOutAntibodies Antibodies that must be ruled out
 * @param dosageMap Optional map of antibody to dosage requirements
 * @returns Array of matching cells with their indices
 */
export const findMatchingCells = (
  panelData: PanelData,
  requiredAntibodies: string[],
  ruleOutAntibodies: string[] = [],
  dosageMap?: {[key: string]: string}
): Array<CellData & { cellIndex: number }> => {
  // Validate panel data structure
  if (!panelData.cells || !Array.isArray(panelData.cells) || !panelData.antigens) {
    return [];
  }

  // Match each cell against the criteria
  return panelData.cells.filter((cell: CellData, index: number) => {
    if (!cell.results) return false;

    // Check if cell matches all required antibodies
    const matchesAntibodies = requiredAntibodies.every(antigen => {
      // Check if the antigen exists in this panel
      if (typeof cell.results[antigen] === 'undefined') return false;
      
      // For required antibodies, we need a positive reaction
      return cell.results[antigen] === '0';
    });

    if (!matchesAntibodies) return false;

    // Check rule-out antibodies with dosage consideration
    const passesRuleOut = ruleOutAntibodies.every(antigen => {
      // Skip if antigen doesn't exist in this panel
      if (typeof cell.results[antigen] === 'undefined') return true;

      // Get the required dosage for this rule-out antigen
      const requiredDosage = dosageMap?.[antigen] || 'Not Set';

      return matchesDosageCriteria(cell, antigen, requiredDosage);
    });

    // Cell matches if it passes both antibody and rule-out criteria
    return matchesAntibodies && passesRuleOut;
  }).map((cell: CellData, index: number) => ({
    ...cell,
    cellIndex: index // Store the original cell index for reference
  }));
};

/**
 * Check if a cell's result matches the dosage criteria
 * @param cellResult The result value from the cell
 * @param dosage The required dosage
 * @returns True if the result matches the dosage criteria
 */
export const matchesDosageCriteria = (
  cell: CellData,
  antigen: string,
  dosage: string
): boolean => {
  // If dosage is not set, any non-positive value is fine
  
  // For specific dosages, we need to check for the corresponding pattern
  switch (dosage) {
    case '2':
      // For homozygous, we should see /
      return isAntigenHomozygous(cell, antigen);
    case '1':
      // For heterozygous, should be +w or +s
      return isAntigenHeterozygous(cell, antigen);
    case 'Not Set':
      // Weak should be +w
      return true;
    default:
      // Default case: just not positive
      return false;
  }
};

/**
 * Score the compatibility of a cell with antibody criteria 
 * (useful for sorting results by best match)
 */
export const scoreCellCompatibility = (
  cell: CellData,
  requiredAntibodies: string[],
  ruleOutAntibodies: string[] = [],
  dosageMap?: {[key: string]: string}
): number => {
  if (!cell.results) return 0;
  
  let score = 0;
  
  // Check required antibodies
  for (const antigen of requiredAntibodies) {
    if (cell.results[antigen] === '+') {
      score += 10; // High points for positive match on required antibodies
    } else if (cell.results[antigen] === '+w' || cell.results[antigen] === '+s') {
      score += 5; // Partial points for weak positives
    }
  }
  
  // Check rule-out antibodies
  for (const antigen of ruleOutAntibodies) {
    if (typeof cell.results[antigen] === 'undefined') {
      score += 2; // Some points if the antigen isn't in the panel (neutral)
      continue;
    }
    
    const requiredDosage = dosageMap?.[antigen] || 'Not Set';
    if (matchesDosageCriteria(cell, antigen, requiredDosage)) {
      score += 8; // Good points for matching rule-out criteria
    } else {
      score -= 5; // Penalty for failing rule-out criteria
    }
  }
  
  return score;
};

/**
 * Get count of matching cells across all panels
 * @param panels Array of panel data
 * @param requiredAntibodies Antibodies that must be positive
 * @param ruleOutAntibodies Antibodies that must be ruled out
 * @param dosageMap Optional map of antibody to dosage requirements
 */
export const getMatchingCellCount = (
  panels: PanelData[],
  requiredAntibodies: string[],
  ruleOutAntibodies: string[] = [],
  dosageMap?: {[key: string]: string}
): number => {
  return panels.reduce((count, panel) => {
    const matches = findMatchingCells(panel, requiredAntibodies, ruleOutAntibodies, dosageMap);
    return count + matches.length;
  }, 0);
};

/**
 * Sort search results by relevance
 * @param results Array of panel results with matching cells
 * @returns Sorted results array
 */
export const sortResultsByRelevance = (
  results: Array<{
    id: string;
    matchingCells: Array<CellData & { cellIndex: number }>;
    [key: string]: any;
  }>,
  requiredAntibodies: string[],
  ruleOutAntibodies: string[] = [],
  dosageMap?: {[key: string]: string}
): typeof results => {
  // First score each panel based on its best matching cell
  const scoredResults = results.map(result => {
    // Calculate best score from all matching cells
    const bestScore = result.matchingCells.reduce((highestScore, cell) => {
      const score = scoreCellCompatibility(cell, requiredAntibodies, ruleOutAntibodies, dosageMap);
      return Math.max(highestScore, score);
    }, 0);
    
    // Return the result with its score
    return {
      ...result,
      score: bestScore,
      // Also factor in the number of matching cells as a tiebreaker
      matchCount: result.matchingCells.length
    };
  });
  
  // Sort by score (descending) and then by match count (descending)
  return scoredResults.sort((a, b) => {
    // First sort by score
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // If scores are equal, sort by number of matching cells
    return b.matchCount - a.matchCount;
  });
};