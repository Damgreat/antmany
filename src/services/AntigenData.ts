import DatabaseService from '../services/DatabaseService';
import {AntigenGroups} from '../types';

  // export const ANTIGEN_MANUFACTURERS = [
  //   "ALBA",
  //   "ALBAcyte",
  //   "Ortho",
  //   "BioTest",
  //   "Immucor",
  //   "Medion",
  //   "Grifols",
  //   "Quotient",
  //   "Bio-Rad",
  // ] as const;

    export const ANTIGEN_MANUFACTURERS = [
    "Create New",
    "ALBA",
    "ORTHO",
    "BIOTEST",
    "IMMUCOR",
    "MEDION",
    "GRIFOLS",
    "QUOTIENT",
    "BIO-RAD",
  ];

  export const DEFAULT_GROUP_ORDER = [
    "Rh-hr", 
    "KELL", 
    "DUFFY", 
    "KIDD", 
    "LEWIS", 
    "MNS", 
    "P", 
    "LUTHERAN", 
    "SEX", 
    "COLTON", 
    "DIEGO", 
    "Additonal Antigens", 
  ];

    export const ORTHO_GROUP_ORDER = [
    "Rh-hr",
    "KELL",
    "DUFFY",
    "KIDD",
    "SEX",
    "LEWIS",
    "MNS",
    "P",
    "LUTHERAN",
    "Others Special"
  ];

    export const BIOTEST_GROUP_ORDER = [
    "Rh-hr",
    "KELL",
    "DUFFY",
    "LUTHERAN",
    "KIDD",
    "MNS",
    "LEWIS",
    "P",
    "SEX",
    "COLTON",
    "DIEGO",
    "Additonal Antigens",
  ];

    export const IMMUCOR_GROUP_ORDER = [
    "Rh-hr",
    "KELL",
    "DUFFY",
    "KIDD",
    "LEWIS",
    "P",
    "MNS",
    "LUTHERAN",
    "SEX",
    "Additonal Antigens",
  ];

    export const MEDION_GROUP_ORDER = [
    "Rh-hr",
    "MNS",
    "P",
    "LEWIS",
    "LUTHERAN",
    "KELL",
    "DUFFY",
    "KIDD",
    "SEX",
    "Additonal Antigens",
  ];

    export const QUOTIENT_GROUP_ORDER = [
    "Rh-hr",
    "KELL",
    "DUFFY",
    "KIDD",
    "LEWIS",
    "MNS",
    "P",
    "LUTHERAN",
    "SEX",
    "COLTON",
    "DIEGO",
    "Additonal Antigens",
  ];

  export const BIORAD_GROUP_ORDER = [
    "Rh-hr",
    "KELL",
    "DUFFY",
    "KIDD",
    "LEWIS",
    "P",
    "MNS",
    "LUTHERAN",
    "SEX",
  ];

  export const BIORAD_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "E", "c", "e", "f"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"],
    DUFFY: ["Fya", "Fyb"],
    KIDD: ["Jka", "Jkb"],
    LEWIS: ["Lea", "Leb"],
    P: ["P1"],
    MNS: ["M", "N", "S", "s"],
    LUTHERAN: ["Lua", "Lub"],
    SEX: ["Xga"],
  };

    export const BIORAD_GRIFOLS_GROUP_ORDER = [
    "Rh-hr",
    "KELL",
    "DUFFY",
    "KIDD",
    "LEWIS",
    "P",
    "MNS",
    "LUTHERAN",
    "DIEGO",
    "Additonal Antigens",
  ];

    export const ALBA_GROUP_ORDER = [
    "Rh-hr",
    "KELL",
    "DUFFY",
    "KIDD",
    "LEWIS",
    "MNS",
    "P",
    "LUTHERAN",
    "SEX",
    "Additonal Antigens",
  ];


    export const DEFAULT_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "E", "c", "e", "f", "V", "Cw"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"],
    DUFFY: ["Fya", "Fyb"],
    KIDD: ["Jka", "Jkb"],
    LEWIS: ["Lea", "Leb"],
    MNS: ["M", "N", "S", "s"],
    P: ["P1"],
    LUTHERAN: ["Lua", "Lub"],
    SEX: ["Xga"],
    COLTON: ["Coa", "Cob"],
    DIEGO: ["Dia", "Dib"],
    "Additonal Antigens": ["Wr"],
  };

  export const GROUP_MEMBERS: Record<string, Set<string>> = {
    "Rh-hr": new Set(["D", "C", "E", "c", "e", "f", "Cw", "V"]),
    KELL: new Set(["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"]),
    DUFFY: new Set(["Fya", "Fyb"]),
    KIDD: new Set(["Jka", "Jkb"]),
    "SEX": new Set(["Xga"]),
    LEWIS: new Set(["Lea", "Leb"]),
    MNS: new Set(["S", "s", "M", "N"]),
    P: new Set(["P1"]),
    LUTHERAN: new Set(["Lua", "Lub"]),
    "Additonal Antigens": new Set(["Wr"]),
    COLTON: new Set(["Coa", "Cob"]),
    DIEGO: new Set(["Dia", "Dib"]),
  };

  export const ORTHO_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "E", "c", "e", "f", "Cw", "V"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"],
    DUFFY: ["Fya", "Fyb"],
    KIDD: ["Jka", "Jkb"],
    "SEX": ["Xga"],
    LEWIS: ["Lea", "Leb"],
    MNS: ["S", "s", "M", "N"],
    P: ["P1"],
    LUTHERAN: ["Lua", "Lub"],
    "Additonal Antigens": [""],
  };

  export const ALBA_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "E", "c", "e", "f", "V", "Cw"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"],
    DUFFY: ["Fya", "Fyb"],
    KIDD: ["Jka", "Jkb"],
    LEWIS: ["Lea", "Leb"],
    MNS: ["M", "N", "S", "s"],
    P: ["P1"],
    LUTHERAN: ["Lua", "Lub"],
    "SEX": ["Xga"],
    "Additonal Antigens": ["Wr"],
  };

  export const QUOTIENT_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "E", "c", "e", "f", "V", "Cw"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"],
    DUFFY: ["Fya", "Fyb"],
    KIDD: ["Jka", "Jkb"],
    LEWIS: ["Lea", "Leb"],
    MNS: ["M", "N", "S", "s"],
    P: ["P1"],
    LUTHERAN: ["Lua", "Lub"],
    "SEX": ["Xga"],
    "Additonal Antigens": ["Wra"],
  };

  export const MEDION_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "E", "c", "e", "f", "Cw", "V"],
    MNS: ["M", "N", "S", "s"],
    P: ["P1"],
    LEWIS: ["Lea", "Leb"],
    LUTHERAN: ["Lua", "Lub"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa"],
    DUFFY: ["Fya", "Fyb"],
    KIDD: ["Jka", "Jkb"],
    "SEX": ["Xga"],
    "Additonal Antigens": ["Wr"],
  };

  export const BIOTEST_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "E", "c", "e", "Cw"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"],
    DUFFY: ["Fya", "Fyb"],
    LUTHERAN: ["Lua", "Lub"],
    KIDD: ["Jka", "Jkb"],
    MNS: ["M", "N", "S", "s"],
    LEWIS: ["Lea", "Leb"],
    P: ["P1"],
    "SEX": ["Xga"],
    "COLTON": ["Coa", "Cob"],
    "DIEGO": ["Dia", "Dib"],
  };

  export const BIORAD_GRIFOLS_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "E", "c", "e", "Cw"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"],
    DUFFY: ["Fya", "Fyb"],
    KIDD: ["Jka", "Jkb"],
    LEWIS: ["Lea", "Leb"],
    P: ["P1"],
    MNS: ["M", "N", "S", "s"],
    LUTHERAN: ["Lua", "Lub"],
    "DIEGO": ["Dia"],
  };

  export const IMMUCOR_GROUP_MEMBERS: Record<string, string[]> = {
    "Rh-hr": ["D", "C", "c", "E", "e", "V", "Cw"],
    KELL: ["K", "k", "Kpa", "Kpb", "Jsa", "Jsb"],
    DUFFY: ["Fya", "Fyb"],
    KIDD: ["Jka", "Jkb"],
    LEWIS: ["Lea", "Leb"],
    P: ["P1"],
    MNS: ["M", "N", "S", "s"],
    LUTHERAN: ["Lua", "Lub"],
    "SEX": ["Xga"],
  };

  //   // 1. Define a type for your selection
  // type MemberSource = 'DEFAULT' | 'ALBA' | 'ORTHO' | 'BIOTEST' | 'IMMUCOR' | 'MEDION' | 'GRIFOLS' | 'QUOTIENT' | 'BIO-RAD';
  
  // 2. Map the names to the actual data structures
  export const DataSources: Record<typeof ANTIGEN_MANUFACTURERS[number], Record<string, string[]>> = {
    "Create New": DEFAULT_GROUP_MEMBERS,
    "ALBA": ALBA_GROUP_MEMBERS,
    "ORTHO": ORTHO_GROUP_MEMBERS,
    "BIOTEST": BIOTEST_GROUP_MEMBERS,
    "IMMUCOR": IMMUCOR_GROUP_MEMBERS,
    "MEDION": MEDION_GROUP_MEMBERS,
    "GRIFOLS": BIORAD_GRIFOLS_GROUP_MEMBERS,
    "QUOTIENT": QUOTIENT_GROUP_MEMBERS,
    "BIO-RAD": BIORAD_GROUP_MEMBERS
  };

  export const MANUFACTURER_GRPORDER_MAP: Record<typeof ANTIGEN_MANUFACTURERS[number], string[]> = {
    "Create New": DEFAULT_GROUP_ORDER, 
    ORTHO: ORTHO_GROUP_ORDER,
    ALBA: ALBA_GROUP_ORDER,
    BIOTEST: BIOTEST_GROUP_ORDER,
    IMMUCOR: IMMUCOR_GROUP_ORDER,
    MEDION: MEDION_GROUP_ORDER,
    GRIFOLS: BIORAD_GRIFOLS_GROUP_ORDER,
    QUOTIENT: QUOTIENT_GROUP_ORDER,
    "BIO-RAD": BIORAD_GROUP_ORDER,
  };

  export interface OcrSchemaColumnDefinition {
    key: string;
    label: string;
    kind: 'analysis' | 'supplemental';
    required: boolean;
    aliases?: string[];
  }

  export interface OcrSchemaGroupDefinition {
    group: string;
    aliases?: string[];
    columns: OcrSchemaColumnDefinition[];
  }

  const buildSchemaFromGroups = (
    groups: Record<string, string[]>,
  ): OcrSchemaGroupDefinition[] =>
    Object.entries(groups).map(([group, columns]) => ({
      group,
      aliases: group === 'Additonal Antigens'
        ? ['Additional Antigens', 'Others Special']
        : undefined,
      columns: columns
        .filter(Boolean)
        .map(column => ({
          key: column,
          label: column,
          kind: 'analysis' as const,
          required: true,
          aliases: column === 'Wr' ? ['Wra'] : undefined,
        })),
    }));

  export const ALBA_OCR_RENDER_SCHEMA: OcrSchemaGroupDefinition[] = [
    {
      group: 'Rh-hr',
      columns: ['D', 'C', 'E', 'c', 'e', 'f', 'V', 'Cw'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'V' ? {aliases: ['*V']} : {}),
      })),
    },
    {
      group: 'KELL',
      columns: ['K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'DUFFY',
      columns: ['Fya', 'Fyb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'KIDD',
      columns: ['Jka', 'Jkb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'LEWIS',
      columns: ['Lea', 'Leb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'MNS',
      columns: ['M', 'N', 'S', 's'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'P',
      columns: [{
        key: 'P1',
        label: 'P1',
        kind: 'analysis' as const,
        required: true,
      }],
    },
    {
      group: 'LUTHERAN',
      columns: ['Lua', 'Lub'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'Additional Antigens',
      aliases: ['Additonal Antigens', 'AdditionalAntigens'],
      columns: [
        {
          key: 'Xga',
          label: 'Xga',
          kind: 'analysis',
          required: true,
        },
        {
          key: 'Wra',
          label: 'Wra',
          kind: 'analysis',
          required: true,
          aliases: ['Wr'],
        },
        {
          key: 'Special Types',
          label: 'Special Types',
          kind: 'supplemental',
          required: false,
          aliases: ['SpecialTypes'],
        },
      ],
    },
  ];

  export const ORTHO_OCR_RENDER_SCHEMA: OcrSchemaGroupDefinition[] = [
    {
      group: 'Rh-hr',
      aliases: ['Rh-hr', 'Rhhr'],
      columns: ['D', 'C', 'E', 'c', 'e', 'f', 'Cw', 'V'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Cw' ? {aliases: ['C^w', 'Cw']} : {}),
        ...(column === 'V' ? {aliases: ['*V', 'V']} : {}),
      })),
    },
    {
      group: 'KELL',
      columns: ['K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Kpa' ? {aliases: ['Kp^a', 'Kpa']} : {}),
        ...(column === 'Kpb' ? {aliases: ['Kp^b', 'Kpb']} : {}),
        ...(column === 'Jsa' ? {aliases: ['Js^a', 'Jsa']} : {}),
        ...(column === 'Jsb' ? {aliases: ['Js^b', 'Jsb', '/']} : {}),
      })),
    },
    {
      group: 'DUFFY',
      aliases: ['Duffy', 'Duffy (Shaded)'],
      columns: ['Fya', 'Fyb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Fya' ? {aliases: ['Fy^a', 'Fya', 'Fy']} : {}),
        ...(column === 'Fyb' ? {aliases: ['Fy^b', 'Fyb']} : {}),
      })),
    },
    {
      group: 'KIDD',
      columns: ['Jka', 'Jkb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Jka' ? {aliases: ['Jk^a', 'Jka', 'Jk']} : {}),
        ...(column === 'Jkb' ? {aliases: ['Jk^b', 'Jkb']} : {}),
      })),
    },
    {
      group: 'SEX',
      aliases: ['Sex Linked', 'SexLinked', 'Xg'],
      columns: [{
        key: 'Xga',
        label: 'Xga',
        kind: 'analysis' as const,
        required: true,
        aliases: ['Xg^a', 'Xga', 'Xg*'],
      }],
    },
    {
      group: 'LEWIS',
      aliases: ['Lewis', 'Laws'],
      columns: ['Lea', 'Leb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Lea' ? {aliases: ['Le^a', 'Lea', 'Le']} : {}),
        ...(column === 'Leb' ? {aliases: ['Le^b', 'Leb']} : {}),
      })),
    },
    {
      group: 'MNS',
      aliases: ['MNS', 'MNS (Shaded)'],
      columns: ['S', 's', 'M', 'N'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'P',
      columns: [{
        key: 'P1',
        label: 'P1',
        kind: 'analysis' as const,
        required: true,
      }],
    },
    {
      group: 'LUTHERAN',
      aliases: ['Lutheran', 'Luth.'],
      columns: ['Lua', 'Lub'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Lua' ? {aliases: ['Lu^a', 'Lua', 'Lu']} : {}),
        ...(column === 'Lub' ? {aliases: ['Lu^b', 'Lub']} : {}),
      })),
    },
    {
      group: 'Additional Antigens',
      aliases: ['Additonal Antigens', 'Special Antigen Typing'],
      columns: [{
        key: 'Special Antigen Typing',
        label: 'Special Antigen Typing',
        kind: 'supplemental' as const,
        required: false,
        aliases: ['SpecialAntigenTyping', 'HLA'],
      }],
    },
  ];

  export const BIORAD_OCR_RENDER_SCHEMA: OcrSchemaGroupDefinition[] = [
    {
      group: 'Rh-hr',
      aliases: ['Rh-hr', 'Rhhr', 'Spezifität', 'Spezifitat'],
      columns: ['D', 'C', 'E', 'c', 'e', 'f'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'KELL',
      columns: ['K', 'k', 'Kpa', 'Kpb', 'Jsa', 'Jsb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Kpa' ? {aliases: ['Kp^a', 'Kpa']} : {}),
        ...(column === 'Kpb' ? {aliases: ['Kp^b', 'Kpb']} : {}),
        ...(column === 'Jsa' ? {aliases: ['Js^a', 'Jsa']} : {}),
        ...(column === 'Jsb' ? {aliases: ['Js^b', 'Jsb']} : {}),
      })),
    },
    {
      group: 'DUFFY',
      aliases: ['Duffy'],
      columns: ['Fya', 'Fyb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Fya' ? {aliases: ['Fy^a', 'Fya', 'Fy']} : {}),
        ...(column === 'Fyb' ? {aliases: ['Fy^b', 'Fyb']} : {}),
      })),
    },
    {
      group: 'KIDD',
      columns: ['Jka', 'Jkb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Jka' ? {aliases: ['Jk^a', 'Jka', 'Jk']} : {}),
        ...(column === 'Jkb' ? {aliases: ['Jk^b', 'Jkb']} : {}),
      })),
    },
    {
      group: 'LEWIS',
      aliases: ['Lewis', 'Laws'],
      columns: ['Lea', 'Leb'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Lea' ? {aliases: ['Le^a', 'Lea', 'Le']} : {}),
        ...(column === 'Leb' ? {aliases: ['Le^b', 'Leb']} : {}),
      })),
    },
    {
      group: 'P',
      columns: [{
        key: 'P1',
        label: 'P1',
        kind: 'analysis' as const,
        required: true,
      }],
    },
    {
      group: 'MNS',
      aliases: ['MNS'],
      columns: ['M', 'N', 'S', 's'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
      })),
    },
    {
      group: 'LUTHERAN',
      aliases: ['Lutheran', 'Luth.', 'Luth'],
      columns: ['Lua', 'Lub'].map(column => ({
        key: column,
        label: column,
        kind: 'analysis' as const,
        required: true,
        ...(column === 'Lua' ? {aliases: ['Lu^a', 'Lua', 'Lu']} : {}),
        ...(column === 'Lub' ? {aliases: ['Lu^b', 'Lub']} : {}),
      })),
    },
    {
      group: 'SEX',
      aliases: ['Sex Linked', 'Xg'],
      columns: [{
        key: 'Xga',
        label: 'Xga',
        kind: 'analysis' as const,
        required: true,
        aliases: ['Xg^a', 'Xga', 'Xg*'],
      }],
    },
    {
      group: 'Test Results',
      aliases: [
        'Test Results',
        'TestResults',
        'Nativ',
        'Native',
        'Immediate',
        'Directo',
        'Enzym',
      ],
      columns: [
        {
          key: 'Native',
          label: 'Native',
          kind: 'supplemental' as const,
          required: false,
          aliases: ['Nativ', 'Native', 'Immediate', 'Directo'],
        },
        {
          key: 'Enzym',
          label: 'Enzym',
          kind: 'supplemental' as const,
          required: false,
          aliases: ['Enzyme', 'Enzym', 'Easym', 'Eazym'],
        },
        {
          key: '37C',
          label: '37C',
          kind: 'supplemental' as const,
          required: false,
          aliases: ['37°C', '37C', 'PETC', 'Petc'],
        },
        {
          key: 'Remarks',
          label: 'Remarks',
          kind: 'supplemental' as const,
          required: false,
          aliases: ['Bemerkungen', 'Remarks', 'Remarques', 'Observaciones', 'Waarnemingen'],
        },
      ],
    },
  ];

  export const OCR_RENDER_SCHEMAS: Record<string, OcrSchemaGroupDefinition[]> = {
    'Create New': buildSchemaFromGroups(DEFAULT_GROUP_MEMBERS),
    ALBA: ALBA_OCR_RENDER_SCHEMA,
    ORTHO: ORTHO_OCR_RENDER_SCHEMA,
    BIOTEST: buildSchemaFromGroups(BIOTEST_GROUP_MEMBERS),
    IMMUCOR: buildSchemaFromGroups(IMMUCOR_GROUP_MEMBERS),
    MEDION: buildSchemaFromGroups(MEDION_GROUP_MEMBERS),
    GRIFOLS: buildSchemaFromGroups(BIORAD_GRIFOLS_GROUP_MEMBERS),
    QUOTIENT: buildSchemaFromGroups(QUOTIENT_GROUP_MEMBERS),
    'BIO-RAD': BIORAD_OCR_RENDER_SCHEMA,
  };

  export const getOcrRenderSchema = (manufacturer: string): OcrSchemaGroupDefinition[] =>
    OCR_RENDER_SCHEMAS[manufacturer] ?? OCR_RENDER_SCHEMAS['Create New'];

  export const getOcrRenderableGroups = (manufacturer: string): AntigenGroups => {
    const schema = getOcrRenderSchema(manufacturer);
    return schema.reduce((groups, schemaGroup) => {
      groups[schemaGroup.group] = schemaGroup.columns.map(column => column.key);
      return groups;
    }, {} as AntigenGroups);
  };

  export const getOcrAnalysisGroups = (manufacturer: string): AntigenGroups => {
    const schema = getOcrRenderSchema(manufacturer);
    return schema.reduce((groups, schemaGroup) => {
      groups[schemaGroup.group] = schemaGroup.columns
        .filter(column => column.kind === 'analysis')
        .map(column => column.key);
      return groups;
    }, {} as AntigenGroups);
  };

  export const getOcrRequiredColumnKeys = (manufacturer: string): string[] =>
    getOcrRenderSchema(manufacturer)
      .flatMap(group => group.columns)
      .filter(column => column.required)
      .map(column => column.key);

  export const loadAntSettings = async (): Promise<void> => {
      try {
          // Initialize the database first
          await DatabaseService.initDatabase();
  
          // Load primary rule out threshold
          const manuSetting = await DatabaseService.getSetting('manuchoice');
          if (manuSetting) {
              //  = manuSetting.value.toString;
          }
  
      } catch (error) {
          console.error('Failed to load rule settings:', error);
      }
  };
  
