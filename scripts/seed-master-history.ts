import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Auto-load .env.local if variables are missing
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

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

function deterministicUUID(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// 1. MAPA DE NORMALIZACIÓN DE IDENTIDADES
export const NAME_MAP: Record<string, string> = {
  'jeipi': 'Juan Pedro González',
  'juan pedro': 'Juan Pedro González',
  'rick': 'Ricardo Mengíbar',
  'rick (7)': 'Ricardo Mengíbar',
  'ricardo mengibar': 'Ricardo Mengíbar',
  'pablis': 'Pablo Asín',
  'pabis': 'Pablo Asín',
  'pabis (10)': 'Pablo Asín',
  'pablo cascon': 'Pablo Cascón',
  'pablo cascon (10)': 'Pablo Cascón',
  'pablo gascon': 'Pablo Cascón',
  'pablo gascon (10)': 'Pablo Cascón',
  'nacho escudero': 'Ignacio Escudero',
  'fer escudero': 'Fernando Escudero',
  'fernando': 'Fernando Escudero',
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
  'isaac perid': 'Isaac Peris',
  'miguel angel': 'Miguel Ángel Martínez',
  'miguel angel martinez': 'Miguel Ángel Martínez',
  'ignacio': 'Ignacio Betherod',
  'jose olalla (6)': 'José Félix Olalla',
  'lucia marin (6)': 'Lucía Marín',
  'xabier barrero (3)': 'Xabier Barrero',
  'jorge de la herran (3)': 'Jorge de la Herrán',
  'pablo olalla (10)': 'Pablo Olalla',
  'carlos rebellon (7)': 'Carlos Rebellón',
  'hector horcajada (8) (invitation pending)': 'Héctor Horcajada',
  'carlos ross (8)': 'Carlos Ross',
  'gonzalo penalver (3)': 'Gonzalo Peñalver',
  'gonzalo peñalver (3)': 'Gonzalo Peñalver',
  'sergio rebellon (5)': 'Sergio Rebellón',
  'ivan horcajada (8)': 'Iván Horcajada',
  'juan': 'Juan',
  'josechu': 'Josechu',
  'luli': 'Luli',
  'chamorro': 'Chamorro',
  'chamorro (9)': 'Chamorro',
  'lucas planas': 'Lucas Planas'
};

export const NAME_NORMALIZATION_MAP = NAME_MAP;

export function resolveCanonicalPlayerName(rawName: string): string {
  const trimmed = rawName.trim();
  const lowerTrimmed = trimmed.toLowerCase();
  if (NAME_MAP[lowerTrimmed]) {
    return NAME_MAP[lowerTrimmed]!;
  }
  const clean = trimmed.replace(/\s*\([^)]*\)/g, '').trim();
  const lowerClean = clean.toLowerCase();
  if (NAME_MAP[lowerClean]) {
    return NAME_MAP[lowerClean]!;
  }
  const norm = clean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (NAME_MAP[norm]) {
    return NAME_MAP[norm]!;
  }
  return clean;
}

const SUB14_PLAYERS = new Set<string>([
  'Claudia Terán', 'Ignacio Betherod', 'Yago Fernández', 'Santi Terán', 'Santiago Terán',
  'Isa Planas', 'Isabel Planas', 'Fernando Planas', 'Lucas Planas',
  'Jaime Pérez', 'Miguel Ángel Martínez', 'Gonzalo López', 'Javier Fernández',
  'Alan Esteban', 'Pablo Benito', 'Marcos Arias', 'Nico Alonso', 'Nicolás Alonso',
  'Alejandra Escudero', 'Jaime Ros', 'Miguel Ros', 'Ignacio Escudero', 'Milo Herrán',
  'Milo de la Herrán', 'Jaime León', 'Javier Ros', 'Diego Navarrete', 'Nacho Escudero',
  'Gonzalo Cordero', 'Max', 'Max Cordero', 'Juan Pedro Lovelle', 'Jaime España',
  'Nicolás López', 'Álvaro Herrero', 'Juan Aranaz', 'Guillermo Fraile', 'Rafael Tejedor',
  'Gabriel Fernández', 'Jaime Navarrete', 'Álvaro Barbera', 'Pablo Luengo', 'Álvaro Guerra',
  'Álvaro de la Herrán', 'Blanca Barbera', 'Sofía Fernández', 'Carmen Navarrete',
  'Jaime Fernández', 'Miguel Ausejo', 'Claudio Lora', 'Arturo Benito', 'Alonso Gaviño',
  'Ana Arias', 'Jaime Guerra', 'Miguel Rodríguez', 'Ana Benito', 'Martín Alonso',
  'Oliver Rivero', 'Cristina Martínez', 'Carmen Martínez', 'Giles Corballe',
  'Javier Escudero', 'Pablo Asín'
]);

export type MatchTuple = [string, string, number, number];

export interface TournamentDef {
  name: string;
  slug: string;
  year: number;
  date: string;
  target: number;
  groups: Record<string, MatchTuple[]>;
}

// 2. DATASET AUDITADO DE PARTIDOS OFICIALES [Winner, Loser, ScoreW, ScoreL]
export const AUDITED_TOURNAMENTS: TournamentDef[] = [
  // 1. Senior CD 2023
  {
    name: 'Senior CD 2023',
    slug: 'senior-cd-2023',
    year: 2023,
    date: '2023-06-17',
    target: 11,
    groups: {
      G1: [
        ['Felipe de Rivas', 'Lucía Marín', 11, 8],
        ['Álvaro Sarmiento', 'Felipe de Rivas', 11, 5],
        ['Álvaro Sarmiento', 'Miguel Olalla', 11, 6],
        ['Miguel Olalla', 'Lucía Marín', 11, 3],
        ['Álvaro Sarmiento', 'Lucía Marín', 11, 8],
        ['Felipe de Rivas', 'Camilo Revenga', 11, 8],
      ],
      G2: [
        ['Manu de la Morena', 'Nacho Aparici', 11, 8],
        ['Iván Horcajada', 'Diego Valdés', 11, 9],
        ['Manu de la Morena', 'Iván Horcajada', 11, 8],
        ['Diego Valdés', 'Manu de la Morena', 11, 8],
        ['Iván Horcajada', 'Nacho Aparici', 12, 10],
      ],
      G3: [
        ['Sergio Rebellón', 'Luli', 11, 3],
        ['Pablo Cascón', 'Jorge Clemente', 11, 4],
        ['Jorge Clemente', 'Luli', 11, 2],
        ['Sergio Rebellón', 'Jorge Ruano', 11, 6],
        ['Jorge Clemente', 'Jorge Ruano', 11, 2],
        ['Pablo Cascón', 'Luli', 11, 3],
        ['Pablo Cascón', 'Jorge Ruano', 11, 5],
        ['Jorge Clemente', 'Sergio Rebellón', 12, 10],
        ['Pablo Cascón', 'Sergio Rebellón', 11, 3],
        ['Jorge Ruano', 'Luli', 11, 6],
      ],
      G4: [
        ['Miguel de Rodrigo', 'Javier Villamediana', 12, 10],
        ['Javier Clemente', 'Miguel de Rodrigo', 12, 10],
        ['Javier Villamediana', 'Manu Herrán', 11, 3],
        ['Javier Clemente', 'Javier Villamediana', 11, 9],
      ],
      G5: [
        ['Pablo Olalla', 'Pablo Socuéllamos', 11, 4],
        ['Sergio Horcajada', 'Gonzalo López', 11, 2],
        ['Pablo Olalla', 'Sergio Horcajada', 11, 3],
        ['Carlos Rebellón', 'Pablo Socuéllamos', 11, 7],
        ['Carlos Rebellón', 'Sergio Horcajada', 11, 8],
        ['Pablo Olalla', 'Gonzalo López', 11, 4],
        ['Carlos Rebellón', 'Gonzalo López', 11, 4],
        ['Pablo Socuéllamos', 'Sergio Horcajada', 11, 4],
        ['Pablo Socuéllamos', 'Gonzalo López', 11, 2],
        ['Pablo Olalla', 'Carlos Rebellón', 11, 3],
      ],
      G6: [
        ['Rodrigo Iglesias', 'Jorge de la Herrán', 11, 5],
        ['Jabo Aparici', 'Guillermo Rossignoli', 11, 7],
        ['Jabo Aparici', 'Jorge de la Herrán', 11, 8],
        ['Rodrigo Iglesias', 'Martín Ruano', 11, 7],
        ['Martín Ruano', 'Jabo Aparici', 11, 9],
        ['Guillermo Rossignoli', 'Jorge de la Herrán', 11, 7],
        ['Martín Ruano', 'Guillermo Rossignoli', 11, 9],
        ['Jabo Aparici', 'Rodrigo Iglesias', 15, 13],
        ['Rodrigo Iglesias', 'Guillermo Rossignoli', 11, 3],
        ['Martín Ruano', 'Jorge de la Herrán', 11, 6],
      ],
      G7: [
        ['Jacobo Lovelle', 'Chema del Valle', 11, 9],
        ['Ángel Cordero', 'Ricardo Mengíbar', 11, 6],
        ['Chema del Valle', 'Ricardo Mengíbar', 12, 10],
        ['Jacobo Lovelle', 'Ignacio Romagosa', 11, 9],
        ['Ignacio Romagosa', 'Ricardo Mengíbar', 11, 9],
        ['Ángel Cordero', 'Chema del Valle', 11, 5],
        ['Ángel Cordero', 'Ignacio Romagosa', 11, 6],
        ['Jacobo Lovelle', 'Ricardo Mengíbar', 11, 8],
        ['Jacobo Lovelle', 'Ángel Cordero', 11, 3],
        ['Chema del Valle', 'Ignacio Romagosa', 11, 6],
      ],
    },
  },

  // 2. Sub-16 CD 2023
  {
    name: 'Sub-16 CD 2023',
    slug: 'sub-16-cd-2023',
    year: 2023,
    date: '2023-06-18',
    target: 11,
    groups: {
      G1: [
        ['Max Cordero', 'Jaime León', 11, 1],
        ['Juan Pedro Lovelle', 'Max Cordero', 11, 3],
        ['Juan Pedro Lovelle', 'Jaime León', 11, 2],
      ],
      G2: [
        ['Pablo Escudero', 'Juan León', 11, 6],
        ['Lucas Rebellón', 'Juan León', 11, 1],
        ['Lucas Rebellón', 'Pablo Escudero', 11, 6],
      ],
      G3: [
        ['Gonzalo Cordero', 'Milo de la Herrán', 11, 5],
        ['Jaime España', 'Milo de la Herrán', 11, 3],
        ['Jaime España', 'Gonzalo Cordero', 11, 6],
      ],
      G4: [
        ['Pablo Orgaz', 'Nicolás López', 11, 1],
        ['Nicolás López', 'Alejandra Escudero', 11, 4],
        ['Pablo Orgaz', 'Alejandra Escudero', 11, 2],
      ],
      G5: [
        ['Álvaro Herrero', 'Carlos Rebellón', 11, 2],
        ['Isaac Peris', 'Carlos Rebellón', 11, 3],
        ['Isaac Peris', 'Álvaro Herrero', 11, 4],
      ],
      G6: [
        ['Rubén Peris', 'Guillermo Fraile', 11, 2],
        ['Guillermo Fraile', 'Juan Aranaz', 11, 7],
        ['Rubén Peris', 'Juan Aranaz', 11, 3],
      ],
    },
  },

  // 3. Senior CD 2024
  {
    name: 'Senior CD 2024',
    slug: 'senior-cd-2024',
    year: 2024,
    date: '2024-06-15',
    target: 11,
    groups: {
      G1: [
        ['Xabier Barrero', 'José Félix Olalla', 11, 9],
        ['Pablo Cascón', 'Lucas Rebellón', 11, 5],
        ['Chamorro', 'Lucía Marín', 11, 6],
        ['Lucas Rebellón', 'Lucía Marín', 11, 2],
        ['Pablo Cascón', 'Xabier Barrero', 11, 3],
        ['Jorge Clemente', 'José Félix Olalla', 11, 4],
        ['Pablo Cascón', 'Jorge Clemente', 15, 13],
        ['Lucía Marín', 'Xabier Barrero', 11, 6],
        ['Lucas Rebellón', 'Chamorro', 11, 0],
        ['Chamorro', 'Xabier Barrero', 11, 7],
        ['Jorge Clemente', 'Lucía Marín', 11, 5],
        ['Pablo Cascón', 'José Félix Olalla', 11, 7],
        ['José Félix Olalla', 'Lucía Marín', 11, 8],
        ['Jorge Clemente', 'Chamorro', 11, 6],
        ['Lucas Rebellón', 'Xabier Barrero', 11, 6],
        ['Lucas Rebellón', 'Jorge Clemente', 11, 8],
        ['José Félix Olalla', 'Chamorro', 11, 9],
        ['Pablo Cascón', 'Lucía Marín', 11, 7],
        ['Pablo Cascón', 'Chamorro', 11, 5],
        ['Lucas Rebellón', 'José Félix Olalla', 11, 9],
        ['Jorge Clemente', 'Xabier Barrero', 11, 3],
      ],
      G2: [
        ['Ricardo Mengíbar', 'Josechu', 12, 10],
        ['Juan Pedro González', 'Pablo Olalla', 11, 9],
        ['Pablo Escudero', 'Diego Escudero', 11, 6],
        ['Pablo Olalla', 'Diego Escudero', 11, 4],
        ['Josechu', 'Juan Pedro González', 11, 8],
        ['Ricardo Mengíbar', 'Jorge de la Herrán', 11, 7],
        ['Juan Pedro González', 'Jorge de la Herrán', 11, 7],
        ['Diego Escudero', 'Josechu', 12, 10],
        ['Pablo Olalla', 'Pablo Escudero', 11, 7],
        ['Pablo Escudero', 'Josechu', 16, 14],
        ['Diego Escudero', 'Jorge de la Herrán', 11, 3],
        ['Juan Pedro González', 'Ricardo Mengíbar', 11, 9],
        ['Diego Escudero', 'Ricardo Mengíbar', 11, 7],
        ['Pablo Escudero', 'Jorge de la Herrán', 11, 2],
        ['Pablo Olalla', 'Josechu', 11, 2],
        ['Pablo Olalla', 'Jorge de la Herrán', 11, 2],
        ['Pablo Escudero', 'Ricardo Mengíbar', 11, 3],
        ['Juan Pedro González', 'Diego Escudero', 11, 9],
        ['Pablo Escudero', 'Juan Pedro González', 11, 5],
        ['Pablo Olalla', 'Ricardo Mengíbar', 11, 9],
        ['Jorge de la Herrán', 'Josechu', 11, 8],
      ],
      G3: [
        ['Pablo Asín', 'Sergio Rebellón', 11, 8],
        ['Héctor Horcajada', 'Carlos Ross', 11, 2],
        ['Iván Horcajada', 'Gonzalo Peñalver', 11, 7],
        ['Héctor Horcajada', 'Gonzalo Peñalver', 11, 4],
        ['Sergio Rebellón', 'Carlos Ross', 11, 7],
        ['Pablo Asín', 'Carlos Rebellón', 11, 8],
        ['Carlos Ross', 'Carlos Rebellón', 11, 8],
        ['Sergio Rebellón', 'Gonzalo Peñalver', 11, 7],
        ['Héctor Horcajada', 'Iván Horcajada', 11, 5],
        ['Iván Horcajada', 'Sergio Rebellón', 11, 8],
        ['Carlos Rebellón', 'Gonzalo Peñalver', 11, 4],
        ['Pablo Asín', 'Carlos Ross', 11, 3],
        ['Pablo Asín', 'Gonzalo Peñalver', 11, 2],
        ['Iván Horcajada', 'Carlos Rebellón', 11, 8],
        ['Héctor Horcajada', 'Sergio Rebellón', 11, 7],
        ['Héctor Horcajada', 'Carlos Rebellón', 11, 4],
        ['Pablo Asín', 'Iván Horcajada', 11, 9],
        ['Gonzalo Peñalver', 'Carlos Ross', 11, 8],
        ['Iván Horcajada', 'Carlos Ross', 11, 3],
        ['Pablo Asín', 'Héctor Horcajada', 11, 9],
        ['Sergio Rebellón', 'Carlos Rebellón', 11, 7],
      ],
    },
  },

  // 4. Sub-14 CD 2024
  {
    name: 'Sub-14 CD 2024',
    slug: 'sub-14-cd-2024',
    year: 2024,
    date: '2024-06-16',
    target: 11,
    groups: {
      G1: [
        ['Carlos Rebellón', 'Martín Alonso', 11, 2],
        ['Nicolás Alonso', 'Pablo Asín', 11, 3],
        ['Diego Navarrete', 'Lucas Rebellón', 11, 9],
        ['Juan Pedro González', 'Ignacio Escudero', 11, 6],
        ['Juan Pedro González', 'Diego Navarrete', 11, 9],
        ['Ignacio Escudero', 'Martín Alonso', 11, 6],
        ['Lucas Rebellón', 'Pablo Asín', 11, 9],
        ['Carlos Rebellón', 'Nicolás Alonso', 11, 4],
        ['Juan Pedro González', 'Pablo Asín', 11, 9],
        ['Lucas Rebellón', 'Carlos Rebellón', 11, 9],
        ['Nicolás Alonso', 'Martín Alonso', 11, 3],
        ['Diego Navarrete', 'Ignacio Escudero', 11, 4],
        ['Lucas Rebellón', 'Nicolás Alonso', 11, 3],
        ['Pablo Asín', 'Ignacio Escudero', 11, 1],
        ['Diego Navarrete', 'Carlos Rebellón', 11, 3],
        ['Diego Navarrete', 'Martín Alonso', 11, 1],
        ['Pablo Asín', 'Diego Navarrete', 11, 9],
        ['Juan Pedro González', 'Nicolás Alonso', 11, 4],
        ['Ignacio Escudero', 'Carlos Rebellón', 11, 5],
        ['Lucas Rebellón', 'Martín Alonso', 11, 3],
        ['Ignacio Escudero', 'Nicolás Alonso', 11, 8],
        ['Diego Navarrete', 'Carlos Rebellón', 11, 4],
        ['Pablo Asín', 'Martín Alonso', 11, 1],
        ['Lucas Rebellón', 'Juan Pedro González', 11, 8],
        ['Lucas Rebellón', 'Ignacio Escudero', 11, 5],
        ['Juan Pedro González', 'Martín Alonso', 11, 3],
        ['Diego Navarrete', 'Nicolás Alonso', 11, 3],
        ['Pablo Asín', 'Carlos Rebellón', 11, 5],
      ],
      G2: [
        ['Fernando Escudero', 'Gonzalo Cordero', 11, 4],
        ['Alan Esteban', 'Oliver Rivero', 11, 1],
        ['Pablo Cascón', 'Alejandra Escudero', 13, 11],
        ['Max Cordero', 'Javier Benito', 11, 7],
        ['Max Cordero', 'Alejandra Escudero', 11, 0],
        ['Gonzalo Cordero', 'Javier Benito', 12, 10],
        ['Pablo Cascón', 'Oliver Rivero', 11, 9],
        ['Fernando Escudero', 'Alan Esteban', 11, 2],
        ['Max Cordero', 'Oliver Rivero', 11, 6],
        ['Fernando Escudero', 'Pablo Cascón', 11, 4],
        ['Alan Esteban', 'Gonzalo Cordero', 11, 0],
        ['Javier Benito', 'Alejandra Escudero', 11, 2],
        ['Pablo Cascón', 'Alan Esteban', 12, 10],
        ['Javier Benito', 'Oliver Rivero', 11, 2],
        ['Fernando Escudero', 'Max Cordero', 16, 14],
        ['Alejandra Escudero', 'Gonzalo Cordero', 11, 9],
        ['Oliver Rivero', 'Alejandra Escudero', 11, 9],
        ['Max Cordero', 'Alan Esteban', 11, 4],
        ['Fernando Escudero', 'Javier Benito', 11, 3],
        ['Pablo Cascón', 'Gonzalo Cordero', 11, 9],
        ['Javier Benito', 'Alan Esteban', 11, 1],
        ['Fernando Escudero', 'Alejandra Escudero', 11, 5],
        ['Gonzalo Cordero', 'Oliver Rivero', 11, 9],
        ['Max Cordero', 'Pablo Cascón', 13, 11],
        ['Javier Benito', 'Pablo Cascón', 11, 3],
        ['Max Cordero', 'Gonzalo Cordero', 11, 5],
        ['Alan Esteban', 'Alejandra Escudero', 11, 7],
        ['Fernando Escudero', 'Oliver Rivero', 11, 2],
      ],
    },
  },

  // 5. Senior CD 2025
  {
    name: 'Senior CD 2025',
    slug: 'senior-cd-2025',
    year: 2025,
    date: '2025-06-14',
    target: 11,
    groups: {
      G1: [
        ['Pablo Olalla', 'Carlos Ross', 11, 2],
        ['Lucas Rebellón', 'Diego Escudero', 11, 9],
        ['José Félix Olalla', 'Gabi', 11, 8],
        ['Lucas Rebellón', 'José Félix Olalla', 11, 4],
        ['Carlos Ross', 'Gabi', 11, 3],
        ['Sanz', 'Diego Escudero', 11, 9],
        ['Pablo Olalla', 'Borja Chavarrí', 11, 7],
        ['José Félix Olalla', 'Sanz', 11, 1],
        ['Pablo Olalla', 'Diego Escudero', 11, 5],
        ['Lucas Rebellón', 'Gabi', 11, 3],
        ['Diego Escudero', 'Borja Chavarrí', 11, 7],
        ['Gabi', 'Sanz', 11, 9],
        ['Pablo Olalla', 'José Félix Olalla', 11, 6],
        ['Lucas Rebellón', 'Carlos Ross', 11, 9],
        ['Lucas Rebellón', 'Sanz', 11, 7],
        ['José Félix Olalla', 'Borja Chavarrí', 11, 2],
        ['Pablo Olalla', 'Gabi', 11, 4],
        ['Diego Escudero', 'Carlos Ross', 13, 11],
        ['Pablo Olalla', 'Lucas Rebellón', 12, 10],
        ['Carlos Ross', 'Sanz', 11, 2],
        ['Diego Escudero', 'José Félix Olalla', 11, 7],
        ['Diego Escudero', 'Gabi', 11, 4],
        ['Carlos Ross', 'José Félix Olalla', 11, 9],
        ['Sanz', 'Borja Chavarrí', 11, 2],
        ['Pablo Olalla', 'Sanz', 11, 7],
      ],
      G2: [
        ['Ricardo Mengíbar', 'Fernando Escudero', 11, 8],
        ['Pablo Orgaz', 'Sergio Rebellón', 11, 9],
        ['Jorge Clemente', 'Pablo Escudero', 11, 8],
        ['Jorge Clemente', 'Sergio Rebellón', 11, 6],
        ['Ricardo Mengíbar', 'Pablo Orgaz', 12, 10],
        ['Fernando Escudero', 'Juan León', 11, 9],
        ['Pablo Orgaz', 'Juan León', 11, 8],
        ['Jorge Clemente', 'Ricardo Mengíbar', 11, 1],
        ['Pablo Escudero', 'Sergio Rebellón', 11, 8],
        ['Pablo Escudero', 'Ricardo Mengíbar', 12, 10],
        ['Juan León', 'Jorge Clemente', 11, 9],
        ['Fernando Escudero', 'Pablo Orgaz', 11, 9],
        ['Jorge Clemente', 'Fernando Escudero', 11, 8],
        ['Pablo Escudero', 'Juan León', 11, 9],
        ['Ricardo Mengíbar', 'Sergio Rebellón', 11, 7],
        ['Sergio Rebellón', 'Juan León', 11, 7],
        ['Pablo Escudero', 'Fernando Escudero', 11, 9],
        ['Pablo Orgaz', 'Jorge Clemente', 11, 2],
        ['Pablo Escudero', 'Pablo Orgaz', 11, 3],
        ['Sergio Rebellón', 'Fernando Escudero', 11, 7],
        ['Ricardo Mengíbar', 'Juan León', 12, 10],
      ],
      G3: [
        ['Pablo Cascón', 'Juan Pedro González', 11, 7],
        ['Héctor Horcajada', 'Jose Olmedo', 11, 1],
        ['Jose Olmedo', 'Mario Gil', 12, 10],
        ['Pablo Cascón', 'Berni Arias', 11, 4],
        ['Isaac Peris', 'Juan Pedro González', 11, 9],
        ['Pablo Cascón', 'Jose Olmedo', 11, 6],
        ['Héctor Horcajada', 'Mario Gil', 11, 4],
        ['Héctor Horcajada', 'Pablo Cascón', 11, 7],
        ['Isaac Peris', 'Jose Olmedo', 11, 5],
        ['Juan Pedro González', 'Berni Arias', 11, 5],
        ['Juan Pedro González', 'Jose Olmedo', 11, 6],
        ['Héctor Horcajada', 'Isaac Peris', 11, 6],
        ['Mario Gil', 'Pablo Cascón', 11, 9],
        ['Isaac Peris', 'Mario Gil', 11, 9],
        ['Héctor Horcajada', 'Juan Pedro González', 11, 7],
        ['Juan Pedro González', 'Mario Gil', 11, 2],
        ['Pablo Cascón', 'Isaac Peris', 11, 9],
      ],
      G4: [
        ['Edu Olmedo', 'Javier Benito', 14, 12],
        ['Miguel Olalla', 'Rubén Peris', 11, 3],
        ['Víctor Peirat', 'César Zamorano', 11, 6],
        ['Víctor Peirat', 'Rubén Peris', 11, 9],
        ['Miguel Olalla', 'Javier Benito', 11, 8],
        ['Edu Olmedo', 'Ignacio Olmedo', 11, 7],
        ['Miguel Olalla', 'Ignacio Olmedo', 11, 7],
        ['Víctor Peirat', 'Javier Benito', 11, 5],
        ['César Zamorano', 'Rubén Peris', 11, 3],
        ['César Zamorano', 'Javier Benito', 11, 7],
        ['Ignacio Olmedo', 'Víctor Peirat', 11, 5],
        ['Edu Olmedo', 'Miguel Olalla', 11, 6],
        ['Víctor Peirat', 'Edu Olmedo', 11, 9],
        ['César Zamorano', 'Ignacio Olmedo', 11, 2],
        ['Javier Benito', 'Rubén Peris', 11, 8],
        ['Rubén Peris', 'Ignacio Olmedo', 11, 5],
        ['César Zamorano', 'Edu Olmedo', 11, 9],
        ['Víctor Peirat', 'Miguel Olalla', 11, 7],
        ['Miguel Olalla', 'César Zamorano', 11, 7],
        ['Edu Olmedo', 'Rubén Peris', 11, 7],
        ['Javier Benito', 'Ignacio Olmedo', 11, 5],
      ],
    },
  },

  // 6. Sub-14 CD 2025
  {
    name: 'Sub-14 CD 2025',
    slug: 'sub-14-cd-2025',
    year: 2025,
    date: '2025-06-15',
    target: 11,
    groups: {
      G1: [
        ['Alan Esteban', 'Cristina Martínez', 11, 3],
        ['Giles Corballe', 'Carmen Martínez', 11, 3],
        ['Alan Esteban', 'Carmen Martínez', 11, 1],
        ['Pablo Cascón', 'Cristina Martínez', 11, 0],
        ['Pablo Cascón', 'Carmen Martínez', 11, 3],
        ['Alan Esteban', 'Giles Corballe', 12, 10],
        ['Pablo Cascón', 'Giles Corballe', 11, 2],
        ['Carmen Martínez', 'Cristina Martínez', 11, 4],
        ['Giles Corballe', 'Cristina Martínez', 11, 4],
        ['Pablo Cascón', 'Alan Esteban', 11, 2],
      ],
      G2: [
        ['Marcos Arias', 'Martín Alonso', 11, 7],
        ['Oliver Rivero', 'Pablo Benito', 11, 4],
        ['Oliver Rivero', 'Marcos Arias', 11, 1],
        ['Pablo Benito', 'Martín Alonso', 11, 3],
        ['Pablo Benito', 'Marcos Arias', 11, 4],
        ['Oliver Rivero', 'Martín Alonso', 11, 4],
      ],
      G3: [
        ['Nicolás Alonso', 'Jaime Ros', 11, 4],
        ['Javier Benito', 'Alejandra Escudero', 11, 2],
        ['Javier Benito', 'Jaime Ros', 11, 2],
        ['Alejandra Escudero', 'Nicolás Alonso', 11, 9],
        ['Jaime Ros', 'Alejandra Escudero', 11, 7],
        ['Javier Benito', 'Nicolás Alonso', 11, 3],
      ],
      G4: [
        ['Ignacio Escudero', 'Miguel Ros', 11, 1],
        ['Milo de la Herrán', 'Jaime León', 11, 4],
        ['Milo de la Herrán', 'Ignacio Escudero', 11, 5],
        ['Javier Ros', 'Miguel Ros', 11, 3],
        ['Milo de la Herrán', 'Javier Ros', 11, 3],
        ['Jaime León', 'Ignacio Escudero', 13, 11],
        ['Jaime León', 'Javier Ros', 11, 0],
        ['Milo de la Herrán', 'Miguel Ros', 11, 0],
        ['Jaime León', 'Miguel Ros', 11, 2],
        ['Ignacio Escudero', 'Javier Ros', 11, 2],
      ],
    },
  },

  // 7. Senior CD 2026
  {
    name: 'Senior CD 2026',
    slug: 'senior-cd-2026',
    year: 2026,
    date: '2026-02-20',
    target: 7,
    groups: {
      GA: [
        ['Pablo Olalla', 'Luis Valdés', 7, 4],
        ['Juan Pedro González', 'Juan', 7, 4],
        ['Luis Valdés', 'Claudia Terán', 7, 1],
        ['Pablo Olalla', 'Claudia Terán', 7, 1],
        ['Juan León', 'Ignacio Betherod', 7, 3],
        ['Luis Valdés', 'Juan Pedro González', 7, 4],
        ['Pablo Olalla', 'Ignacio Betherod', 7, 2],
        ['Luis Valdés', 'Juan León', 7, 3],
        ['Juan Pedro González', 'Pablo Olalla', 7, 3],
        ['Pablo Olalla', 'Juan León', 7, 1],
        ['Luis Valdés', 'Ignacio Betherod', 7, 1],
        ['Juan Pedro González', 'Ignacio Betherod', 7, 2],
        ['Juan León', 'Claudia Terán', 7, 3],
        ['Juan Pedro González', 'Claudia Terán', 7, 0],
      ],
      GB: [
        ['Yago Fernández', 'Miguel de Rodrigo', 7, 5],
        ['Santiago Terán', 'Isabel Planas', 7, 1],
        ['Diego Escudero', 'Gonzalo López', 7, 5],
        ['Yago Fernández', 'Fernando Planas', 7, 3],
        ['Lucas Rebellón', 'Miguel de Rodrigo', 7, 5],
        ['Yago Fernández', 'Santiago Terán', 7, 3],
        ['Isabel Planas', 'Fernando Planas', 7, 5],
        ['Lucas Rebellón', 'Yago Fernández', 7, 5],
        ['Santiago Terán', 'Miguel de Rodrigo', 8, 6],
        ['Fernando Planas', 'Miguel de Rodrigo', 7, 2],
        ['Yago Fernández', 'Isabel Planas', 7, 1],
        ['Miguel de Rodrigo', 'Isabel Planas', 7, 4],
        ['Lucas Rebellón', 'Isabel Planas', 7, 5],
        ['Santiago Terán', 'Fernando Planas', 7, 4],
        ['Lucas Rebellón', 'Lucas Planas', 8, 6],
      ],
      GC: [
        ['Pablo Escudero', 'Javier Terán', 7, 1],
        ['Fernando Escudero', 'Javier Benito', 7, 4],
        ['Javier Benito', 'Javier Terán', 7, 1],
        ['Pablo Escudero', 'Miguel Olalla', 7, 4],
        ['Fernando Escudero', 'Javier Terán', 7, 4],
        ['Miguel Olalla', 'Javier Benito', 7, 3],
        ['Pablo Escudero', 'Jaime Pérez', 7, 2],
        ['Miguel Olalla', 'Javier Terán', 7, 2],
        ['Javier Terán', 'Jaime Pérez', 7, 2],
        ['Pablo Escudero', 'Javier Benito', 7, 3],
        ['Miguel Olalla', 'Fernando Escudero', 9, 7],
        ['Javier Benito', 'Jaime Pérez', 7, 2],
        ['Fernando Escudero', 'Jaime Pérez', 7, 0],
        ['Miguel Olalla', 'Jaime Pérez', 7, 1],
        ['Pablo Escudero', 'Fernando Escudero', 7, 5],
      ],
      GD: [
        ['Miguel Ángel Martínez', 'Gonzalo López', 7, 3],
        ['Iván Horcajada', 'Javier Fernández', 7, 4],
        ['Javier Fernández', 'Gonzalo López', 7, 4],
        ['Fernando Escudero', 'Miguel Ángel Martínez', 8, 6],
        ['Fernando Escudero', 'Diego Escudero', 7, 5],
        ['Iván Horcajada', 'Gonzalo López', 7, 3],
        ['Diego Escudero', 'Gonzalo López', 7, 4],
        ['Javier Fernández', 'Fernando Escudero', 7, 5],
        ['Javier Fernández', 'Miguel Ángel Martínez', 7, 4],
        ['Iván Horcajada', 'Diego Escudero', 13, 11],
        ['Fernando Escudero', 'Gonzalo López', 7, 4],
        ['Iván Horcajada', 'Miguel Ángel Martínez', 7, 5],
        ['Diego Escudero', 'Javier Fernández', 7, 3],
        ['Fernando Escudero', 'Iván Horcajada', 8, 6],
        ['Fernando Escudero', 'Miguel Ángel Martínez', 7, 4],
      ],
    },
  },

  // 8. Sub-14 CD 2026
  {
    name: 'Sub-14 CD 2026',
    slug: 'sub-14-cd-2026',
    year: 2026,
    date: '2026-02-21',
    target: 7,
    groups: {
      G1: [
        ['Javier Escudero', 'Gabriel Fernández', 7, 2],
        ['Javier Benito', 'Jaime Navarrete', 7, 4],
        ['Rafael Tejedor', 'Gabriel Fernández', 7, 5],
        ['Álvaro Barbera', 'Martín Alonso', 7, 4],
        ['Jaime León', 'Javier Escudero', 7, 4],
        ['Pablo Luengo', 'Jaime Navarrete', 7, 5],
        ['Javier Benito', 'Rafael Tejedor', 7, 3],
        ['Jaime León', 'Martín Alonso', 7, 1],
        ['Álvaro Barbera', 'Gabriel Fernández', 7, 3],
        ['Javier Escudero', 'Jaime Navarrete', 8, 6],
        ['Pablo Luengo', 'Rafael Tejedor', 7, 5],
        ['Javier Benito', 'Jaime León', 7, 3],
        ['Álvaro Barbera', 'Javier Escudero', 7, 2],
        ['Gabriel Fernández', 'Pablo Luengo', 7, 2],
        ['Jaime Navarrete', 'Martín Alonso', 7, 3],
        ['Jaime León', 'Rafael Tejedor', 7, 5],
        ['Javier Benito', 'Javier Escudero', 7, 5],
        ['Rafael Tejedor', 'Álvaro Barbera', 7, 4],
        ['Jaime León', 'Jaime Navarrete', 7, 5],
        ['Javier Benito', 'Pablo Luengo', 7, 4],
        ['Rafael Tejedor', 'Martín Alonso', 7, 2],
        ['Jaime Navarrete', 'Álvaro Barbera', 7, 5],
        ['Jaime León', 'Pablo Luengo', 7, 5],
        ['Javier Benito', 'Gabriel Fernández', 7, 2],
        ['Javier Escudero', 'Rafael Tejedor', 8, 6],
        ['Jaime Navarrete', 'Gabriel Fernández', 14, 12],
        ['Jaime León', 'Álvaro Barbera', 7, 5],
        ['Javier Benito', 'Martín Alonso', 7, 1],
        ['Jaime León', 'Gabriel Fernández', 7, 1],
        ['Javier Escudero', 'Pablo Luengo', 7, 5],
        ['Javier Benito', 'Álvaro Barbera', 7, 3],
        ['Rafael Tejedor', 'Jaime Navarrete', 8, 6],
        ['Pablo Luengo', 'Martín Alonso', 7, 5],
        ['Gabriel Fernández', 'Martín Alonso', 7, 2],
        ['Álvaro Barbera', 'Pablo Luengo', 7, 2],
        ['Javier Escudero', 'Martín Alonso', 7, 4],
      ],
      G2: [
        ['Pablo Cascón', 'Oliver Rivero', 7, 5],
        ['Álvaro Guerra', 'Jaime Ros', 7, 0],
        ['Álvaro de la Herrán', 'Blanca Barbera', 7, 5],
        ['Pablo Cascón', 'Nicolás Alonso', 7, 0],
        ['Álvaro Guerra', 'Álvaro de la Herrán', 7, 4],
        ['Sofía Fernández', 'Carmen Navarrete', 7, 4],
        ['Jaime Ros', 'Oliver Rivero', 7, 5],
        ['Álvaro Guerra', 'Carlos Rebellón', 7, 1],
        ['Álvaro de la Herrán', 'Nicolás Alonso', 7, 3],
        ['Blanca Barbera', 'Oliver Rivero', 7, 5],
        ['Pablo Cascón', 'Jaime Ros', 7, 5],
        ['Álvaro Guerra', 'Oliver Rivero', 7, 4],
        ['Carlos Rebellón', 'Álvaro de la Herrán', 8, 6],
        ['Blanca Barbera', 'Nicolás Alonso', 7, 3],
        ['Jaime Ros', 'Carlos Rebellón', 7, 5],
        ['Nicolás Alonso', 'Sofía Fernández', 7, 5],
        ['Blanca Barbera', 'Carmen Navarrete', 7, 2],
        ['Pablo Cascón', 'Carlos Rebellón', 7, 5],
        ['Jaime Ros', 'Nicolás Alonso', 7, 1],
        ['Pablo Cascón', 'Álvaro Guerra', 10, 8],
        ['Sofía Fernández', 'Jaime Ros', 16, 14],
        ['Oliver Rivero', 'Carlos Rebellón', 10, 8],
        ['Álvaro de la Herrán', 'Carmen Navarrete', 7, 3],
        ['Nicolás Alonso', 'Carmen Navarrete', 7, 5],
        ['Blanca Barbera', 'Sofía Fernández', 7, 3],
        ['Oliver Rivero', 'Nicolás Alonso', 7, 5],
        ['Álvaro Guerra', 'Nicolás Alonso', 7, 3],
        ['Pablo Cascón', 'Álvaro de la Herrán', 7, 4],
        ['Jaime Ros', 'Carmen Navarrete', 7, 2],
        ['Carlos Rebellón', 'Blanca Barbera', 7, 4],
        ['Jaime Ros', 'Blanca Barbera', 7, 5],
        ['Álvaro de la Herrán', 'Oliver Rivero', 8, 6],
        ['Álvaro Guerra', 'Sofía Fernández', 7, 2],
        ['Carlos Rebellón', 'Nicolás Alonso', 7, 2],
        ['Álvaro Guerra', 'Carmen Navarrete', 7, 2],
        ['Álvaro de la Herrán', 'Jaime Ros', 7, 5],
        ['Pablo Cascón', 'Blanca Barbera', 7, 2],
        ['Oliver Rivero', 'Carmen Navarrete', 8, 6],
        ['Álvaro de la Herrán', 'Sofía Fernández', 7, 5],
        ['Pablo Cascón', 'Sofía Fernández', 7, 3],
        ['Blanca Barbera', 'Álvaro Guerra', 7, 5],
        ['Carlos Rebellón', 'Carmen Navarrete', 7, 3],
        ['Sofía Fernández', 'Oliver Rivero', 7, 5],
        ['Pablo Cascón', 'Carmen Navarrete', 7, 0],
      ],
      G3: [
        ['Jaime Fernández', 'Marcos Arias', 7, 1],
        ['Miguel Ausejo', 'Carmen Martínez', 7, 2],
        ['Claudio Lora', 'Arturo Benito', 7, 0],
        ['Giles Corballe', 'Alan Esteban', 7, 5],
        ['Alonso Gaviño', 'Cristina Martínez', 8, 6],
        ['Carmen Martínez', 'Arturo Benito', 7, 1],
        ['Claudio Lora', 'Alan Esteban', 7, 1],
        ['Miguel Ausejo', 'Cristina Martínez', 7, 5],
        ['Giles Corballe', 'Marcos Arias', 7, 0],
        ['Alonso Gaviño', 'Jaime Fernández', 13, 11],
        ['Alan Esteban', 'Arturo Benito', 7, 1],
        ['Claudio Lora', 'Cristina Martínez', 7, 2],
        ['Miguel Ausejo', 'Marcos Arias', 7, 2],
        ['Alonso Gaviño', 'Carmen Martínez', 7, 4],
        ['Jaime Fernández', 'Giles Corballe', 7, 4],
        ['Cristina Martínez', 'Arturo Benito', 7, 1],
        ['Claudio Lora', 'Marcos Arias', 7, 0],
        ['Giles Corballe', 'Carmen Martínez', 7, 3],
        ['Jaime Fernández', 'Miguel Ausejo', 7, 3],
        ['Marcos Arias', 'Arturo Benito', 7, 0],
        ['Alan Esteban', 'Jaime Fernández', 7, 5],
        ['Cristina Martínez', 'Carmen Martínez', 7, 5],
        ['Claudio Lora', 'Giles Corballe', 7, 3],
        ['Miguel Ausejo', 'Alonso Gaviño', 7, 5],
        ['Giles Corballe', 'Arturo Benito', 7, 0],
        ['Claudio Lora', 'Jaime Fernández', 7, 3],
        ['Alan Esteban', 'Cristina Martínez', 7, 4],
        ['Claudio Lora', 'Miguel Ausejo', 7, 2],
        ['Jaime Fernández', 'Carmen Martínez', 7, 3],
        ['Claudio Lora', 'Carmen Martínez', 7, 1],
        ['Giles Corballe', 'Cristina Martínez', 7, 0],
        ['Alonso Gaviño', 'Arturo Benito', 7, 1],
        ['Jaime Fernández', 'Arturo Benito', 7, 2],
        ['Alonso Gaviño', 'Marcos Arias', 7, 2],
        ['Jaime Fernández', 'Cristina Martínez', 7, 3],
        ['Alan Esteban', 'Carmen Martínez', 7, 3],
        ['Carmen Martínez', 'Marcos Arias', 7, 3],
        ['Giles Corballe', 'Miguel Ausejo', 7, 3],
        ['Alan Esteban', 'Marcos Arias', 7, 3],
        ['Giles Corballe', 'Alonso Gaviño', 7, 2],
        ['Alan Esteban', 'Miguel Ausejo', 7, 5],
      ],
      G4: [
        ['Milo de la Herrán', 'Ana Arias', 7, 0],
        ['Javier Ros', 'Jaime Guerra', 7, 5],
        ['Ignacio Escudero', 'Miguel Ros', 7, 1],
        ['Pablo Benito', 'Miguel Rodríguez', 7, 5],
        ['Miguel Ros', 'Ana Benito', 7, 5],
        ['Ignacio Escudero', 'Jaime Guerra', 7, 3],
        ['Ana Benito', 'Ana Arias', 7, 0],
        ['Pablo Benito', 'Javier Ros', 7, 2],
        ['Milo de la Herrán', 'Miguel Rodríguez', 7, 0],
        ['Ignacio Escudero', 'Ana Arias', 7, 4],
        ['Jaime Guerra', 'Ana Benito', 7, 2],
        ['Javier Ros', 'Miguel Rodríguez', 7, 2],
        ['Ignacio Escudero', 'Pablo Benito', 7, 5],
        ['Milo de la Herrán', 'Miguel Ros', 7, 2],
        ['Jaime Guerra', 'Miguel Rodríguez', 7, 2],
        ['Pablo Benito', 'Ana Benito', 7, 5],
        ['Javier Ros', 'Miguel Ros', 7, 4],
        ['Ignacio Escudero', 'Milo de la Herrán', 7, 4],
        ['Pablo Benito', 'Miguel Ros', 8, 6],
        ['Milo de la Herrán', 'Javier Ros', 7, 0],
        ['Ignacio Escudero', 'Javier Ros', 7, 4],
        ['Miguel Rodríguez', 'Miguel Ros', 7, 4],
        ['Milo de la Herrán', 'Jaime Guerra', 7, 2],
        ['Miguel Ros', 'Jaime Guerra', 7, 3],
        ['Miguel Rodríguez', 'Ana Benito', 7, 4],
        ['Javier Ros', 'Ana Benito', 7, 3],
        ['Milo de la Herrán', 'Ana Benito', 7, 0],
        ['Javier Ros', 'Ana Arias', 7, 0],
        ['Jaime Guerra', 'Ana Arias', 7, 0],
        ['Miguel Ros', 'Ana Arias', 7, 0],
        ['Pablo Benito', 'Ana Arias', 7, 0],
        ['Miguel Rodríguez', 'Ana Arias', 7, 0],
      ],
    },
  },
];

// Glicko-2 Implementation
const GLICKO2_SCALE = 173.7178;
const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;
const DEFAULT_VOL = 0.06;
const TAU = 0.5;
const EPSILON = 0.000001;

export interface GlickoPlayer {
  rating: number;
  ratingDeviation: number;
  volatility: number;
  matchesPlayed: number;
}

export interface GlickoResult {
  opponent: GlickoPlayer;
  score: 1 | 0;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function updateRatingGlicko2(player: GlickoPlayer, results: GlickoResult[]): GlickoPlayer {
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
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B: number;
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
    const C: number = A + ((A - B) * fA) / (fB - fA);
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
  console.log('🚀 TOURNEYMASTER AI: AUDITED MASTER HISTORICAL SEED (2023 - 2026)');
  console.log('===========================================================');
  console.log('Target Supabase:', supabaseUrl);

  // 1. Clean previous database records
  console.log('\n🧹 Cleaning previous database records...');
  await supabase.from('rating_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rating_states').delete().neq('player_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tournament_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tournament_participants').delete().neq('tournament_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('historical_tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('player_aliases').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('profiles').delete().neq('email', 'guillermoriveraterriza@gmail.com');
  console.log('Cleared previous database records cleanly.');

  // 2. Discover all canonical players from matches & name map
  const canonicalNamesSet = new Set<string>();
  for (const t of AUDITED_TOURNAMENTS) {
    for (const matchArr of Object.values(t.groups)) {
      for (const [winner, loser] of matchArr) {
        canonicalNamesSet.add(resolveCanonicalPlayerName(winner));
        canonicalNamesSet.add(resolveCanonicalPlayerName(loser));
      }
    }
  }
  for (const name of Object.values(NAME_MAP)) {
    canonicalNamesSet.add(name);
  }

  const canonicalPlayerList: string[] = Array.from(canonicalNamesSet).sort();
  console.log(`\n👥 Registering ${canonicalPlayerList.length} canonical players & profiles...`);
  const playerNameToId = new Map<string, string>();
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

  // Register all aliases from NAME_MAP
  for (const [rawAlias, canonicalName] of Object.entries(NAME_MAP)) {
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

  // 3. Assemble 8 Tournaments, Groups and Audited Matches
  console.log(`\n🏆 Registering ${AUDITED_TOURNAMENTS.length} Tournaments, Groups & Audited Matches...`);
  const allHistoricalMatches = [];
  const allLiveMatches = [];
  const processedTournamentsData = [];

  const { data: adminData } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'guillermoriveraterriza@gmail.com')
    .single();
  const adminId = adminData?.id || profileRows[0]?.id || '00000000-0000-0000-0000-000000000000';

  for (const t of AUDITED_TOURNAMENTS) {
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
      created_by: adminId,
      created_at: new Date(t.date).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // Groups & Matches for this tournament
    const tourneyMatches = [];

    for (const [grpCode, matchesList] of Object.entries(t.groups)) {
      const grpId = deterministicUUID(`group-${t.slug}-${grpCode}`);

      // Extract unique players in this group
      const grpPlayersSet = new Set<string>();
      for (const [w, l] of matchesList) {
        grpPlayersSet.add(resolveCanonicalPlayerName(w));
        grpPlayersSet.add(resolveCanonicalPlayerName(l));
      }

      await supabase.from('historical_groups').upsert({
        id: grpId,
        historical_tournament_id: tourneyId,
        group_code: grpCode,
        total_matches: matchesList.length,
        total_players: grpPlayersSet.size,
      }, { onConflict: 'id' });

      await supabase.from('tournament_groups').upsert({
        id: grpId,
        tournament_id: tourneyId,
        group_code: grpCode,
        category: t.name.toLowerCase().includes('sub') ? 'sub14' : 'plus14',
        status: 'completed',
        created_at: new Date(t.date).toISOString(),
      }, { onConflict: 'id' });

      for (let mIdx = 0; mIdx < matchesList.length; mIdx++) {
        const matchTuple = matchesList[mIdx];
        if (!matchTuple) continue;
        const [winnerName, loserName, scoreW, scoreL] = matchTuple;
        const winnerCanonical = resolveCanonicalPlayerName(winnerName);
        const loserCanonical = resolveCanonicalPlayerName(loserName);

        const winnerId = playerNameToId.get(winnerCanonical.toLowerCase()) || playerNameToId.get(winnerName.toLowerCase().trim());
        const loserId = playerNameToId.get(loserCanonical.toLowerCase()) || playerNameToId.get(loserName.toLowerCase().trim());

        if (!winnerId || !loserId) {
          console.warn('Unknown player in match:', winnerName, 'vs', loserName);
          continue;
        }

        const matchId = deterministicUUID(`match-${t.slug}-${grpCode}-${mIdx}-${winnerCanonical}-${loserCanonical}`);

        // Rigorous assignment:
        // player1_id = WinnerID, player2_id = LoserID
        // score1 = ScoreW, score2 = ScoreL
        // winner_id = WinnerID
        const matchRow = {
          id: matchId,
          historical_tournament_id: tourneyId,
          group_id: grpId,
          stage: 'group',
          player1_id: winnerId,
          player2_id: loserId,
          score_player1: scoreW,
          score_player2: scoreL,
          winner_id: winnerId,
          status: 'complete',
          is_missing: false,
          played_at: new Date(t.date).toISOString(),
        };

        const liveMatchRow = {
          id: matchId,
          tournament_id: tourneyId,
          category: t.name.toLowerCase().includes('sub') ? 'sub14' : 'plus14',
          stage: 'group',
          group_id: grpId,
          player1_id: winnerId,
          player2_id: loserId,
          score_player1: scoreW,
          score_player2: scoreL,
          winner_id: winnerId,
          status: 'confirmed',
          is_upset: false,
          created_at: new Date(t.date).toISOString(),
          updated_at: new Date().toISOString(),
        };

        allHistoricalMatches.push(matchRow);
        allLiveMatches.push(liveMatchRow);
        tourneyMatches.push(matchRow);
      }
    }

    processedTournamentsData.push({
      tournament: { id: tourneyId, name: t.name, year: t.year, date: t.date },
      matches: tourneyMatches,
    });
  }

  // Insert matches in batches of 50
  console.log(`\n🏓 Inserting ${allHistoricalMatches.length} audited historical matches...`);
  for (let i = 0; i < allHistoricalMatches.length; i += 50) {
    const chunk = allHistoricalMatches.slice(i, i + 50);
    const { error: mErr } = await supabase.from('historical_matches').upsert(chunk, { onConflict: 'id' });
    if (mErr) console.error('Error inserting historical matches chunk:', mErr.message);
  }
  for (let i = 0; i < allLiveMatches.length; i += 50) {
    const chunk = allLiveMatches.slice(i, i + 50);
    const { error: lmErr } = await supabase.from('matches').upsert(chunk, { onConflict: 'id' });
    if (lmErr) console.error('Error inserting live matches chunk:', lmErr.message);
  }
  console.log(`Saved ${allHistoricalMatches.length} historical matches in database.`);

  // Insert participants for each tournament
  for (const tourneyData of processedTournamentsData) {
    const { tournament, matches } = tourneyData;
    const tourneyId = tournament.id;
    const isSub = tournament.name.toLowerCase().includes('sub');
    const pSet = new Set<string>();
    for (const m of matches) {
      pSet.add(m.player1_id);
      pSet.add(m.player2_id);
    }
    const partRows = Array.from(pSet).map((pId) => ({
      tournament_id: tourneyId,
      user_id: pId,
      category: isSub ? 'sub14' : 'plus14',
      declared_level: 3,
      group_id: null,
      seed_number: null,
    }));
    if (partRows.length > 0) {
      const { error: tpErr } = await supabase.from('tournament_participants').upsert(partRows, { onConflict: 'tournament_id,user_id' });
      if (tpErr) console.error('Error inserting tournament participants:', tpErr.message);
    }
  }

  // 4. Chronological Glicko-2 Replay (2023 -> 2024 -> 2025 -> 2026)
  console.log('\n📈 Computing Glicko-2 Ratings Chronologically across all 8 Tournaments...');

  const playerRatings = new Map<string, GlickoPlayer>();
  const playerWinLoss = new Map<string, { wins: number; losses: number }>();

  for (const name of canonicalPlayerList) {
    const pId = playerNameToId.get(name.toLowerCase());
    if (!pId) continue;
    playerRatings.set(pId, {
      rating: DEFAULT_RATING,
      ratingDeviation: DEFAULT_RD,
      volatility: DEFAULT_VOL,
      matchesPlayed: 0,
    });
    playerWinLoss.set(pId, { wins: 0, losses: 0 });
  }

  const allSnapshots = [];

  for (const tourneyData of processedTournamentsData) {
    const { tournament, matches } = tourneyData;
    const tourneyId = tournament.id;

    // Collect participating player IDs
    const participantIds = new Set<string>();
    for (const m of matches) {
      participantIds.add(m.player1_id);
      participantIds.add(m.player2_id);
    }

    // Capture ratings before this tournament
    const ratingsBefore = new Map<string, GlickoPlayer>();
    for (const pId of participantIds) {
      const cur = playerRatings.get(pId);
      if (cur) ratingsBefore.set(pId, { ...cur });
    }

    // Build match results for this tournament period
    const playerResults = new Map<string, GlickoResult[]>();
    for (const pId of participantIds) {
      playerResults.set(pId, []);
    }

    for (const m of matches) {
      const p1State = ratingsBefore.get(m.player1_id); // Winner
      const p2State = ratingsBefore.get(m.player2_id); // Loser
      if (!p1State || !p2State) continue;

      // Winner gets 1, Loser gets 0
      playerResults.get(m.player1_id)!.push({
        opponent: p2State,
        score: 1,
      });

      playerResults.get(m.player2_id)!.push({
        opponent: p1State,
        score: 0,
      });

      playerWinLoss.get(m.player1_id)!.wins++;
      playerWinLoss.get(m.player2_id)!.losses++;
    }

    // Update Glicko-2 for all participants
    for (const pId of participantIds) {
      const before = ratingsBefore.get(pId)!;
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
        wins_in_period: results.filter((r: GlickoResult) => r.score === 1).length,
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

  // 5. Verification checks
  console.log('\n🔍 AUDIT VERIFICATION OF KEY PLAYERS:');
  const pabloOlallaId = playerNameToId.get('pablo olalla');
  if (pabloOlallaId) {
    const pabloOlallaStats = playerWinLoss.get(pabloOlallaId);
    const pabloOlallaRating = playerRatings.get(pabloOlallaId);
    console.log(`- Pablo Olalla: ${pabloOlallaStats?.wins} Victorias, ${pabloOlallaStats?.losses} Derrotas (Rating: ${pabloOlallaRating?.rating}, Matches: ${pabloOlallaRating?.matchesPlayed})`);
  }

  const lucasRebellonId = playerNameToId.get('lucas rebellon') || playerNameToId.get('lucas rebellón');
  if (lucasRebellonId) {
    const lucasStats = playerWinLoss.get(lucasRebellonId);
    console.log(`- Lucas Rebellón: ${lucasStats?.wins} Victorias, ${lucasStats?.losses} Derrotas`);
  }

  const ivanHorcajadaId = playerNameToId.get('iván horcajada') || playerNameToId.get('ivan horcajada');
  if (ivanHorcajadaId) {
    const ivanStats = playerWinLoss.get(ivanHorcajadaId);
    console.log(`- Iván Horcajada: ${ivanStats?.wins} Victorias, ${ivanStats?.losses} Derrotas`);
  }

  const pabloCasconId = playerNameToId.get('pablo cascón') || playerNameToId.get('pablo cascon');
  if (pabloCasconId) {
    const casconStats = playerWinLoss.get(pabloCasconId);
    console.log(`- Pablo Cascón: ${casconStats?.wins} Victorias, ${casconStats?.losses} Derrotas`);
  }

  const fernandoEscuderoId = playerNameToId.get('fernando escudero');
  if (fernandoEscuderoId) {
    const ferStats = playerWinLoss.get(fernandoEscuderoId);
    console.log(`- Fernando Escudero: ${ferStats?.wins} Victorias, ${ferStats?.losses} Derrotas`);
  }

  console.log('\n===========================================================');
  console.log('🎉 AUDITED MASTER HISTORICAL SEED COMPLETED SUCCESSFULLY!');
  console.log(`✅ Unique Players Seeded: ${playerRows.length}`);
  console.log(`✅ Tournaments Seeded: ${AUDITED_TOURNAMENTS.length} (4 Senior + 4 Sub-14/16)`);
  console.log(`✅ Total Matches Seeded: ${allHistoricalMatches.length}`);
  console.log(`✅ Glicko-2 Snapshots Created: ${allSnapshots.length}`);
  console.log('===========================================================');
}

runMasterSeed().catch((err) => {
  console.error('Fatal seed execution error:', err);
  process.exit(1);
});
