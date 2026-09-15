/* ═══════════════════════════════════════════════════════════
   CONFIGURAZIONE FIREBASE — Gruppo Scout Pino Torinese 1
   
   Unico punto in cui vive la configurazione: se cambia il
   progetto Firebase, si tocca solo questo file.

   Progetto: sito-pino1  ·  Realtime DB in europe-west1

   Se un giorno servisse rigenerarla: Console Firebase →
   Impostazioni progetto → Le tue app → Configurazione SDK
   ═══════════════════════════════════════════════════════════ */

export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCXF_0jxO9a7EtbbGVgw5P5E8-oqpTV8ug",
  authDomain:        "sito-pino1.firebaseapp.com",
  databaseURL:       "https://sito-pino1-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "sito-pino1",
  storageBucket:     "sito-pino1.firebasestorage.app",
  messagingSenderId: "752506079129",
  appId:             "1:752506079129:web:c6eb6468a3f0f699bb7508"
};

/* Versione della struttura dati. Se un giorno cambia la forma
   dei dati su Firebase, si incrementa e si gestisce la
   migrazione in modo esplicito invece di rompere tutto. */
export const SCHEMA_VERSION = 1;

/* Branche disponibili. L'ordine di questo array determina
   l'ordine di visualizzazione delle sezioni nel sito. */
export const BRANCHE = [
  { id: 'gruppo',    nome: 'Capo Gruppo',        eta: 'Direzione'  },
  { id: 'branco',    nome: 'Branco Mirfak',      eta: '7–11 anni'  },
  { id: 'reparto',   nome: 'Reparto Everest',    eta: '11–16 anni' },
  { id: 'noviziato', nome: 'Noviziato Silmaril', eta: '16–17 anni' },
  { id: 'clan',      nome: 'Clan Zebrù',         eta: '17–21 anni' }
];


/* ═══════════════════════════════════════════════════════════
   CONTENUTI DI FALLBACK
   
   Se Firebase è irraggiungibile (rete assente, quota esaurita,
   progetto sospeso) il sito continua a funzionare mostrando
   questi dati invece di pagine vuote.
   
   Non serve tenerli allineati al minuto: servono a non far
   crollare il sito, non a essere la fonte di verità.
   ═══════════════════════════════════════════════════════════ */

export const FALLBACK = {
  capi: [
    { id: 'f1', nome: 'Aquila',  ruolo: 'Capo Gruppo',        branca: 'gruppo',    titolare: true,  ordine: 1, foto: '' },
    { id: 'f2', nome: 'Falco',   ruolo: 'Capo Gruppo',        branca: 'gruppo',    titolare: true,  ordine: 2, foto: '' },
    { id: 'f3', nome: 'Rondine', ruolo: 'Capo Branco',        branca: 'branco',    titolare: true,  ordine: 1, foto: '' },
    { id: 'f4', nome: 'Lince',   ruolo: 'Capo Reparto',       branca: 'reparto',   titolare: true,  ordine: 1, foto: '' },
    { id: 'f5', nome: 'Corvo',   ruolo: 'Maestro dei Novizi', branca: 'noviziato', titolare: true,  ordine: 1, foto: '' },
    { id: 'f6', nome: 'Cervo',   ruolo: 'Capo Clan',          branca: 'clan',      titolare: true,  ordine: 1, foto: '' }
  ],
  iscrizioni: {
    anno:        '2026–2027',
    aperte:      true,
    linkModulo:  'https://forms.pino1.it/preiscrizioni-2026',
    dataRiunione:'da definire — verrete contattati',
    testo:       'Compilando il modulo di pre-iscrizione il ragazzo o la ragazza verrà aggiunto alla lista degli interessati. Dopo la riunione informativa riceverete un\'e-mail di conferma.',
    notaEsito:   'Entro la fine di luglio vi comunicheremo se possiamo accogliere vostro figlio o vostra figlia nel gruppo.'
  },
  avvisi: [],
  calendario: [],
  kpi: [
    { valore: '109',  etichetta: 'Iscritti' },
    { valore: '17',   etichetta: 'Capi' },
    { valore: '4',    etichetta: 'Branche' },
    { valore: '1972', etichetta: 'Anno di fondazione' }
  ],
  impostazioni: { calendarioAttivo: false, bannerAttivo: false }
};


/* ═══════════════════════════════════════════════════════════
   CARICAMENTO CONTENUTI (pagine pubbliche)

   Usa l'API REST di Firebase invece dell'SDK:
   - non apre un WebSocket, quindi non consuma nessuna delle
     100 connessioni simultanee del piano gratuito
   - non scarica i ~200 KB del pacchetto SDK
   - è una fetch() normale, cacheabile dal browser

   Restituisce sempre un oggetto valido, anche in caso di
   errore: chi chiama non deve gestire il caso "dati assenti".
   ═══════════════════════════════════════════════════════════ */

const URL_CONTENUTI = `${FIREBASE_CONFIG.databaseURL}/contenuti.json`;
const URL_FOTO      = `${FIREBASE_CONFIG.databaseURL}/foto.json`;

export async function caricaContenuti() {
  try {
    // Timeout esplicito: se Firebase non risponde entro 5 secondi
    // usiamo il fallback invece di lasciare la pagina in attesa.
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 5000);

    // Le foto stanno in un ramo a parte perché pesano: chiedendole
    // separatamente, una pagina che non mostra capi non le scarica.
    // Le due richieste partono insieme, non una dopo l'altra.
    const [rContenuti, rFoto] = await Promise.all([
      fetch(URL_CONTENUTI, { signal: stop.signal }),
      fetch(URL_FOTO,      { signal: stop.signal }).catch(() => null)
    ]);
    clearTimeout(timer);

    if (!rContenuti.ok) throw new Error('HTTP ' + rContenuti.status);

    const dati = (await rContenuti.json()) || {};

    // Le foto non sono critiche: se il ramo non risponde il sito mostra
    // le iniziali. Ma il silenzio confonde chi ci sta lavorando, quindi
    // lo diciamo in console invece di lasciarlo indovinare.
    let foto = {};
    if (!rFoto) {
      console.warn('[PT] Ramo /foto irraggiungibile: mostro le iniziali.');
    } else if (!rFoto.ok) {
      console.warn(`[PT] Ramo /foto ha risposto ${rFoto.status}. ` +
        'Se è 401 o 403, controlla che le regole del database siano state pubblicate.');
    } else {
      foto = (await rFoto.json()) || {};
      if (!Object.keys(foto).length) {
        console.info('[PT] Nessuna foto caricata dal pannello: mostro le iniziali.');
      }
    }

    // La foto caricata dal pannello vince su un eventuale vecchio indirizzo.
    const capi = normalizzaCapi(dati.capi)
      .map(c => ({ ...c, foto: foto[c.id] || c.foto || '' }));

    return {
      capi,
      iscrizioni:   { ...FALLBACK.iscrizioni, ...(dati.iscrizioni || {}) },
      avvisi:       normalizzaAvvisi(dati.avvisi),
      calendario:   normalizzaEventi(dati.calendario),
      kpi:          normalizzaKpi(dati.kpi),
      impostazioni: dati.impostazioni || {},
      online:       true
    };

  } catch (errore) {
    console.warn('[PT] Firebase non raggiungibile, uso i contenuti di riserva:', errore.message);
    return { ...structuredClone(FALLBACK), online: false };
  }
}


/* Converte l'oggetto Firebase { chiave: {...} } in un array
   ordinato. Se non c'è nulla, torna il fallback. */
function normalizzaCapi(oggetto) {
  if (!oggetto) return structuredClone(FALLBACK.capi);

  return Object.entries(oggetto)
    .map(([id, capo]) => ({ id, ...capo }))
    .sort((a, b) => {
      // Prima per branca (nell'ordine definito in BRANCHE),
      // poi per il campo ordine, poi alfabetico come ultima spiaggia.
      const ia = BRANCHE.findIndex(x => x.id === a.branca);
      const ib = BRANCHE.findIndex(x => x.id === b.branca);
      if (ia !== ib) return ia - ib;
      if ((a.ordine ?? 99) !== (b.ordine ?? 99)) return (a.ordine ?? 99) - (b.ordine ?? 99);
      return (a.nome || '').localeCompare(b.nome || '');
    });
}


/* Numeri in evidenza sulla home. Se non ce ne sono, si usano
   quelli di riserva: una home senza numeri sembra incompleta. */
function normalizzaKpi(oggetto) {
  if (!oggetto) return structuredClone(FALLBACK.kpi);
  const lista = Object.entries(oggetto)
    .map(([id, k]) => ({ id, ...k }))
    .sort((a, b) => (a.ordine ?? 99) - (b.ordine ?? 99));
  return lista.length ? lista : structuredClone(FALLBACK.kpi);
}


/* Solo gli eventi visibili, in ordine di data, e senza quelli
   già passati: un calendario pieno di date vecchie sembra
   abbandonato anche quando non lo è. */
function normalizzaEventi(oggetto) {
  if (!oggetto) return [];
  const oggi = new Date().toISOString().slice(0, 10);

  return Object.entries(oggetto)
    .map(([id, e]) => ({ id, ...e }))
    .filter(e => e.attivo && (e.dataFine || e.dataInizio) >= oggi)
    .sort((a, b) => (a.dataInizio || '').localeCompare(b.dataInizio || ''));
}


/* Solo gli avvisi attivi, ordinati. */
function normalizzaAvvisi(oggetto) {
  if (!oggetto) return [];

  return Object.entries(oggetto)
    .map(([id, avviso]) => ({ id, ...avviso }))
    .filter(a => a.attivo)
    .sort((a, b) => (a.ordine ?? 99) - (b.ordine ?? 99));
}


/* ═══════════════════════════════════════════════════════════
   GALLERIE FOTOGRAFICHE

   Chiamata a parte, su richiesta: una galleria pesa più di tutto
   il resto del sito insieme, e non ha senso scaricarla a chi apre
   la home. Il risultato viene tenuto in memoria per non
   richiederlo due volte nella stessa visita.
   ═══════════════════════════════════════════════════════════ */

const galleriaInMemoria = {};

export async function caricaGalleria(branca) {
  if (galleriaInMemoria[branca]) return galleriaInMemoria[branca];

  try {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 8000);

    const r = await fetch(`${FIREBASE_CONFIG.databaseURL}/gallerie/${branca}.json`,
                          { signal: stop.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const dati = (await r.json()) || {};
    const foto = Object.values(dati).filter(v => typeof v === 'string' && v.startsWith('data:image/'));
    galleriaInMemoria[branca] = foto;
    return foto;

  } catch (e) {
    console.warn(`[PT] galleria ${branca} non caricata:`, e.message);
    return [];
  }
}


/* Raggruppa i capi per branca, restituendo solo le branche
   che hanno almeno un capo. Utile per il rendering. */
export function raggruppaPerBranca(capi) {
  return BRANCHE
    .map(branca => ({
      ...branca,
      capi: capi.filter(c => c.branca === branca.id)
    }))
    .filter(b => b.capi.length > 0);
}


/* Iniziali per il segnaposto quando manca la foto. */
export function iniziali(nome) {
  return (nome || '?')
    .split(/\s+/)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
