// Catálogos de formatos de liga, formatos de partido y criterios de desempate.
// Módulo puro: sin DOM ni Firebase. Se usa tanto en el navegador como en las pruebas de Node.

export const FORMATOS_LIGA = {
  rr1: {
    label: 'Todos contra todos, 1 vuelta',
    desc: 'Cada jugador enfrenta una vez a cada rival. Se genera un calendario por jornadas.',
    vueltas: 1,
    playoffs: false,
  },
  rr2: {
    label: 'Todos contra todos, 2 vueltas',
    desc: 'Ida y vuelta contra cada rival. Calendario con el doble de jornadas.',
    vueltas: 2,
    playoffs: false,
  },
  libre: {
    label: 'Liga libre (sin calendario)',
    desc: 'Cualquier par juega cuando quiera y las veces que quiera. Cada victoria suma puntos.',
    vueltas: Infinity,
    playoffs: false,
  },
  rr1_playoffs: {
    label: 'Todos contra todos (1 vuelta) + playoffs',
    desc: 'Fase regular a una vuelta y luego llave de eliminación directa entre los mejores de la tabla.',
    vueltas: 1,
    playoffs: true,
  },
  rr2_playoffs: {
    label: 'Todos contra todos (2 vueltas) + playoffs',
    desc: 'Fase regular ida y vuelta y luego llave de eliminación directa.',
    vueltas: 2,
    playoffs: true,
  },
};

export const FORMATOS_PARTIDO = {
  bo3: {
    label: 'Al mejor de 3 sets',
    desc: 'Tres sets normales con tiebreak a 7 puntos en 6-6.',
    setsParaGanar: 2,
    maxSets: 3,
    superTb: false,
  },
  bo3_super: {
    label: '2 sets + super tiebreak a 10',
    desc: 'Si empatan 1-1 en sets, el tercero se reemplaza por un match tiebreak a 10 puntos.',
    setsParaGanar: 2,
    maxSets: 3,
    superTb: true,
  },
  set1: {
    label: '1 set',
    desc: 'Un solo set a 6 games con tiebreak en 6-6.',
    setsParaGanar: 1,
    maxSets: 1,
    superTb: false,
  },
  bo5: {
    label: 'Al mejor de 5 sets',
    desc: 'Cinco sets normales. Gana quien llegue a 3.',
    setsParaGanar: 3,
    maxSets: 5,
    superTb: false,
  },
  libre: {
    label: 'Libre',
    desc: 'Cualquier cantidad de sets. Solo se verifica que el marcador sea coherente con el ganador.',
    setsParaGanar: null,
    maxSets: 7,
    superTb: null,
  },
};

export const CRITERIOS_DESEMPATE = {
  h2h: {
    label: 'Enfrentamiento directo',
    desc: 'Resultado entre los jugadores empatados.',
  },
  victorias: {
    label: 'Más partidos ganados',
    desc: 'Útil cuando los puntos por derrota no son cero.',
  },
  masPJ: {
    label: 'Más partidos jugados',
    desc: 'Criterio ITF: quien jugó más partidos queda arriba.',
  },
  pctSets: {
    label: '% de sets ganados',
    desc: 'Sets ganados dividido por sets jugados.',
  },
  pctGames: {
    label: '% de games ganados',
    desc: 'Games ganados dividido por games jugados.',
  },
  difSets: {
    label: 'Diferencia de sets',
    desc: 'Sets a favor menos sets en contra.',
  },
  setsFavor: {
    label: 'Sets a favor',
    desc: 'Total de sets ganados.',
  },
  difGames: {
    label: 'Diferencia de games',
    desc: 'Games a favor menos games en contra.',
  },
  gamesFavor: {
    label: 'Games a favor',
    desc: 'Total de games ganados.',
  },
  menosPJ: {
    label: 'Menos partidos jugados',
    desc: 'Quien logró los mismos puntos con menos partidos queda arriba.',
  },
  alfabetico: {
    label: 'Orden alfabético (provisorio)',
    desc: 'Último recurso mientras no se defina un sorteo.',
  },
};

export const PRESETS_DESEMPATE = {
  usta: {
    label: 'USTA / ATP Finals',
    desc: 'Enfrentamiento directo, luego % de sets, luego % de games. Se reinicia entre los que sigan empatados.',
    criterios: ['h2h', 'pctSets', 'pctGames'],
    h2hModo: 'minitabla',
  },
  itf: {
    label: 'ITF Juniors Finals',
    desc: 'Más victorias, más partidos jugados, % de sets, enfrentamiento directo, % de games.',
    criterios: ['victorias', 'masPJ', 'pctSets', 'h2h', 'pctGames'],
    h2hModo: 'solo2',
  },
  universitario: {
    label: 'Universitario (Argentina / España)',
    desc: 'Enfrentamiento directo solo entre dos, luego diferencia de sets, sets a favor, diferencia de games y games a favor.',
    criterios: ['h2h', 'difSets', 'setsFavor', 'difGames', 'gamesFavor'],
    h2hModo: 'solo2',
  },
  soloPuntos: {
    label: 'Solo puntos',
    desc: 'Con los mismos puntos se comparte la posición.',
    criterios: [],
    h2hModo: 'solo2',
  },
};

export const ESTADOS_PARTIDO = {
  completo: { label: 'Completo', desc: 'Partido jugado hasta el final.' },
  retiro: { label: 'Retiro', desc: 'Un jugador abandonó. Se registra el marcador parcial.' },
  wo: { label: 'W.O.', desc: 'Walkover: un jugador no se presentó. Sin marcador.' },
};

export const H2H_MODOS = {
  solo2: { label: 'Solo cuando empatan dos jugadores' },
  minitabla: { label: 'Mini tabla entre todos los empatados' },
};

export function formatoLiga(id) {
  return FORMATOS_LIGA[id] || null;
}

export function formatoPartido(id) {
  return FORMATOS_PARTIDO[id] || null;
}
