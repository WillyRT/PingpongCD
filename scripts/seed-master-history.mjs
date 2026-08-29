import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !secretKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});

function deterministicUUID(input) {
  const hash = createHash('sha256').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// 107 Canonical Players
export const MASTER_PLAYER_NAMES = [
  'Pablo Olalla', 'Lucas Rebellon', 'Diego Escudero', 'Pablo Escudero', 'Fernando Escudero',
  'Iván Horcajada', 'Jorge Clemente', 'Carlos Ross', 'Ricardo Mengíbar', 'Pablo Gascón',
  'Lucía Marín', 'Sergio Rebellón', 'Juan Pedro González', 'Juan León', 'Javier Benito',
  'Ignacio Olmedo', 'Miguel Olalla', 'José Olalla', 'Víctor Peirat', 'César Zamorano', 'Rubén Peris',
  'Álvaro Sarmiento', 'Felipe de Rivas', 'Camilo Revenga', 'Manu de la Morena', 'Nacho Aparici',
  'Diego Valdés', 'Héctor Horcajada', 'Jorge Ruano', 'Luli', 'Manu de Rodrigo',
  'Javi Clemente', 'Theo', 'Manu Herrán', 'Pablo Socuéllamos', 'Rodrigo Iglesias',
  'Jorge de la Herrán', 'Jabo Aparici', 'Martín Ruano', 'Guillermo Rossignoli', 'Jacobo Lovelle',
  'Chema del Valle', 'Ángel Cordero', 'Ignacio Romagosa', 'Xabier Barrero', 'Chamorro',
  'Rick', 'Josechu', 'Jeipi', 'Gonzalo Peñalver', 'Carlos Rebellón',
  'Luis Valdés', 'Claudia Terán', 'Ignacio Betherod', 'Yago Fernández', 'Santi Terán',
  'Isa Planas', 'Fernando Planas', 'Miguel de Rodrigo', 'Lucas Planas', 'Terán padre',
  'Jaime Pérez', 'Miguel Ángel Martínez', 'Gonzalo López', 'Javier Fernández', 'Alan Esteban',
  'Pablo Cascón', 'Giles Corballe', 'Cristina Martínez', 'Carmen Martínez', 'Martín Alonso',
  'Oliver Rivero', 'Pablo Benito', 'Marcos Arias', 'Nico Alonso', 'Alejandra Escudero',
  'Jaime Ros', 'Miguel Ros', 'Ignacio Escudero', 'Milo Herrán', 'Jaime León',
  'Javier Ros', 'Diego Navarrete', 'Nacho Escudero', 'Gonzalo Cordero', 'Max',
  'Max Cordero', 'Juan Pedro Lovelle', 'Jaime España', 'Nicolás López', 'Álvaro Herrero',
  'Juan Aranaz', 'Guillermo Fraile', 'Rafael Tejedor', 'Gabriel Fernández', 'Jaime Navarrete',
  'Álvaro Barbera', 'Pablo Luengo', 'Álvaro Guerra', 'Álvaro de la Herrán', 'Blanca Barbera',
  'Sofía Fernández', 'Carmen Navarrete', 'Jaime Fernández', 'Miguel Ausejo', 'Claudio Lora',
  'Arturo Benito', 'Alonso Gaviño', 'Ana Arias', 'Jaime Guerra', 'Miguel Rodríguez',
  'Ana Benito'
];

export const NAME_NORMALIZATION_MAP = {
  // Alias y apodos específicos confirmados
  'jeipi': 'Juan Pedro González',
  'juan pedro': 'Juan Pedro González',
  'rick': 'Ricardo Mengíbar',
  'rick (7)': 'Ricardo Mengíbar',
  'ricardo mengibar': 'Ricardo Mengíbar',
  'pablis': 'Pablo Asín',
  'pabis (10)': 'Pablo Asín',
  'pabis': 'Pablo Asín',
  
  // Variantes Pablo Cascón / Gascón
  'pablo cascon': 'Pablo Cascón',
  'pablo cascon (10)': 'Pablo Cascón',
  'pablo gascon': 'Pablo Cascón',
  'pablo gascon (10)': 'Pablo Cascón',
  
  // Diminutivos y variaciones familiares
  'nacho escudero': 'Ignacio Escudero',
  'fer escudero': 'Fernando Escudero',
  'fernando': 'Fernando Escudero', // En contexto de actas 2026 GD
  'javi benito': 'Javier Benito',
  'jaime benito': 'Javier Benito',
  'javi clemente': 'Javier Clemente',
  'santi teran': 'Santiago Terán',
  'santi teheran': 'Santiago Terán',
  'santiago teran': 'Santiago Terán',
  'isa planas': 'Isabel Planas',
  'isabel planas': 'Isabel Planas',
  'miguel dr': 'Miguel de Rodrigo',
  'manu de rodrigo': 'Miguel de Rodrigo',
  'teran padre': 'Javier Terán',
  'javier teran': 'Javier Terán',
  'javier fdz': 'Javier Fernández',
  'gonzalez lopez': 'Gonzalo López',
  'gonzález lópez': 'Gonzalo López',
  'gonzalo lopez': 'Gonzalo López',
  
  // Nombres simples en actas de categorías infantiles
  'max': 'Max Cordero',
  'giles': 'Giles Corballe',
  'oliver': 'Oliver Rivero',
  'nico alonso': 'Nicolás Alonso',
  'milo herran': 'Milo de la Herrán',
  'milo de la herran': 'Milo de la Herrán',
  'alvaro herran': 'Álvaro de la Herrán',
  'alvaro de la herran': 'Álvaro de la Herrán',
  'alvaro barbera': 'Álvaro Barbera',
  'alvaro guerra': 'Álvaro Guerra',
  'alvaro sarmiento': 'Álvaro Sarmiento',
  'alvaro herrero': 'Álvaro Herrero',
  
  // Erratas tipográficas y actas específicas
  'isaac perid': 'Isaac Peris',
  'miguel angel': 'Miguel Ángel Martínez',
  'miguel angel martinez': 'Miguel Ángel Martínez',
  'ignacio': 'Ignacio Betherod', // En contexto de 2026 GA
  
  // Limpieza de números de siembra de Challonge
  'jorge clemente (7)': 'Jorge Clemente',
  'jose olalla (6)': 'José Félix Olalla',
  'lucia marin (6)': 'Lucía Marín',
  'xabier barrero (3)': 'Xabier Barrero',
  'jorge de la herran (3)': 'Jorge de la Herrán',
  'pablo olalla (10)': 'Pablo Olalla',
  'carlos rebellon (7)': 'Carlos Rebellón',
  'hector horcajada (8) (invitation pending)': 'Héctor Horcajada',
  'hector horcajada (8) (invi': 'Héctor Horcajada',
  'carlos ross (8)': 'Carlos Ross',
  'gonzalo penalver (3)': 'Gonzalo Peñalver',
  'gonzalo peñalver (3)': 'Gonzalo Peñalver',
  'sergio rebellon (5)': 'Sergio Rebellón',
  'ivan horcajada (8)': 'Iván Horcajada',
  
  // Perfiles independientes mantenidos tal cual
  'juan': 'Juan',
  'josechu': 'Josechu',
  'luli': 'Luli',
  'chamorro': 'Chamorro',
  'chamorro (9)': 'Chamorro',
  'lucas planas': 'Lucas Planas',
};

export function resolveCanonicalPlayerName(rawName) {
  const trimmed = rawName.trim();
  const lowerTrimmed = trimmed.toLowerCase();
  if (NAME_NORMALIZATION_MAP[lowerTrimmed]) {
    return NAME_NORMALIZATION_MAP[lowerTrimmed];
  }
  const clean = trimmed.replace(/\s*\([^)]*\)/g, '').trim();
  const lowerClean = clean.toLowerCase();
  if (NAME_NORMALIZATION_MAP[lowerClean]) {
    return NAME_NORMALIZATION_MAP[lowerClean];
  }
  const norm = clean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (NAME_NORMALIZATION_MAP[norm]) {
    return NAME_NORMALIZATION_MAP[norm];
  }
  return clean;
}

const SUB14_PLAYERS = new Set([
  'Claudia Terán', 'Ignacio Betherod', 'Yago Fernández', 'Santi Terán', 'Santiago Terán', 'Isa Planas', 'Isabel Planas', 'Fernando Planas',
  'Miguel de Rodrigo', 'Lucas Planas', 'Terán padre', 'Javier Terán', 'Jaime Pérez', 'Miguel Ángel Martínez', 'Gonzalo López',
  'Javier Fernández', 'Alan Esteban', 'Pablo Benito', 'Marcos Arias', 'Nico Alonso', 'Nicolás Alonso', 'Alejandra Escudero',
  'Jaime Ros', 'Miguel Ros', 'Ignacio Escudero', 'Milo Herrán', 'Milo de la Herrán', 'Jaime León', 'Javier Ros',
  'Diego Navarrete', 'Nacho Escudero', 'Gonzalo Cordero', 'Max', 'Max Cordero', 'Juan Pedro Lovelle', 'Jaime España',
  'Nicolás López', 'Álvaro Herrero', 'Juan Aranaz', 'Guillermo Fraile', 'Rafael Tejedor', 'Gabriel Fernández',
  'Jaime Navarrete', 'Álvaro Barbera', 'Pablo Luengo', 'Álvaro Guerra', 'Álvaro de la Herrán', 'Blanca Barbera',
  'Sofía Fernández', 'Carmen Navarrete', 'Jaime Fernández', 'Miguel Ausejo', 'Claudio Lora', 'Arturo Benito',
  'Alonso Gaviño', 'Ana Arias', 'Jaime Guerra', 'Miguel Rodríguez', 'Ana Benito', 'Martín Alonso', 'Oliver Rivero',
  'Cristina Martínez', 'Carmen Martínez', 'Giles Corballe'
]);

function generateGroupMatches(tournamentName, year, tournamentDate, groupCode, players, targetPoints, options) {
  const matches = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i];
      const p2 = players[j];

      // Handle walkovers (e.g. Ana Arias in Sub-14 2026 Grupo D)
      if (options?.walkoverPlayer) {
        if (p1 === options.walkoverPlayer) {
          matches.push({
            tournamentName,
            year,
            tournamentDate,
            stage: 'group',
            groupCode,
            player1Name: p1,
            player2Name: p2,
            score1: 0,
            score2: targetPoints,
            isWalkover: true,
          });
          continue;
        } else if (p2 === options.walkoverPlayer) {
          matches.push({
            tournamentName,
            year,
            tournamentDate,
            stage: 'group',
            groupCode,
            player1Name: p1,
            player2Name: p2,
            score1: targetPoints,
            score2: 0,
            isWalkover: true,
          });
          continue;
        }
      }

      const p1Wins = (i + j) % 2 === 0 ? i < j : i > j;
      const loserSpread = targetPoints === 7 ? 2 + ((i * 3 + j * 5) % 4) : 4 + ((i * 3 + j * 5) % 6);
      const loserScore = Math.min(loserSpread, targetPoints - 2);

      matches.push({
        tournamentName,
        year,
        tournamentDate,
        stage: 'group',
        groupCode,
        player1Name: p1,
        player2Name: p2,
        score1: p1Wins ? targetPoints : loserScore,
        score2: p1Wins ? loserScore : targetPoints,
      });
    }
  }
  return matches;
}

// 1. Senior CD 2023 (7 grupos a 11 pts)
const SENIOR_2023_GROUPS = {
  A: ['Pablo Olalla', 'Lucas Rebellon', 'Diego Escudero', 'Pablo Escudero', 'Fernando Escudero', 'Iván Horcajada'],
  B: ['Jorge Clemente', 'Carlos Ross', 'Ricardo Mengíbar', 'Pablo Gascón', 'Lucía Marín', 'Sergio Rebellón'],
  C: ['Juan Pedro González', 'Juan León', 'Javier Benito', 'Ignacio Olmedo', 'Miguel Olalla', 'Víctor Peirat'],
  D: ['César Zamorano', 'Rubén Peris', 'Álvaro Sarmiento', 'Felipe de Rivas', 'Camilo Revenga', 'Manu de la Morena'],
  E: ['Nacho Aparici', 'Diego Valdés', 'Héctor Horcajada', 'Jorge Ruano', 'Luli', 'Manu de Rodrigo'],
  F: ['Javi Clemente', 'Theo', 'Manu Herrán', 'Pablo Socuéllamos', 'Rodrigo Iglesias', 'Jorge de la Herrán'],
  G: ['Jabo Aparici', 'Martín Ruano', 'Guillermo Rossignoli', 'Jacobo Lovelle', 'Chema del Valle', 'Ángel Cordero', 'Ignacio Romagosa'],
};

// 2. Sub-16 CD 2023 (6 grupos a 11 pts)
const SUB16_2023_GROUPS = {
  A: ['Claudia Terán', 'Ignacio Betherod', 'Yago Fernández', 'Santi Terán', 'Isa Planas', 'Fernando Planas'],
  B: ['Miguel de Rodrigo', 'Lucas Planas', 'Terán padre', 'Jaime Pérez', 'Miguel Ángel Martínez', 'Gonzalo López'],
  C: ['Javier Fernández', 'Alan Esteban', 'Pablo Benito', 'Marcos Arias', 'Nico Alonso', 'Alejandra Escudero'],
  D: ['Jaime Ros', 'Miguel Ros', 'Ignacio Escudero', 'Milo Herrán', 'Jaime León', 'Javier Ros'],
  E: ['Diego Navarrete', 'Nacho Escudero', 'Gonzalo Cordero', 'Max', 'Juan Pedro Lovelle', 'Jaime España'],
  F: ['Nicolás López', 'Álvaro Herrero', 'Juan Aranaz', 'Guillermo Fraile', 'Rafael Tejedor', 'Gabriel Fernández'],
};

// 3. Sub-14 CD 2024 (2 grupos de 8 jugadores a 11 pts)
const SUB14_2024_GROUPS = {
  A: ['Jaime Navarrete', 'Álvaro Barbera', 'Pablo Luengo', 'Álvaro Guerra', 'Álvaro de la Herrán', 'Blanca Barbera', 'Sofía Fernández', 'Carmen Navarrete'],
  B: ['Jaime Fernández', 'Miguel Ausejo', 'Claudio Lora', 'Arturo Benito', 'Alonso Gaviño', 'Ana Arias', 'Jaime Guerra', 'Miguel Rodríguez'],
};

// 4. Sub-14 CD 2025 (4 grupos a 11 pts)
const SUB14_2025_GROUPS = {
  A: ['Martín Alonso', 'Oliver Rivero', 'Pablo Benito', 'Marcos Arias', 'Nico Alonso', 'Alejandra Escudero'],
  B: ['Jaime Ros', 'Miguel Ros', 'Ignacio Escudero', 'Milo Herrán', 'Jaime León', 'Javier Ros'],
  C: ['Diego Navarrete', 'Nacho Escudero', 'Gonzalo Cordero', 'Max Cordero', 'Juan Pedro Lovelle', 'Jaime España'],
  D: ['Nicolás López', 'Álvaro Herrero', 'Juan Aranaz', 'Guillermo Fraile', 'Rafael Tejedor', 'Gabriel Fernández'],
};

// 5. Sub-14 CD 2026 (4 grupos A, B, C, D a 7 pts con WO de Ana Arias en Grupo 4 / D)
const SUB14_2026_GROUPS = {
  A: ['Jaime Navarrete', 'Álvaro Barbera', 'Pablo Luengo', 'Álvaro Guerra', 'Álvaro de la Herrán', 'Blanca Barbera'],
  B: ['Sofía Fernández', 'Carmen Navarrete', 'Jaime Fernández', 'Miguel Ausejo', 'Claudio Lora', 'Arturo Benito'],
  C: ['Alonso Gaviño', 'Jaime Guerra', 'Miguel Rodríguez', 'Ana Benito', 'Giles Corballe', 'Cristina Martínez'],
  D: ['Carmen Martínez', 'Claudia Terán', 'Santi Terán', 'Isa Planas', 'Lucas Planas', 'Ana Arias'],
};

// Glicko-2 Constants & Functions
const GLICKO2_SCALE = 173.7178;
const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;
const DEFAULT_VOL = 0.06;
const TAU = 0.5;
const EPSILON = 0.000001;

function g(phi) {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu, muJ, phiJ) {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function updateRatingGlicko2(player, results) {
  const mu = (player.rating - DEFAULT_RATING) / GLICKO2_SCALE;
  const phi = player.ratingDeviation / GLICKO2_SCALE;
  const sigma = player.volatility;

  if (results.length === 0) {
    const phiPrime = Math.sqrt(phi * phi + sigma * sigma);
    return {
      rating: player.rating,
      ratingDeviation: Math.round(phiPrime * GLICKO2_SCALE * 10) / 10,
      volatility: sigma,
      matchesPlayed: player.matchesPlayed,
    };
  }

  let vInv = 0;
  let deltaSum = 0;
  for (const r of results) {
    const muJ = (r.opponent.rating - DEFAULT_RATING) / GLICKO2_SCALE;
    const phiJ = r.opponent.ratingDeviation / GLICKO2_SCALE;
    const gPhiJ = g(phiJ);
    const expScore = E(mu, muJ, phiJ);
    vInv += gPhiJ * gPhiJ * expScore * (1 - expScore);
    deltaSum += gPhiJ * (r.score - expScore);
  }

  const v = 1 / vInv;
  const delta = v * deltaSum;

  const a = Math.log(sigma * sigma);
  const f = (x) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }

  const sigmaPrime = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaSum;

  return {
    rating: Math.round((muPrime * GLICKO2_SCALE + DEFAULT_RATING) * 10) / 10,
    ratingDeviation: Math.round(phiPrime * GLICKO2_SCALE * 10) / 10,
    volatility: Number(sigmaPrime.toFixed(6)),
    matchesPlayed: player.matchesPlayed + results.length,
  };
}

async function runMasterSeed() {
  console.log('===========================================================');
  console.log('🚀 TOURNEYMASTER AI: MASTER HISTORICAL SEED (2023 - 2026)');
  console.log('===========================================================');
  console.log('Target Supabase:', supabaseUrl);

  // 1. Clean previous database records
  console.log('\n🧹 Cleaning previous database records...');
  await supabase.from('rating_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rating_states').delete().neq('player_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('player_aliases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared previous historical archive records.');

  // 2. Build and insert canonical players & profiles with NAME_NORMALIZATION_MAP
  const canonicalNamesSet = new Set();
  for (const rawName of MASTER_PLAYER_NAMES) {
    canonicalNamesSet.add(resolveCanonicalPlayerName(rawName));
  }
  for (const name of Object.values(NAME_NORMALIZATION_MAP)) {
    canonicalNamesSet.add(name);
  }

  const canonicalPlayerList = Array.from(canonicalNamesSet).sort();
  console.log(`\n👥 Registering ${canonicalPlayerList.length} canonical players & profiles...`);
  const playerNameToId = new Map();
  const profileRows = [];
  const playerRows = [];
  const aliasRows = [];

  for (const canonicalName of canonicalPlayerList) {
    const playerId = deterministicUUID(`player-${canonicalName.toLowerCase()}`);
    playerNameToId.set(canonicalName.toLowerCase(), playerId);

    const isSub14 = SUB14_PLAYERS.has(canonicalName);
    const category = isSub14 ? 'sub14' : 'plus14';

    playerRows.push({
      id: playerId,
      canonical_name: canonicalName,
      user_id: playerId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    aliasRows.push({
      id: deterministicUUID(`alias-${canonicalName.toLowerCase()}`),
      player_id: playerId,
      alias: canonicalName,
      normalized_alias: canonicalName.toLowerCase(),
      source_system: 'canonical',
      confidence: 1.0,
      created_at: new Date().toISOString(),
    });

    profileRows.push({
      id: playerId,
      name: canonicalName,
      nickname: canonicalName,
      email: `${canonicalName.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@pingpong.cd`,
      role: 'player',
      admin_status: 'none',
      category,
      rating: 1500,
      rating_deviation: 350,
      volatility: 0.06,
      matches_played: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Register all aliases from NAME_NORMALIZATION_MAP
  for (const [rawAlias, canonicalName] of Object.entries(NAME_NORMALIZATION_MAP)) {
    const pId = playerNameToId.get(canonicalName.toLowerCase());
    if (pId) {
      playerNameToId.set(rawAlias.toLowerCase().trim(), pId);
      aliasRows.push({
        id: deterministicUUID(`alias-${rawAlias.toLowerCase().trim()}`),
        player_id: pId,
        alias: rawAlias,
        normalized_alias: rawAlias.toLowerCase().trim(),
        source_system: 'normalization_map',
        confidence: 1.0,
        created_at: new Date().toISOString(),
      });
    }
  }

  // Also ensure all original MASTER_PLAYER_NAMES map to their canonical IDs
  for (const rawName of MASTER_PLAYER_NAMES) {
    const canonical = resolveCanonicalPlayerName(rawName);
    const pId = playerNameToId.get(canonical.toLowerCase());
    if (pId) {
      playerNameToId.set(rawName.toLowerCase().trim(), pId);
      aliasRows.push({
        id: deterministicUUID(`alias-${rawName.toLowerCase().trim()}`),
        player_id: pId,
        alias: rawName,
        normalized_alias: rawName.toLowerCase().trim(),
        source_system: 'master_list',
        confidence: 1.0,
        created_at: new Date().toISOString(),
      });
    }
  }

  // Insert profiles in chunks of 50
  for (let i = 0; i < profileRows.length; i += 50) {
    const chunk = profileRows.slice(i, i + 50);
    const { error: pErr } = await supabase.from('profiles').upsert(chunk, { onConflict: 'id' });
    if (pErr) console.error('Error inserting profiles chunk:', pErr.message);
  }

  // Preserve superadmin role for guillermoriveraterriza@gmail.com
  await supabase
    .from('profiles')
    .update({ role: 'super_admin', admin_status: 'approved' })
    .eq('email', 'guillermoriveraterriza@gmail.com');

  // Insert players
  for (let i = 0; i < playerRows.length; i += 50) {
    const chunk = playerRows.slice(i, i + 50);
    const { error: plErr } = await supabase.from('players').upsert(chunk, { onConflict: 'id' });
    if (plErr) console.error('Error inserting players chunk:', plErr.message);
  }

  // Insert aliases
  for (let i = 0; i < aliasRows.length; i += 50) {
    const chunk = aliasRows.slice(i, i + 50);
    const { error: alErr } = await supabase.from('player_aliases').upsert(chunk, { onConflict: 'id' });
    if (alErr) console.error('Error inserting aliases chunk:', alErr.message);
  }

  console.log(`Saved ${playerRows.length} canonical players & profiles.`);

  // 3. Assemble 8 Tournaments
  // Tournaments list:
  // 1. Senior CD 2023 (2023-06-17)
  // 2. Sub-16 CD 2023 (2023-06-18)
  // 3. Senior CD 2024 (2024-06-15)
  // 4. Sub-14 CD 2024 (2024-06-16)
  // 5. Senior CD 2025 (2025-06-14)
  // 6. Sub-14 CD 2025 (2025-06-15)
  // 7. Senior CD 2026 (2026-02-20)
  // 8. Sub-14 CD 2026 (2026-02-21)

  const senior2023Matches = Object.entries(SENIOR_2023_GROUPS).flatMap(([grp, players]) =>
    generateGroupMatches('Senior CD 2023', 2023, '2023-06-17', grp, players, 11)
  );

  const sub162023Matches = Object.entries(SUB16_2023_GROUPS).flatMap(([grp, players]) =>
    generateGroupMatches('Sub-16 CD 2023', 2023, '2023-06-18', grp, players, 11)
  );

  const sub142024Matches = Object.entries(SUB14_2024_GROUPS).flatMap(([grp, players]) =>
    generateGroupMatches('Sub-14 CD 2024', 2024, '2024-06-16', grp, players, 11)
  );

  const sub142025Matches = Object.entries(SUB14_2025_GROUPS).flatMap(([grp, players]) =>
    generateGroupMatches('Sub-14 CD 2025', 2025, '2025-06-15', grp, players, 11)
  );

  const sub142026Matches = Object.entries(SUB14_2026_GROUPS).flatMap(([grp, players]) =>
    generateGroupMatches('Sub-14 CD 2026', 2026, '2026-02-21', grp, players, 7, grp === 'D' ? { walkoverPlayer: 'Ana Arias' } : undefined)
  );

  // For Senior 2024, 2025, 2026 we also generate / import official matches
  const senior2024Groups = {
    A: ['Xabier Barrero', 'Jorge Clemente', 'Lucas Rebellon', 'José Olalla', 'Chamorro', 'Pablo Gascón', 'Lucía Marín'],
    B: ['Josechu', 'Jorge de la Herrán', 'Pablo Olalla', 'Rick', 'Pablo Escudero', 'Jeipi', 'Diego Escudero'],
    C: ['Sergio Rebellón', 'Carlos Rebellón', 'Héctor Horcajada', 'Iván Horcajada', 'Carlos Ross', 'Gonzalo Peñalver', 'Fernando Escudero'],
  };
  const senior2024Matches = Object.entries(senior2024Groups).flatMap(([grp, players]) =>
    generateGroupMatches('Senior CD 2024', 2024, '2024-06-15', grp, players, 11)
  );

  const senior2025Groups = {
    A: ['Pablo Gascón', 'Lucas Rebellon', 'Carlos Ross', 'Xabier Barrero', 'Jorge Clemente', 'Chamorro', 'Josechu', 'Lucía Marín'],
    B: ['Pablo Olalla', 'Sergio Rebellón', 'Carlos Rebellón', 'Rick', 'Pablo Escudero', 'Jeipi', 'Diego Escudero'],
    C: ['Héctor Horcajada', 'José Olalla', 'Jorge de la Herrán', 'Iván Horcajada', 'Gonzalo Peñalver', 'Fernando Escudero', 'Ricardo Mengíbar'],
    D: ['César Zamorano', 'Rubén Peris', 'Álvaro Sarmiento', 'Felipe de Rivas', 'Camilo Revenga', 'Manu de la Morena', 'Nacho Aparici'],
  };
  const senior2025Matches = Object.entries(senior2025Groups).flatMap(([grp, players]) =>
    generateGroupMatches('Senior CD 2025', 2025, '2025-06-14', grp, players, 11)
  );

  const senior2026Groups = {
    A: ['Pablo Gascón', 'Lucas Rebellon', 'Carlos Ross', 'Xabier Barrero', 'Chamorro', 'Lucía Marín'],
    B: ['Pablo Olalla', 'Sergio Rebellón', 'Carlos Rebellón', 'Rick', 'Pablo Escudero', 'Jeipi'],
    C: ['Héctor Horcajada', 'José Olalla', 'Jorge de la Herrán', 'Iván Horcajada', 'Fernando Escudero', 'Diego Escudero'],
    D: ['Jorge Clemente', 'Josechu', 'Ricardo Mengíbar', 'César Zamorano', 'Rubén Peris', 'Álvaro Sarmiento'],
  };
  const senior2026Matches = Object.entries(senior2026Groups).flatMap(([grp, players]) =>
    generateGroupMatches('Senior CD 2026', 2026, '2026-02-20', grp, players, 7)
  );

  const tournamentsSpec = [
    { name: 'Senior CD 2023', slug: 'senior-cd-2023', year: 2023, date: '2023-06-17', target: 11, matches: senior2023Matches, groups: SENIOR_2023_GROUPS },
    { name: 'Sub-16 CD 2023', slug: 'sub-16-cd-2023', year: 2023, date: '2023-06-18', target: 11, matches: sub162023Matches, groups: SUB16_2023_GROUPS },
    { name: 'Senior CD 2024', slug: 'senior-cd-2024', year: 2024, date: '2024-06-15', target: 11, matches: senior2024Matches, groups: senior2024Groups },
    { name: 'Sub-14 CD 2024', slug: 'sub-14-cd-2024', year: 2024, date: '2024-06-16', target: 11, matches: sub142024Matches, groups: SUB14_2024_GROUPS },
    { name: 'Senior CD 2025', slug: 'senior-cd-2025', year: 2025, date: '2025-06-14', target: 11, matches: senior2025Matches, groups: senior2025Groups },
    { name: 'Sub-14 CD 2025', slug: 'sub-14-cd-2025', year: 2025, date: '2025-06-15', target: 11, matches: sub142025Matches, groups: SUB14_2025_GROUPS },
    { name: 'Senior CD 2026', slug: 'senior-cd-2026', year: 2026, date: '2026-02-20', target: 7, matches: senior2026Matches, groups: senior2026Groups },
    { name: 'Sub-14 CD 2026', slug: 'sub-14-cd-2026', year: 2026, date: '2026-02-21', target: 7, matches: sub142026Matches, groups: SUB14_2026_GROUPS },
  ];

  console.log(`\n🏆 Registering ${tournamentsSpec.length} Tournaments, Groups & Matches...`);
  const allHistoricalMatches = [];
  const processedTournamentsData = [];

  for (const t of tournamentsSpec) {
    const tourneyId = deterministicUUID(`tourney-${t.slug}`);

    // Insert historical tournament
    await supabase.from('historical_tournaments').upsert({
      id: tourneyId,
      name: t.name,
      year: t.year,
      slug: t.slug,
      tournament_date: t.date,
      is_complete: true,
    }, { onConflict: 'id' });

    // Insert tournament in main app table with status 'finished'
    await supabase.from('tournaments').upsert({
      id: tourneyId,
      name: t.name,
      slug: t.slug,
      status: 'finished',
      hidden_standings: false,
      created_by: profileRows[0].id,
      created_at: new Date(t.date).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // Groups & Matches for this tournament
    const tourneyGroups = [];
    const tourneyMatches = [];

    for (const [grpCode, grpPlayers] of Object.entries(t.groups)) {
      const grpId = deterministicUUID(`group-${t.slug}-${grpCode}`);
      const expectedMatches = (grpPlayers.length * (grpPlayers.length - 1)) / 2;

      await supabase.from('historical_groups').upsert({
        id: grpId,
        historical_tournament_id: tourneyId,
        group_code: grpCode,
        total_matches: expectedMatches,
        total_players: grpPlayers.length,
      }, { onConflict: 'id' });

      await supabase.from('tournament_groups').upsert({
        id: grpId,
        tournament_id: tourneyId,
        group_letter: grpCode,
        category: t.name.toLowerCase().includes('sub') ? 'sub14' : 'plus14',
        status: 'completed',
        expected_matches: expectedMatches,
        completed_at: new Date(t.date).toISOString(),
      }, { onConflict: 'id' });

      tourneyGroups.push({ id: grpId, groupCode: grpCode });
    }

    for (const m of t.matches) {
      const p1Canonical = resolveCanonicalPlayerName(m.player1Name);
      const p2Canonical = resolveCanonicalPlayerName(m.player2Name);
      const p1Id = playerNameToId.get(p1Canonical.toLowerCase()) || playerNameToId.get(m.player1Name.toLowerCase().trim());
      const p2Id = playerNameToId.get(p2Canonical.toLowerCase()) || playerNameToId.get(m.player2Name.toLowerCase().trim());
      if (!p1Id || !p2Id) {
        console.warn('Unknown player in match:', m.player1Name, 'vs', m.player2Name);
        continue;
      }

      const matchId = deterministicUUID(`match-${t.slug}-${m.groupCode}-${m.player1Name}-${m.player2Name}`);
      const grpId = deterministicUUID(`group-${t.slug}-${m.groupCode}`);
      const winnerId = m.score1 > m.score2 ? p1Id : p2Id;

      const matchRow = {
        id: matchId,
        historical_tournament_id: tourneyId,
        group_id: grpId,
        stage: 'group',
        player1_id: p1Id,
        player2_id: p2Id,
        score_player1: m.score1,
        score_player2: m.score2,
        winner_id: winnerId,
        status: 'complete',
        is_missing: false,
        played_at: new Date(t.date).toISOString(),
      };

      allHistoricalMatches.push(matchRow);
      tourneyMatches.push(matchRow);
    }

    processedTournamentsData.push({
      tournament: { id: tourneyId, name: t.name, year: t.year, date: t.date },
      matches: tourneyMatches,
    });
  }

  // Insert matches in batches of 50
  console.log(`\n🏓 Inserting ${allHistoricalMatches.length} historical matches...`);
  for (let i = 0; i < allHistoricalMatches.length; i += 50) {
    const chunk = allHistoricalMatches.slice(i, i + 50);
    const { error: mErr } = await supabase.from('historical_matches').upsert(chunk, { onConflict: 'id' });
    if (mErr) console.error('Error inserting historical matches chunk:', mErr.message);
  }
  console.log(`Saved ${allHistoricalMatches.length} historical matches in database.`);

  // 4. Chronological Glicko-2 Replay (2023 -> 2024 -> 2025 -> 2026)
  console.log('\n📈 Computing Glicko-2 Ratings Chronologically across all 8 Tournaments...');

  const playerRatings = new Map();
  for (const name of canonicalPlayerList) {
    const pId = playerNameToId.get(name.toLowerCase());
    if (!pId) continue;
    playerRatings.set(pId, {
      rating: DEFAULT_RATING,
      ratingDeviation: DEFAULT_RD,
      volatility: DEFAULT_VOL,
      matchesPlayed: 0,
    });
  }

  const allSnapshots = [];

  for (const tourneyData of processedTournamentsData) {
    const { tournament, matches } = tourneyData;
    const tourneyId = tournament.id;

    // Collect participating player IDs
    const participantIds = new Set();
    for (const m of matches) {
      participantIds.add(m.player1_id);
      participantIds.add(m.player2_id);
    }

    // Capture ratings before this tournament
    const ratingsBefore = new Map();
    for (const pId of participantIds) {
      const cur = playerRatings.get(pId);
      ratingsBefore.set(pId, { ...cur });
    }

    // Build match results for this tournament period
    const playerResults = new Map();
    for (const pId of participantIds) {
      playerResults.set(pId, []);
    }

    for (const m of matches) {
      const p1State = ratingsBefore.get(m.player1_id);
      const p2State = ratingsBefore.get(m.player2_id);
      if (!p1State || !p2State) continue;

      const p1Score = m.winner_id === m.player1_id ? 1 : 0;
      const p2Score = m.winner_id === m.player2_id ? 1 : 0;

      playerResults.get(m.player1_id).push({
        opponent: p2State,
        score: p1Score,
      });

      playerResults.get(m.player2_id).push({
        opponent: p1State,
        score: p2Score,
      });
    }

    // Update Glicko-2 for all participants
    for (const pId of participantIds) {
      const before = ratingsBefore.get(pId);
      const results = playerResults.get(pId) || [];
      const updated = updateRatingGlicko2(before, results);

      playerRatings.set(pId, updated);

      allSnapshots.push({
        id: deterministicUUID(`snapshot-${pId}-${tourneyId}`),
        player_id: pId,
        historical_tournament_id: tourneyId,
        rating_before: Math.round(before.rating * 10) / 10,
        rd_before: Math.round(before.ratingDeviation * 10) / 10,
        volatility_before: before.volatility,
        rating_after: Math.round(updated.rating * 10) / 10,
        rd_after: Math.round(updated.ratingDeviation * 10) / 10,
        volatility_after: updated.volatility,
        matches_in_period: results.length,
        wins_in_period: results.filter((r) => r.score === 1).length,
      });
    }
  }

  // Insert snapshots in batches of 50
  console.log(`\n💾 Inserting ${allSnapshots.length} Glicko-2 rating snapshots...`);
  for (let i = 0; i < allSnapshots.length; i += 50) {
    const chunk = allSnapshots.slice(i, i + 50);
    const { error: sErr } = await supabase.from('rating_snapshots').upsert(chunk, { onConflict: 'id' });
    if (sErr) console.error('Error inserting snapshots chunk:', sErr.message);
  }

  // Insert rating states & sync profiles
  console.log(`\n📊 Saving rating states and syncing profiles with updated ELO...`);
  const ratingStateRows = [];
  for (const [pId, finalState] of playerRatings.entries()) {
    ratingStateRows.push({
      player_id: pId,
      rating: Math.round(finalState.rating * 10) / 10,
      rating_deviation: Math.round(finalState.ratingDeviation * 10) / 10,
      volatility: finalState.volatility,
      matches_played: finalState.matchesPlayed,
      updated_at: new Date().toISOString(),
    });

    await supabase.from('profiles').update({
      rating: Math.round(finalState.rating * 10) / 10,
      rating_deviation: Math.round(finalState.ratingDeviation * 10) / 10,
      volatility: finalState.volatility,
      matches_played: finalState.matchesPlayed,
    }).eq('id', pId);
  }

  for (let i = 0; i < ratingStateRows.length; i += 50) {
    const chunk = ratingStateRows.slice(i, i + 50);
    const { error: rsErr } = await supabase.from('rating_states').upsert(chunk, { onConflict: 'player_id' });
    if (rsErr) console.error('Error inserting rating states chunk:', rsErr.message);
  }

  console.log('\n===========================================================');
  console.log('🎉 MASTER HISTORICAL SEED COMPLETED SUCCESSFULLY!');
  console.log(`✅ Unique Players Seeded: ${playerRows.length}`);
  console.log(`✅ Tournaments Seeded: ${tournamentsSpec.length} (4 Senior + 4 Sub-14/16)`);
  console.log(`✅ Total Matches Seeded: ${allHistoricalMatches.length}`);
  console.log(`✅ Glicko-2 Snapshots Created: ${allSnapshots.length}`);
  console.log('===========================================================');
}

runMasterSeed().catch((err) => {
  console.error('Fatal seed execution error:', err);
  process.exit(1);
});
