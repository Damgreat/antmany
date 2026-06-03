export type ResultValue = '+' | '0' | '/' | '+s' | '+w' | 'NT' | '' | '?' | null;

export type PanelType = 'Panel A' | 'Panel B' | 'Panel C' | 'Surgiscreen';

export interface PanelCell {
    cellId?: string;
    cellNumber?: number;
    donorInfo?: string;
    results: {
      [key: string]: ResultValue;
    };
    phenotype?: string;
    notes?: string;
  }
// Antigen Related Types
export interface AntigenGroup {
    name: string;
    antigens: string[];
}

export interface Antigen {
    id: string;
    name: string;
    displayName: string;
    position: number;
    group: string;
    isEnzymeDestroyed?: boolean;
}

// Cell Related Types
export interface CellResult {
    [antigenId: string]: ResultValue;
}

export interface AntigenRuleState extends RuleState {
    [antigenId: string]: {
        overridden: any;
        isRuledOut: boolean;
        heterozygousCount: number;
        homozygousCount: number;
        manualOverride: boolean;
        cells: string[];
        score: number;
        isSpecialAntigen: boolean;
    };
}

export interface CellData {
    rowNumber: string;
    cellId: string;
    donorNumber: string;
    phenotype: string;
    results: CellResult;
    specialNotations?: string[];
}

export interface ParsedColumnLayout {
    key: string;
    label: string;
    group: string;
    sourceColumn: number;
    headerPath: string[];
    kind?: 'analysis' | 'supplemental' | 'side' | 'result';
    required?: boolean;
}

export interface OcrColumnGroup {
    group: string;
    children: string[];
}

export interface OcrUnreadableCell {
    rowIndex: number;
    columnKey: string;
    reason: 'low_confidence' | 'invalid_symbol' | 'manual_review';
    suggestedValue: ResultValue | '' | null;
    required: boolean;
}

export interface OcrValidationIssue {
    code:
        | 'unmapped_header'
        | 'missing_column'
        | 'duplicate_column'
        | 'unexpected_column'
        | 'group_mismatch';
    severity: 'error' | 'warning';
    message: string;
    sourceColumn?: number;
    columnKey?: string;
    group?: string;
}

export interface OcrStructuredRow {
    cellNumber: string;
    rhHr: string;
    donor: string;
    values: {
        [key: string]: ResultValue | string | null;
    };
}

export interface OcrStructureMetrics {
    textScore: number;
    cellValueScore: number;
    structureScore: number;
    mappingScore: number;
    completenessScore: number;
    overallScore: number;
    /** Spec formula: ((n × X) − invalidValues) / (n × X) × 100. ≥95 = pass. */
    extractionAccuracy: number;
    missingColumns: string[];
    duplicateColumns: string[];
    unexpectedColumns: string[];
    groupMismatches: string[];
    detectedHeaderRows: number[];
    detectedDataStartRow: number;
}

// Panel Related Types
export interface PanelMetadata {
    manufacturer: string;
    lotNumber: string;
    expirationDate: string;
    panelType: PanelType;
    testName: string;
    shadedColumns?: string[];
    footerNotes?: string[];
    columnLayout?: ParsedColumnLayout[];
    columnGroups?: OcrColumnGroup[];
    unreadableCells?: OcrUnreadableCell[];
    validationIssues?: OcrValidationIssue[];
    structuredRows?: OcrStructuredRow[];
    ocrMetrics?: OcrStructureMetrics;
}

export interface PanelData {
    id?: string;
    cells: CellData[];
    antigens: string[];
    metadata: PanelMetadata;
    antigenGroups: AntigenGroups;
    results?: CellResult;
}
export interface DualPanelData {
    firstPanel: PanelData;
    secondPanel: PanelData;
}

// Rule Related Types
export interface RuleResult {
    type: 'homozygous' | 'heterozygous';
    antigen: string;
    confidence: number;
    cells: string[];
    indicator: 'X' | 'slash' | null;
}
export interface DualScanResult {
    first: ScanResult;
    second: ScanResult;
}

export interface RuleState {
    [antigenId: string]: {
        overridden: any;
        isRuledOut: boolean;
        heterozygousCount: number;
        homozygousCount: number;
        manualOverride: boolean;
        cells: string[];
    };
}

// Processing Related Types
export interface ProcessedPanel {
    id: string;
    scanData: {
        originalImage: string;
        processedImage: string;
        confidence: number;
    };
    metadata: PanelMetadata & {
        scanDate: Date;
        processedDate: Date;
        version: string;
    };
    antigenGroups: {
        [groupName: string]: string[];
    };
    cells: CellData[];
}

export interface ScanResult {
    original: string;
    processed: string;
    confidence: number;
    results: PanelData;
}

// Validation Related Types
export interface ValidationRules {
    donorNumberLength: number;
    validResults: ResultValue[];
    specialNotations: string[];
    requireConfidence: boolean;
    minimumConfidence: number;
}

export interface ProcessingConfig {
    validation: ValidationRules;
    resultMapping: {
        positive: string[];
        negative: string[];
        slash: string[];
        strongPositive: string[];
    };
    specialMarkers: {
        hla: string[];
        enzymeDestroyed: string[];
        other: string[];
    };
}

// Antigen Groups
export interface AntigenGroups {
    'ABScreen'?: string[];
    'Rh-hr': string[];
    'KELL': string[];
    'DUFFY': string[];
    'KIDD': string[];
    'SEX': string[];
    'LEWIS': string[];
    'MNS': string[];
    'P': string[];
    'LUTHERAN': string[];
    'COLTON': string[];
    'DIEGO': string[];
    'Patient Result'?: string[];
    [key: string]: string[];
}

// Analysis Types
export interface AnalysisResult {
    antigen: string;
    status: 'ruled-out' | 'possible' | 'confirmed';
    confidence: number;
    supportingCells: string[];
    pattern: string;
    notes?: string[];
}

export interface AntibodyPattern {
    antigen: string;
    requiredPositives: number;
    requiredNegatives: number;
    requiredHeterozygous: number;
    specialConditions?: {
        enzymeRequired?: boolean;
        temperatureRequired?: string;
    };
}

export interface AnalysisState {
    ruledOutAntigens: string[];
    possibleAntibodies: AnalysisResult[];
    confirmedAntibodies: AnalysisResult[];
    pendingTests?: string[];
    notes: string[];
}

export type AntigenGroupName =
    | 'ABScreen'
    | 'Rh-hr'
    | 'KELL'
    | 'DUFFY'
    | 'KIDD'
    | 'SEX'
    | 'LEWIS'
    | 'MNS'
    | 'P'
    | 'LUTHERAN'
    | 'COLTON'
    | 'DIEGO'
    | 'Patient Result'
    | 'Special Antigen Typing'
    | 'Test Results';

export type CommonAntigen =
    | 'D' | 'C' | 'E' | 'c' | 'e' | 'f' | 'Cw' | 'V'
    | 'K' | 'k' | 'Kpa' | 'Kpb'
    | 'Jsa' | 'Jsb' | 'Fya' | 'Fyb'
    | 'Jka' | 'Jkb'
    | 'Xga'
    | 'Lea' | 'Leb'
    | 'S' | 's' | 'M' | 'N'
    | 'P1'
    | 'Lua' | 'Lub'
    | 'Coa' | 'Cob'
    | 'Dia' | 'Dib';

export interface HomozygousPattern {
    name: string;
    antigens: string[];
    expected: '+';
}

export interface ProcessingOptions {
    enhanceContrast?: boolean;
    detectBoundaries?: boolean;
    correctPerspective?: boolean;
    validateResults?: boolean;
    confidenceThreshold?: number;
    detectSpecialMarkers?: boolean;
    checkEnzymeDestroyedColumns?: boolean;
    lubValidation?: boolean;
}
