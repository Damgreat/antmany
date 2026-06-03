import { PanelData, RuleResult, CellData, ResultValue } from '../types';

export class RuleEngine {
    // Special antigens that require manual override
    private static SPECIAL_ANTIGENS = ['C', 'E', 'K'];

    // Homozygous patterns
    private static HOMOZYGOUS_PATTERNS = {
        'Rh-hr': ['D', 'C', 'E', 'c', 'e', 'f'],
        'KELL': ['K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb'],
        'DUFFY': ['Fya', 'Fyb'],
        'KIDD': ['Jka', 'Jkb'],
        'LEWIS': ['Lea', 'Leb'],
        'MNS': ['S', 's', 'M', 'N'],
        'LUTHERAN': ['Lua', 'Lub']
    };

    static processRules(panel: PanelData): RuleResult[] {
        const rules: RuleResult[] = [];

        // Process homozygous rules
        rules.push(...this.processHomozygousRules(panel));

        // Process heterozygous rules
        rules.push(...this.processHeterozygousRules(panel));

        return rules;
    }

    static processHomozygousRules(panel: PanelData): RuleResult[] {
        const rules: RuleResult[] = [];

        panel.antigens.forEach(antigen => {
            const homozygousResult = this.checkHomozygous(panel.cells, antigen);
            if (homozygousResult) {
                rules.push({
                    type: 'homozygous',
                    antigen,
                    confidence: 1,
                    cells: homozygousResult.cells,
                    indicator: 'X'
                });
            }
        });

        return rules;
    }

    static processHeterozygousRules(panel: PanelData): RuleResult[] {
        const rules: RuleResult[] = [];

        this.SPECIAL_ANTIGENS.forEach(antigen => {
            const heterozygousResult = this.checkHeterozygous(panel.cells, antigen);
            if (heterozygousResult) {
                rules.push({
                    type: 'heterozygous',
                    antigen,
                    confidence: heterozygousResult.confidence,
                    cells: heterozygousResult.cells,
                    indicator: 'slash'
                });
            }
        });

        return rules;
    }

    private static checkHomozygous(cells: CellData[], antigen: string) {
        const positiveCells = cells.filter(cell => cell.results[antigen] === '+');
        const hasNegative = cells.some(cell => cell.results[antigen] === '0');

        // For homozygous pattern, all results should be either + or 0
        const isValidPattern = cells.every(cell =>
            cell.results[antigen] === '+' ||
            cell.results[antigen] === '0' ||
            cell.results[antigen] === null
        );

        if (positiveCells.length > 0 && !hasNegative && isValidPattern) {
            return {
                cells: positiveCells.map(cell => cell.cellId),
                confidence: 1
            };
        }

        return null;
    }

    private static checkHeterozygous(cells: CellData[], antigen: string) {
        // For special antigens (C, E, K), check both uppercase and lowercase
        const lowerAntigen = antigen.toLowerCase();

        const heterozygousCells = cells.filter(cell => {
            const mainResult = cell.results[antigen];
            const pairedResult = cell.results[lowerAntigen];

            return mainResult === '+' && pairedResult === '+';
        });

        if (heterozygousCells.length >= 2) {
            return {
                cells: heterozygousCells.map(cell => cell.cellId),
                confidence: heterozygousCells.length / cells.length
            };
        }

        return null;
    }

    static validateRuleOut(panel: PanelData, antigen: string): boolean {
        // Check if the antigen has a negative result
        const hasNegative = panel.cells.some(cell => cell.results[antigen] === '0');

        if (!hasNegative) {
            return false;
        }

        // For special antigens, require two heterozygous cells or manual override
        if (this.SPECIAL_ANTIGENS.includes(antigen)) {
            const heterozygousResult = this.checkHeterozygous(panel.cells, antigen);
            return heterozygousResult !== null && heterozygousResult.cells.length >= 2;
        }

        // For other antigens, check homozygous pattern
        const homozygousResult = this.checkHomozygous(panel.cells, antigen);
        return homozygousResult !== null;
    }

    static getAntigenStatus(
        panel: PanelData,
        antigen: string,
        result: ResultValue
    ): {
        isRuledOut: boolean;
        heterozygousCount: number;
        needsOverride: boolean;
    } {
        const isRuledOut = this.validateRuleOut(panel, antigen);
        const heterozygousCount = this.SPECIAL_ANTIGENS.includes(antigen)
            ? this.getHeterozygousCount(panel.cells, antigen)
            : 0;
        const needsOverride = this.SPECIAL_ANTIGENS.includes(antigen) &&
            heterozygousCount >= 2 &&
            result === '0';

        return {
            isRuledOut,
            heterozygousCount,
            needsOverride
        };
    }

    private static getHeterozygousCount(cells: CellData[], antigen: string): number {
        const lowerAntigen = antigen.toLowerCase();
        return cells.filter(cell =>
            cell.results[antigen] === '+' &&
            cell.results[lowerAntigen] === '+'
        ).length;
    }

    static getCellHighlight(cells: CellData[], cellId: string, antigen: string, result: ResultValue): boolean {
        if (result !== '0') return false;

        return cells.some(cell =>
            cell.cellId !== cellId &&
            cell.results[antigen] === '+'
        );
    }
}