import { CellData, AntigenRuleState } from '../types';
import DatabaseService from '../services/DatabaseService';

export interface RuleScore {
    homozygousScore: number;
    heterozygousScore: number;
    heterozygousCount: number;
    homozygousCount: number;
    totalScore: number;
    supportingCells: string[];
}

// Constants for rule-out logic
export const SPECIAL_ANTIGENS = ['C', 'E', 'K'];
export const HOMOZYGOUS_SCORE = 1;
export const HETEROZYGOUS_SCORE = 1; // Each heterozygous cell will count as 1 toward threshold

// Rule settings with default values
let PRIMARY_RULE_OUT_THRESHOLD = 1; // Default: 1 homozygous cell
let ADD_ON_RULE_OUT_THRESHOLD = 0; // Default: 0 homozygous cells for D
const CUSTOM_RULE_THRESHOLDS: { [key: string]: number } = {}; // Custom thresholds for antigens

// Function to load rule settings from DB
export const loadRuleSettings = async (): Promise<void> => {
    try {
        // Initialize the database first
        await DatabaseService.initDatabase();

        // Load primary rule out threshold
        const primaryRuleOutSetting = await DatabaseService.getSetting('primaryRuleOut');
        if (primaryRuleOutSetting) {
            PRIMARY_RULE_OUT_THRESHOLD = parseInt(primaryRuleOutSetting.value);
        }

        // Load add-on rule out threshold for D
        const addOnRuleOutSetting = await DatabaseService.getSetting('addOnRuleOut');
        if (addOnRuleOutSetting) {
            ADD_ON_RULE_OUT_THRESHOLD = parseInt(addOnRuleOutSetting.value);
        }

        // Load custom antibody rule settings
        const antibodyRules = await DatabaseService.getAntibodyRules();
        antibodyRules.forEach(rule => {
            if (rule.isSelected === 'Yes') {
                // Store threshold value in our map
                CUSTOM_RULE_THRESHOLDS[rule.name] = parseInt(rule.isHeterozygous);
            }
        });

        // console.log('Rule settings loaded:', {
        //     primaryRuleOut: PRIMARY_RULE_OUT_THRESHOLD,
        //     addOnRuleOut: ADD_ON_RULE_OUT_THRESHOLD,
        //     customRules: CUSTOM_RULE_THRESHOLDS
        // });
    } catch (error) {
        console.error('Failed to load rule settings:', error);
    }
};

// Antigen pairs mapping for homozygous checks
export const ANTIGEN_PAIRS: { [key: string]: string } = {
    'C': 'c',
    'c': 'C',
    'E': 'e',
    'e': 'E',
    'K': 'k',
    'k': 'K',
    'Kpa': 'Kpb',
    'Kpb': 'Kpa',
    'Jsa': 'Jsb',
    'Jsb': 'Jsa',
    'Fya': 'Fyb',
    'Fyb': 'Fya',
    'Jka': 'Jkb',
    'Jkb': 'Jka',
    'Lea': 'Leb',
    'Leb': 'Lea',
    'S': 's',
    's': 'S',
    'M': 'N',
    'N': 'M',
    'Lua': 'Lub',
    'Lub': 'Lua',
};

export const isAntigenHomozygous = (cell: CellData, antigen: string): boolean => {
    const pairAntigen = ANTIGEN_PAIRS[antigen];

    if (cell.results[antigen] === '+s') {
        return true;
    }

    if (!pairAntigen) {
        // For antigens without pairs (like D, P1, Xga), just check if positive
        return cell.results[antigen] === '+';
    }

    // For paired antigens, check if upper is positive and lower is negative
    return (cell.results[antigen] === '+') && (cell.results[pairAntigen] === '0' || cell.results[pairAntigen] === 'NT' || cell.results[pairAntigen] === '/');
};

export const isAntigenHeterozygous = (cell: CellData, antigen: string): boolean => {
    
    if (cell.results[antigen] === '+w') {
        return true;
    }

    const pairAntigen = ANTIGEN_PAIRS[antigen];
    if (!pairAntigen) return false;

    // Both antigens must be positive for heterozygous
    return (cell.results[antigen] === '+') && (cell.results[pairAntigen] === '+' || cell.results[pairAntigen] === '+s' || cell.results[pairAntigen] === '+w');
};

export const calculateAntigenScore = (cells: CellData[], antigen: string): RuleScore => {
    let homozygousScore = 0;
    let heterozygousScore = 0;
    const supportingCells: string[] = [];

    cells.forEach(cell => {
        // Only process cells with negative (0) result
        if (cell.results['result'] !== '0') return;

        const isPositive = cell.results[antigen] === '+' || cell.results[antigen] === '+s' || cell.results[antigen] === '+w';
        if (!isPositive) return;

        const isHomozygous = isAntigenHomozygous(cell, antigen);
        const isCurrentHeterozygous = isAntigenHeterozygous(cell, antigen);

        if (isHomozygous) {
            homozygousScore += HOMOZYGOUS_SCORE;
            supportingCells.push(cell.cellId);
        } else if (isCurrentHeterozygous) {
            heterozygousScore += HETEROZYGOUS_SCORE;
            supportingCells.push(cell.cellId);
        }
    });

    return {
        homozygousScore,
        heterozygousScore,
        heterozygousCount: Math.floor(heterozygousScore / HETEROZYGOUS_SCORE),
        homozygousCount: Math.floor(homozygousScore / HOMOZYGOUS_SCORE),
        totalScore: homozygousScore + heterozygousScore,
        supportingCells
    };
};

export const shouldRuleOutAntigen = (
    antigen: string,
    score: RuleScore,
    currentRuleState: AntigenRuleState,
): boolean => {
    // Make sure we've loaded all rule settings
    loadRuleSettings();

    // Special handling for D with add-on rule
    if (antigen === 'D') {
        return score.homozygousCount >= ADD_ON_RULE_OUT_THRESHOLD + PRIMARY_RULE_OUT_THRESHOLD;
    }

    // Primary rule-out: Check if homozygous count meets the primary threshold
    if (score.homozygousCount >= PRIMARY_RULE_OUT_THRESHOLD) {
        return true;
    }

    // Check for custom rule threshold
    if (antigen in CUSTOM_RULE_THRESHOLDS) {
        const threshold = CUSTOM_RULE_THRESHOLDS[antigen];

        // For C and E, also check if D is not ruled out
        if (['C', 'E'].includes(antigen)) {
            const isDNotRuledOut = !currentRuleState['D']?.isRuledOut;
            return isDNotRuledOut && score.heterozygousCount >= threshold;
        }

        // For other antigens, just check the threshold
        return score.heterozygousCount >= threshold;
    }

    // K has special handling if not explicitly defined in custom rules
    if (antigen === 'K' && !(antigen in CUSTOM_RULE_THRESHOLDS)) {
        return score.heterozygousCount >= 1;
    }

    return false;
};