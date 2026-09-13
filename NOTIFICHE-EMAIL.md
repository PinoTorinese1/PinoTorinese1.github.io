# Notifiche via e-mail

Un solo script gestisce due cose:

- le **pre-iscrizioni**, che arrivano alla casella del gruppo
- i **messaggi dal modulo contatti**, inoltrati al gruppo e alla branca
  competente in base all'argomento scelto

I moduli funzionano anche senza questo passaggio: tutto si vede comunque
nel pannello, con il pallino rosso sulle schede "Richieste" e "Messaggi".
Le notifiche servono a non doverlo controllare ogni giorno.

**Gli indirizzi delle branche vivono solo dentro questo script.** Non
sono nel codice del sito apposta: nel sorgente di una pagina pubblica
verrebbero raccolti dai robot dello spam in poco tempo.

> **Perché non usiamo Firebase per mandare le mail:** servirebbero le
> Cloud Functions, che richiedono il piano Blaze e quindi l'inserimento
> di una carta di credito. Google Apps Script fa la stessa cosa
> gratuitamente, usando l'account Google che avete già.

---

## Come è pensata

La mail è **una comodità, non il registro delle iscrizioni**. L'ordine è:

1. la richiesta viene salvata su Firebase
2. *poi* si prova a mandare la mail

Se la mail non parte — script rotto, quota finita, servizio giù — la
famiglia riceve comunque la conferma e la richiesta è al sicuro nel
database. Nessun dato va perso per colpa di una notifica.

---

## Configurazione (dieci minuti)

### 1. Crea lo script

Vai su [script.google.com](https://script.google.com) → **Nuovo progetto**.

Rinominalo `Notifiche iscrizioni Pino 1` (in alto a sinistra).

Cancella tutto quello che c'è nell'editor e incolla:

```javascript
/**
 * Notifiche via e-mail — Gruppo Scout AGESCI Pino Torinese 1
 *
 * I destinatari NON sono più scritti qui: si gestiscono dalla
 * scheda "Destinatari" del pannello capi. Questo script li legge
 * dal ramo protetto /config/destinatari, che ha la lettura chiusa
 * e non è raggiungibile né dal sito né da un visitatore.
 *
 * L'autenticazione usa il token OAuth dello script stesso, che
 * funziona perché questo progetto appartiene allo stesso account
 * Google proprietario del progetto Firebase.
 */

const DB = 'https://sito-pino1-default-rtdb.europe-west1.firebasedatabase.app';

// Rete di sicurezza: se il database non risponde, le notifiche
// arrivano comunque qui invece di perdersi.
const RIPIEGO = 'pinotorinese1@piemonte.agesci.it';


function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.tipo === 'contatto') inoltraMessaggio(d);
    else                       notificaIscrizione(d);
  } catch (err) {
    console.error('Notifica fallita: ' + err);
  }
  return ok();
}


/* ─── Lettura dei destinatari dal database ─── */
function leggiDestinatari() {
  try {
    const token = ScriptApp.getOAuthToken();
    const risposta = UrlFetchApp.fetch(
      DB + '/config/destinatari.json?access_token=' + token,
      { muteHttpExceptions: true }
    );
    if (risposta.getResponseCode() !== 200) {
      console.warn('Lettura destinatari: HTTP ' + risposta.getResponseCode());
      return null;
    }
    return JSON.parse(risposta.getContentText()) || {};
  } catch (err) {
    console.error('Lettura destinatari fallita: ' + err);
    return null;
  }
}

/* Chi riceve un certo argomento del modulo contatti. */
function destinatariPer(chiave) {
  const tutti = leggiDestinatari();
  if (!tutti) return RIPIEGO;

  const scelti = Object.keys(tutti)
    .map(function (k) { return tutti[k]; })
    .filter(function (d) {
      if (!d || !d.email) return false;
      if (d.sempre) return true;
      return (d.argomenti || '').split(',').indexOf(chiave) !== -1;
    })
    .map(function (d) { return d.email; })
    .filter(function (v, i, a) { return a.indexOf(v) === i; });   // niente doppioni

  return scelti.length ? scelti.join(',') : RIPIEGO;
}

/* Chi riceve le pre-iscrizioni: solo chi ha "riceve tutto". */
function destinatariIscrizioni() {
  const tutti = leggiDestinatari();
  if (!tutti) return RIPIEGO;

  const scelti = Object.keys(tutti)
    .map(function (k) { return tutti[k]; })
    .filter(function (d) { return d && d.email && d.sempre; })
    .map(function (d) { return d.email; })
    .filter(function (v, i, a) { return a.indexOf(v) === i; });

  return scelti.length ? scelti.join(',') : RIPIEGO;
}


/* ─── Messaggi dal modulo contatti ─── */
function inoltraMessaggio(d) {
  if (!d.nome || !d.email || !d.testo) return;

  const corpo =
    'Nuovo messaggio dal modulo contatti del sito.\n\n' +
    '── ARGOMENTO ──\n' + (d.oggetto || 'Non indicato') + '\n\n' +
    '── DA ──\n' +
    'Nome:     ' + d.nome + '\n' +
    'E-mail:   ' + d.email + '\n' +
    'Telefono: ' + (d.telefono || 'non indicato') + '\n\n' +
    '── MESSAGGIO ──\n' + d.testo + '\n\n' +
    '───────────────────────────\n' +
    'Rispondi pure a questa mail: la risposta va direttamente a chi ha scritto.\n' +
    'Copia di sicurezza nel pannello:\n' +
    'https://pinotorinese1.github.io/admin.html';

  MailApp.sendEmail({
    to:      destinatariPer(d.chiave),
    subject: '[Pino 1] ' + (d.oggetto || 'Messaggio') + ' — ' + d.nome,
    body:    corpo,
    replyTo: d.email
  });
}


/* ─── Pre-iscrizioni ─── */
function notificaIscrizione(d) {
  if (!d.nomeRagazzo || !d.cognomeRagazzo || !d.email) return;

  const nome = d.nomeRagazzo + ' ' + d.cognomeRagazzo;
  const anni = calcolaEta(d.dataNascita);

  const corpo =
    'È arrivata una nuova richiesta di pre-iscrizione.\n\n' +
    '── RAGAZZO/A ──\n' +
    'Nome:            ' + nome + '\n' +
    'Data di nascita: ' + formattaData(d.dataNascita) + ' (' + anni + ' anni)\n' +
    'Branca:          ' + brancaPerEta(anni) + '\n\n' +
    '── CONTATTI ──\n' +
    'Genitore:        ' + d.nomeGenitore + '\n' +
    'E-mail:          ' + d.email + '\n' +
    'Telefono:        ' + (d.telefono || 'non indicato') + '\n\n' +
    (d.note ? '── NOTE DELLA FAMIGLIA ──\n' + d.note + '\n\n' : '') +
    '───────────────────────────\n' +
    'Apri il pannello per gestirla:\n' +
    'https://pinotorinese1.github.io/admin.html\n\n' +
    'Questa mail contiene dati personali di un minore: non inoltrarla\n' +
    'fuori dalla Comunità Capi.';

  MailApp.sendEmail({
    to:      destinatariIscrizioni(),
    subject: '[Pino 1] Pre-iscrizione: ' + nome + ' (' + anni + ' anni)',
    body:    corpo,
    replyTo: d.email
  });
}


function ok() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function calcolaEta(iso) {
  if (!iso) return '?';
  const n = new Date(iso), o = new Date();
  let a = o.getFullYear() - n.getFullYear();
  const m = o.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && o.getDate() < n.getDate())) a--;
  return a;
}

function formattaData(iso) {
  if (!iso) return '?';
  const p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function brancaPerEta(a) {
  if (typeof a !== 'number') return '?';
  if (a < 7)   return 'troppo piccolo per il Branco';
  if (a <= 11) return 'Branco Mirfak';
  if (a <= 16) return 'Reparto Everest';
  if (a <= 17) return 'Noviziato Silmaril';
  if (a <= 21) return 'Clan Zebrù';
  return 'fuori età, da valutare';
}
```

### Un passaggio in più: i permessi dello script

Perché lo script possa leggere i destinatari dal database, va dichiarato
il permesso corrispondente.

1. Nell'editor Apps Script: **⚙ Impostazioni progetto** (icona a sinistra)
2. Spunta **Mostra il file manifest "appsscript.json" nell'editor**
3. Torna su **Editor** e apri il file `appsscript.json` comparso
4. Aggiungi il blocco `oauthScopes` come nell'esempio:

```json
{
  "timeZone": "Europe/Rome",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/firebase.database",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

Poi salva e **ripubblica il deployment**. Alla prima esecuzione Google
chiederà di nuovo l'autorizzazione, perché i permessi sono cambiati.

> ⚠️ **Lo script e il progetto Firebase devono appartenere allo stesso
> account Google.** Se hai creato lo script con un account e Firebase con
> un altro, la lettura fallisce e tutte le notifiche finiranno
> all'indirizzo di ripiego. In quel caso sposta lo script sull'account
> del gruppo.

**Gli indirizzi si gestiscono dal pannello**, scheda *Destinatari*: si
aggiungono e si tolgono senza toccare questo script. Il limite è 8.

### Dove arriva cosa

| Argomento scelto nel modulo | Destinatari |
|---|---|
| Informazioni generali | gruppo |
| Iscrizioni | gruppo |
| **Richiesta di ospitalità** | **gruppo + Branco + Reparto + Clan** |
| Contattare il Branco | gruppo + Branco |
| Contattare il Reparto | gruppo + Reparto |
| Contattare Clan e Noviziato | gruppo + Clan |
| Comunità Capi | gruppo |
| Proposta di collaborazione | gruppo + Clan |
| Altro | gruppo |

L'ospitalità va a tutti di proposito: sono richieste che conviene
qualcuno legga in fretta, e non si sa in anticipo quale branca abbia la
sede libera.

La CoCa usa la casella del gruppo: il filtro anti-doppioni evita che lo
stesso messaggio arrivi due volte.

Il campo `replyTo` fa sì che rispondendo alla notifica si scriva
direttamente a chi ha contattato, senza copiare l'indirizzo a mano.

Salva con l'icona del dischetto.

### 2. Pubblica

Pulsante blu **Esegui il deployment** (in alto a destra) →
**Nuovo deployment**.

- Icona ingranaggio accanto a *Seleziona tipo* → **Applicazione web**
- **Descrizione:** `notifiche iscrizioni`
- **Esegui come:** *Me stesso*
- **Chi ha accesso:** **Chiunque** ← indispensabile, il modulo chiama
  senza essere autenticato
- **Esegui il deployment**

Google chiede l'autorizzazione a inviare mail per conto tuo. Accetta.
Alla schermata "Google non ha verificato questa app" clicca su
**Avanzate** → **Apri progetto (non sicuro)**: è un tuo script, l'avviso
compare per tutti i progetti personali.

Alla fine copia l'**URL dell'app web**, quello che finisce con `/exec`.

### 3. Collega il modulo

Apri `index.html`, cerca questa riga (è verso il fondo, nello script):

```javascript
const URL_NOTIFICA = '';
```

Incolla dentro l'indirizzo:

```javascript
const URL_NOTIFICA = 'https://script.google.com/macros/s/AKfy.../exec';
```

Ricarica il file su GitHub. Fatto.

---

## Prova

Compila il modulo sul sito con dati finti. Dovresti ricevere la mail entro
un minuto, e vedere la richiesta comparire nel pannello.

Ricordati di **cancellare la richiesta di prova** dal pannello.

---

## Se le mail non arrivano

Il modulo continua a funzionare: la richiesta è nel pannello. Per capire
il perché, vai su [script.google.com](https://script.google.com) → il tuo
progetto → **Esecuzioni** nel menu di sinistra: lì vedi ogni chiamata
ricevuta e l'eventuale errore.

Le cause tipiche:

- **"Chi ha accesso" non è impostato su Chiunque** → lo script rifiuta la
  chiamata prima ancora di eseguirla
- **`URL_NOTIFICA` vuoto o sbagliato** in `index.html`
- **Hai modificato lo script senza ripubblicare** → Esegui il deployment →
  *Gestisci deployment* → matita → *Nuova versione*. Questo è il passaggio
  che sfugge sempre: modificare il codice non basta, va rifatto il
  deployment
- **Quota giornaliera esaurita** → 100 mail al giorno con un account Gmail
  normale. Se succede, o sono arrivate cento iscrizioni in un giorno
  oppure qualcuno sta abusando del modulo

---

## Se cambia chi riceve le mail

Modifica la costante `DESTINATARI` in cima allo script, salva, e
**ripubblica** (Esegui il deployment → Gestisci deployment → matita →
Nuova versione). Senza il nuovo deployment continua a girare la versione
vecchia.

---

## Nota sulla privacy

Queste mail contengono nome, età e contatti di un minore. Vale la pena
che arrivino a un indirizzo del gruppo e non a caselle personali, e che
chi le riceve sappia di non doverle inoltrare fuori dalla CoCa.

L'informativa pubblicata sul sito dichiara che le richieste non accolte
vengono cancellate entro tre mesi dalla chiusura delle iscrizioni: la
cancellazione va fatta **anche nelle caselle di posta**, non solo nel
pannello.
