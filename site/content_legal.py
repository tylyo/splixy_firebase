"""Testi di supporto, privacy, termini e pagina di eliminazione account (IT/EN).

Segnaposto: @EMAIL@ @DELETE@ @PRIVACY@ @TERMS@ @SUPPORT@ @UPDATED@ (sostituiti da build.py).
"""

SUPPORT = {
    "en": {
        "title": "Splixy support", "desc": "Get help with Splixy: invitations, subscriptions, export and account questions.",
        "h1": "Support", "updated_label": "Last updated:",
        "body": """
<p>We are a small team and we read every message. Write to <a href="mailto:@EMAIL@?subject=Splixy%20Support">@EMAIL@</a> and we will get back to you, usually within a few working days.</p>
<div class="callout">To help us, please tell us the app version (Settings &amp; Info), your phone model and what you were doing when the problem happened. Never send us your password.</div>

<h2>Common questions</h2>
<h3>How do I invite friends to a group?</h3>
<p>Open the group, tap the share icon at the top right and choose <em>Invite to join</em>. Your friends can scan the QR code or paste the invite code in <em>Join an existing group</em>. Sharing is a Pro feature.</p>
<h3>How do I export a group?</h3>
<p>Open the group, tap the share icon and choose <em>Export to PDF</em> or <em>Export to CSV</em>. Exporting is a Pro feature.</p>
<h3>How do I cancel my Pro subscription?</h3>
<p>Subscriptions are managed by the store, not by Splixy. On iPhone: Settings, tap your name, Subscriptions, Splixy. On Android: open Google Play, tap your profile icon, Payments and subscriptions, Subscriptions, Splixy. Deleting the app does not cancel the subscription.</p>
<h3>I paid for Pro but it does not show up</h3>
<p>Open Settings &amp; Info, then Purchases, and choose <em>Restore purchases</em>. Make sure you are signed in with the same store account used for the purchase. If it still does not work, write to us.</p>
<h3>How do I delete my account?</h3>
<p>See the <a href="@DELETE@">delete account page</a>.</p>
<h3>Where can I read how my data is used?</h3>
<p>In the <a href="@PRIVACY@">Privacy Policy</a> and the <a href="@TERMS@">Terms of Use</a>.</p>
""",
    },
    "it": {
        "title": "Supporto Splixy", "desc": "Assistenza per Splixy: inviti, abbonamenti, export e domande sull'account.",
        "h1": "Supporto", "updated_label": "Ultimo aggiornamento:",
        "body": """
<p>Siamo un piccolo team e leggiamo ogni messaggio. Scrivi a <a href="mailto:@EMAIL@?subject=Supporto%20Splixy">@EMAIL@</a> e ti risponderemo, di solito entro pochi giorni lavorativi.</p>
<div class="callout">Per aiutarci, indica la versione dell'app (Impostazioni e Info), il modello del telefono e cosa stavi facendo quando si è verificato il problema. Non inviarci mai la tua password.</div>

<h2>Domande frequenti</h2>
<h3>Come invito gli amici in un gruppo?</h3>
<p>Apri il gruppo, tocca l'icona di condivisione in alto a destra e scegli <em>Invita a partecipare al Gruppo</em>. I tuoi amici possono inquadrare il QR code o incollare il codice di invito in <em>Unisciti a un Gruppo</em>. La condivisione è una funzione Pro.</p>
<h3>Come esporto un gruppo?</h3>
<p>Apri il gruppo, tocca l'icona di condivisione e scegli <em>Esporta in PDF</em> o <em>Esporta in CSV</em>. L'export è una funzione Pro.</p>
<h3>Come annullo l'abbonamento Pro?</h3>
<p>Gli abbonamenti sono gestiti dallo store, non da Splixy. Su iPhone: Impostazioni, tocca il tuo nome, Abbonamenti, Splixy. Su Android: apri Google Play, tocca l'icona del profilo, Pagamenti e abbonamenti, Abbonamenti, Splixy. Eliminare l'app non annulla l'abbonamento.</p>
<h3>Ho pagato Pro ma non risulta attivo</h3>
<p>Apri Impostazioni e Info, poi Acquisti, e scegli <em>Ripristina acquisti</em>. Verifica di aver effettuato l'accesso con lo stesso account dello store usato per l'acquisto. Se non funziona, scrivici.</p>
<h3>Come elimino il mio account?</h3>
<p>Vedi la <a href="@DELETE@">pagina per eliminare l'account</a>.</p>
<h3>Dove leggo come vengono usati i miei dati?</h3>
<p>Nell'<a href="@PRIVACY@">Informativa sulla privacy</a> e nei <a href="@TERMS@">Termini di utilizzo</a>.</p>
""",
    },
}

FORM_EN = """
<h2>Request deletion without the app</h2>
<p>If you can no longer open the app, send us a request here. We will check it and complete the deletion within 30 days.</p>
<form id="delete-form" class="form" novalidate>
<label for="email">Email address of your account</label>
<input type="email" id="email" name="email" required autocomplete="email" placeholder="name@example.com">
<label for="reason">Why are you leaving? (optional)</label>
<select id="reason" name="reason">
<option value="not_using">I no longer use the app</option>
<option value="privacy_concerns">Privacy concerns</option>
<option value="duplicate_account">Account created by mistake or duplicate</option>
<option value="trip_completed">The trip or event is over</option>
<option value="too_many_notifications">Too many notifications</option>
<option value="not_satisfied">Not satisfied with the features</option>
<option value="other" selected>Other</option>
</select>
<label for="reasonDetail">Anything to add? (optional)</label>
<textarea id="reasonDetail" name="reasonDetail" maxlength="500" rows="3"></textarea>
<label class="check"><input type="checkbox" id="confirm" required> I understand that my account and its data will be permanently deleted after 30 days.</label>
<button type="submit" class="btn" id="submit-btn">Send request</button>
<p class="status" id="status" role="status" aria-live="polite"></p>
</form>
<script>
(function () {
  var form = document.getElementById("delete-form"), status = document.getElementById("status"), btn = document.getElementById("submit-btn");
  var msg = {ok: "Request sent. We will confirm by email and complete the deletion within 30 days.", bad: "Please enter a valid email address and confirm the checkbox.", err: "Something went wrong. Please try again or write to @EMAIL@."};
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("email").value.trim();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !document.getElementById("confirm").checked) { status.textContent = msg.bad; return; }
    btn.disabled = true; status.textContent = "...";
    fetch("/api/requestAccountDeletion", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email: email, reason: document.getElementById("reason").value, reasonDetail: document.getElementById("reasonDetail").value})})
      .then(function (r) { if (!r.ok) throw new Error(r.status); status.textContent = msg.ok; form.reset(); })
      .catch(function () { status.textContent = msg.err; })
      .then(function () { btn.disabled = false; });
  });
})();
</script>
"""

FORM_IT = """
<h2>Richiedi l'eliminazione senza l'app</h2>
<p>Se non riesci pi\u00f9 ad aprire l'app, inviaci qui la richiesta. La verificheremo e completeremo l'eliminazione entro 30 giorni.</p>
<form id="delete-form" class="form" novalidate>
<label for="email">Indirizzo email del tuo account</label>
<input type="email" id="email" name="email" required autocomplete="email" placeholder="nome@esempio.it">
<label for="reason">Perch\u00e9 te ne vai? (facoltativo)</label>
<select id="reason" name="reason">
<option value="not_using">Non uso pi\u00f9 l'app</option>
<option value="privacy_concerns">Preoccupazioni sulla privacy</option>
<option value="duplicate_account">Account creato per errore o duplicato</option>
<option value="trip_completed">Il viaggio o l'evento \u00e8 finito</option>
<option value="too_many_notifications">Troppe notifiche</option>
<option value="not_satisfied">Non soddisfatto delle funzioni</option>
<option value="other" selected>Altro</option>
</select>
<label for="reasonDetail">Vuoi aggiungere qualcosa? (facoltativo)</label>
<textarea id="reasonDetail" name="reasonDetail" maxlength="500" rows="3"></textarea>
<label class="check"><input type="checkbox" id="confirm" required> Capisco che il mio account e i miei dati verranno eliminati definitivamente dopo 30 giorni.</label>
<button type="submit" class="btn" id="submit-btn">Invia richiesta</button>
<p class="status" id="status" role="status" aria-live="polite"></p>
</form>
<script>
(function () {
  var form = document.getElementById("delete-form"), status = document.getElementById("status"), btn = document.getElementById("submit-btn");
  var msg = {ok: "Richiesta inviata. Ti confermeremo via email e completeremo l'eliminazione entro 30 giorni.", bad: "Inserisci un indirizzo email valido e conferma la casella.", err: "Qualcosa \u00e8 andato storto. Riprova o scrivi a @EMAIL@."};
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("email").value.trim();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !document.getElementById("confirm").checked) { status.textContent = msg.bad; return; }
    btn.disabled = true; status.textContent = "...";
    fetch("/api/requestAccountDeletion", {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email: email, reason: document.getElementById("reason").value, reasonDetail: document.getElementById("reasonDetail").value})})
      .then(function (r) { if (!r.ok) throw new Error(r.status); status.textContent = msg.ok; form.reset(); })
      .catch(function () { status.textContent = msg.err; })
      .then(function () { btn.disabled = false; });
  });
})();
</script>
"""

DELETE = {
    "en": {
        "title": "Delete your Splixy account", "desc": "How to delete your Splixy account and the personal data linked to it.",
        "h1": "Delete your account", "updated_label": "Last updated:",
        "body": """
<p>You can delete your Splixy account and the personal data linked to it at any time.</p>

<h2>Delete it from the app</h2>
<ol>
<li>If you have a Pro subscription, cancel it first in your App Store or Google Play account settings. Deleting your Splixy account does not cancel a subscription (see <a href="@SUPPORT@">Support</a>).</li>
<li>In the app open <strong>Settings &amp; Info</strong>, tap <strong>Delete your account</strong> and confirm.</li>
</ol>
<p>Your account is disabled right away and you are signed out.</p>
""" + FORM_EN + """
<h2>What happens next</h2>
<ul>
<li><strong>Immediately:</strong> your account is disabled, your sessions are closed and your notification tokens are deleted.</li>
<li><strong>For 30 days:</strong> your profile is kept archived and not used, so that the deletion can be undone if it was a mistake. Write to <a href="mailto:@EMAIL@">@EMAIL@</a> within this period.</li>
<li><strong>After 30 days:</strong> your account and sign-in credentials, your profile (email, nickname, avatar), purchase records and profile photo are permanently deleted. Groups of which you were the only user are deleted with their expenses.</li>
</ul>

<h2>What may remain</h2>
<p>If you took part in groups shared with other people, those people still need the expenses to keep their balances correct. In those groups your participant stays as a name without a link to any account, and if you were the only creator the role passes to another member. Data we must keep to comply with a legal obligation, and backups, are deleted at the end of their retention period.</p>

<h2>Questions</h2>
<p>See the <a href="@PRIVACY@">Privacy Policy</a> or write to <a href="mailto:@EMAIL@">@EMAIL@</a>.</p>
""",
    },
    "it": {
        "title": "Elimina il tuo account Splixy", "desc": "Come eliminare il tuo account Splixy e i dati personali collegati.",
        "h1": "Elimina il tuo account", "updated_label": "Ultimo aggiornamento:",
        "body": """
<p>Puoi eliminare in qualsiasi momento il tuo account Splixy e i dati personali collegati.</p>

<h2>Eliminalo dall'app</h2>
<ol>
<li>Se hai un abbonamento Pro, annullalo prima dalle impostazioni del tuo account App Store o Google Play. Eliminare l'account Splixy non annulla l'abbonamento (vedi <a href="@SUPPORT@">Supporto</a>).</li>
<li>Nell'app apri <strong>Impostazioni e Info</strong>, tocca <strong>Elimina il tuo account</strong> e conferma.</li>
</ol>
<p>Il tuo account viene disattivato subito e vieni disconnesso.</p>
""" + FORM_IT + """
<h2>Cosa succede dopo</h2>
<ul>
<li><strong>Subito:</strong> il tuo account viene disattivato, le sessioni chiuse e i token per le notifiche eliminati.</li>
<li><strong>Per 30 giorni:</strong> il tuo profilo resta archiviato e inutilizzato, cos\u00ec che l'eliminazione possa essere annullata se \u00e8 stata un errore. Scrivi a <a href="mailto:@EMAIL@">@EMAIL@</a> entro questo periodo.</li>
<li><strong>Dopo 30 giorni:</strong> il tuo account e le credenziali di accesso, il profilo (email, nickname, avatar), i dati degli acquisti e la foto profilo vengono eliminati definitivamente. I gruppi di cui eri l'unico utente vengono eliminati con le relative spese.</li>
</ul>

<h2>Cosa pu\u00f2 restare</h2>
<p>Se hai partecipato a gruppi condivisi con altre persone, queste hanno ancora bisogno delle spese per mantenere corretti i propri saldi. In questi gruppi il tuo partecipante resta come nome senza collegamento ad alcun account e, se eri l'unico creatore, il ruolo passa a un altro membro. I dati che dobbiamo conservare per un obbligo di legge e i backup vengono eliminati al termine del loro periodo di conservazione.</p>

<h2>Domande</h2>
<p>Consulta l'<a href="@PRIVACY@">Informativa sulla privacy</a> o scrivi a <a href="mailto:@EMAIL@">@EMAIL@</a>.</p>
""",
    },
}

PRIVACY = {
    "en": {
        "title": "Splixy Privacy Policy", "desc": "How Splixy collects, uses and protects your personal data.",
        "h1": "Privacy Policy", "updated_label": "Last updated:",
        "body": """
<p>This policy explains what personal data the Splixy app and website process, why, and what your rights are. Splixy helps you keep track of shared expenses with friends.</p>

<h2>1. Who is responsible</h2>
<p>The data controller is <strong>tylyoDev</strong>, an independent developer. You can contact us at <a href="mailto:@EMAIL@">@EMAIL@</a>.</p>

<h2>2. What data we process</h2>
<table>
<tr><th>Data</th><th>Details</th></tr>
<tr><td>Account</td><td>Email address, nickname, avatar and the sign-in method you choose (email and password, Google or Apple). Passwords are handled by Firebase Authentication and are never visible to us.</td></tr>
<tr><td>Group content</td><td>Group names, participants' names, expenses (name, amount, quantity, category or tags, date, notes), transfers, balances, the group's currency and who can view or edit it.</td></tr>
<tr><td>Other people's names</td><td>The names you type, or choose from your contacts, to add participants to a group.</td></tr>
<tr><td>Notifications</td><td>A device token, only if you allow notifications, used to send you updates about your groups.</td></tr>
<tr><td>Subscription</td><td>Whether you have Splixy Pro and until when. Payment is handled by Apple or Google: we never receive your card or payment details.</td></tr>
<tr><td>Account records</td><td>Time of last sign-in, number of groups, whether your email is verified and when you accepted this policy and the Terms.</td></tr>
<tr><td>Technical data</td><td>The services we use to run the app (see section 6) may process technical data such as IP address and device identifiers to deliver the service and keep it secure.</td></tr>
</table>
<p>The app can ask for these permissions: <strong>camera</strong>, to scan a QR code to join a group (images are not stored); <strong>contacts</strong>, so you can pick participants by name (only the name you choose is used); <strong>photos</strong>, only if you choose a profile picture; <strong>notifications</strong>. You can change them at any time in your phone settings.</p>

<h2>3. Why we use it and on what legal basis</h2>
<table>
<tr><th>Purpose</th><th>Legal basis (GDPR)</th></tr>
<tr><td>Create your account and provide the app: groups, expenses, balances, sharing, export, statistics</td><td>Performance of the contract (Art. 6(1)(b))</td></tr>
<tr><td>Manage Splixy Pro</td><td>Performance of the contract (Art. 6(1)(b))</td></tr>
<tr><td>Send notifications about your groups</td><td>Your consent, given through the device permission (Art. 6(1)(a))</td></tr>
<tr><td>Keep the service secure and prevent abuse</td><td>Legitimate interest (Art. 6(1)(f))</td></tr>
<tr><td>Comply with legal obligations</td><td>Legal obligation (Art. 6(1)(c))</td></tr>
</table>

<h2>4. What we do not do</h2>
<ul>
<li>We do not show advertising and we do not use advertising or third-party analytics services.</li>
<li>We do not sell your personal data.</li>
<li>We do not use your data for automated decisions or profiling.</li>
</ul>

<h2>5. Who can see your data</h2>
<ul>
<li><strong>The people you share a group with.</strong> They can see the group's content and participants' names and, depending on the permission you give, add, edit or delete expenses. Share a group only with people you trust.</li>
<li><strong>Our service providers</strong>, listed below, who process data on our behalf.</li>
<li>Public authorities, only when required by law.</li>
</ul>

<h2>6. Service providers and transfers outside the EEA</h2>
<p>Splixy runs on Google Firebase (Authentication, Realtime Database, Cloud Functions, Cloud Storage and Cloud Messaging), provided by Google. Sign-in with Google or Apple and subscription payments are provided by Google and Apple under their own privacy policies.</p>
<p>Data may be processed in the United States and other countries outside the European Economic Area. Google relies on appropriate safeguards, such as the Standard Contractual Clauses and the EU-US Data Privacy Framework.</p>

<h2>7. How long we keep it</h2>
<p>We keep your data while your account is active. When you ask us to delete your account we remove it as described in the <a href="@DELETE@">delete account page</a>, within 30 days. Data we must keep by law, and backups, are deleted when their retention period ends.</p>

<h2>8. Your rights</h2>
<p>You can ask us to access, correct, delete, restrict or export your data (the export of a group in PDF or CSV is also available in the app), object to the processing, and withdraw your consent at any time. Write to <a href="mailto:@EMAIL@">@EMAIL@</a>; we will reply within one month. You also have the right to lodge a complaint with your data protection authority. In Italy this is the <em>Garante per la protezione dei dati personali</em> (<a href="https://www.garanteprivacy.it" rel="noopener">garanteprivacy.it</a>).</p>

<h2>9. Children</h2>
<p>Splixy is not intended for people under 16 and we do not knowingly collect their data. If you believe a child has given us data, write to us and we will delete it.</p>

<h2>10. Security</h2>
<p>Data is transmitted over encrypted connections and stored with access rules that limit each group to its participants. No system is completely secure, so we cannot guarantee absolute security.</p>

<h2>11. Changes</h2>
<p>We may update this policy. The date at the top shows the latest version; for significant changes we will notify you in the app.</p>

<h2>12. Contact</h2>
<p><a href="mailto:@EMAIL@">@EMAIL@</a></p>
""",
    },
    "it": {
        "title": "Informativa sulla privacy di Splixy", "desc": "Come Splixy raccoglie, usa e protegge i tuoi dati personali.",
        "h1": "Informativa sulla privacy", "updated_label": "Ultimo aggiornamento:",
        "body": """
<p>Questa informativa spiega quali dati personali trattano l'app e il sito di Splixy, perché, e quali sono i tuoi diritti. Splixy ti aiuta a tenere il conto delle spese condivise con gli amici.</p>

<h2>1. Titolare del trattamento</h2>
<p>Il titolare del trattamento è <strong>tylyoDev</strong>, sviluppatore indipendente. Puoi contattarci all'indirizzo <a href="mailto:@EMAIL@">@EMAIL@</a>.</p>

<h2>2. Quali dati trattiamo</h2>
<table>
<tr><th>Dato</th><th>Dettagli</th></tr>
<tr><td>Account</td><td>Indirizzo email, nickname, avatar e metodo di accesso scelto (email e password, Google o Apple). Le password sono gestite da Firebase Authentication e non sono mai visibili a noi.</td></tr>
<tr><td>Contenuti dei gruppi</td><td>Nomi dei gruppi, nomi dei partecipanti, spese (nome, importo, quantità, categoria o etichette, data, note), trasferimenti, saldi, valuta del gruppo e chi può vederlo o modificarlo.</td></tr>
<tr><td>Nomi di altre persone</td><td>I nomi che inserisci, o scegli dalla rubrica, per aggiungere partecipanti a un gruppo.</td></tr>
<tr><td>Notifiche</td><td>Un token del dispositivo, solo se consenti le notifiche, usato per inviarti aggiornamenti sui tuoi gruppi.</td></tr>
<tr><td>Abbonamento</td><td>Se hai Splixy Pro e fino a quando. Il pagamento è gestito da Apple o Google: non riceviamo mai i dati della tua carta o di pagamento.</td></tr>
<tr><td>Dati dell'account</td><td>Data dell'ultimo accesso, numero di gruppi, verifica dell'email e quando hai accettato questa informativa e i Termini.</td></tr>
<tr><td>Dati tecnici</td><td>I servizi che usiamo per far funzionare l'app (vedi sezione 6) possono trattare dati tecnici come indirizzo IP e identificativi del dispositivo per erogare il servizio e mantenerlo sicuro.</td></tr>
</table>
<p>L'app può chiedere questi permessi: <strong>fotocamera</strong>, per inquadrare un QR code e unirti a un gruppo (le immagini non vengono salvate); <strong>contatti</strong>, per scegliere i partecipanti per nome (viene usato solo il nome che selezioni); <strong>foto</strong>, solo se scegli una foto profilo; <strong>notifiche</strong>. Puoi modificarli in qualsiasi momento dalle impostazioni del telefono.</p>

<h2>3. Perché li usiamo e su quale base giuridica</h2>
<table>
<tr><th>Finalità</th><th>Base giuridica (GDPR)</th></tr>
<tr><td>Creare il tuo account e fornire l'app: gruppi, spese, saldi, condivisione, export, statistiche</td><td>Esecuzione del contratto (art. 6, par. 1, lett. b)</td></tr>
<tr><td>Gestire Splixy Pro</td><td>Esecuzione del contratto (art. 6, par. 1, lett. b)</td></tr>
<tr><td>Inviare notifiche sui tuoi gruppi</td><td>Il tuo consenso, dato tramite il permesso del dispositivo (art. 6, par. 1, lett. a)</td></tr>
<tr><td>Mantenere il servizio sicuro e prevenire abusi</td><td>Legittimo interesse (art. 6, par. 1, lett. f)</td></tr>
<tr><td>Adempiere a obblighi di legge</td><td>Obbligo legale (art. 6, par. 1, lett. c)</td></tr>
</table>

<h2>4. Cosa non facciamo</h2>
<ul>
<li>Non mostriamo pubblicità e non usiamo servizi pubblicitari o di analisi di terze parti.</li>
<li>Non vendiamo i tuoi dati personali.</li>
<li>Non usiamo i tuoi dati per decisioni automatizzate o profilazione.</li>
</ul>

<h2>5. Chi può vedere i tuoi dati</h2>
<ul>
<li><strong>Le persone con cui condividi un gruppo.</strong> Possono vedere i contenuti del gruppo e i nomi dei partecipanti e, in base al permesso che assegni, aggiungere, modificare o eliminare spese. Condividi un gruppo solo con persone di cui ti fidi.</li>
<li><strong>I nostri fornitori di servizi</strong>, indicati di seguito, che trattano i dati per nostro conto.</li>
<li>Le autorità pubbliche, solo quando richiesto dalla legge.</li>
</ul>

<h2>6. Fornitori di servizi e trasferimenti fuori dallo SEE</h2>
<p>Splixy funziona su Google Firebase (Authentication, Realtime Database, Cloud Functions, Cloud Storage e Cloud Messaging), fornito da Google. L'accesso con Google o Apple e i pagamenti degli abbonamenti sono forniti da Google e Apple secondo le loro informative sulla privacy.</p>
<p>I dati possono essere trattati negli Stati Uniti e in altri Paesi fuori dallo Spazio economico europeo. Google si basa su garanzie adeguate, come le Clausole contrattuali standard e l'EU-US Data Privacy Framework.</p>

<h2>7. Per quanto tempo li conserviamo</h2>
<p>Conserviamo i tuoi dati finché il tuo account è attivo. Quando ci chiedi di eliminare l'account lo rimuoviamo come descritto nella <a href="@DELETE@">pagina per eliminare l'account</a>, entro 30 giorni. I dati che dobbiamo conservare per legge e i backup vengono eliminati al termine del periodo di conservazione.</p>

<h2>8. I tuoi diritti</h2>
<p>Puoi chiederci di accedere ai tuoi dati, rettificarli, cancellarli, limitarne il trattamento o riceverli in formato portabile (l'export di un gruppo in PDF o CSV è disponibile anche nell'app), opporti al trattamento e revocare il consenso in qualsiasi momento. Scrivi a <a href="mailto:@EMAIL@">@EMAIL@</a>: risponderemo entro un mese. Hai inoltre il diritto di proporre reclamo all'autorità di controllo. In Italia è il <em>Garante per la protezione dei dati personali</em> (<a href="https://www.garanteprivacy.it" rel="noopener">garanteprivacy.it</a>).</p>

<h2>9. Minori</h2>
<p>Splixy non è destinato a persone sotto i 16 anni e non raccogliamo consapevolmente i loro dati. Se ritieni che un minore ci abbia fornito dei dati, scrivici e li elimineremo.</p>

<h2>10. Sicurezza</h2>
<p>I dati viaggiano su connessioni cifrate e sono conservati con regole di accesso che limitano ogni gruppo ai suoi partecipanti. Nessun sistema è completamente sicuro, quindi non possiamo garantire una sicurezza assoluta.</p>

<h2>11. Modifiche</h2>
<p>Possiamo aggiornare questa informativa. La data in alto indica l'ultima versione; per le modifiche rilevanti ti avviseremo nell'app.</p>

<h2>12. Contatti</h2>
<p><a href="mailto:@EMAIL@">@EMAIL@</a></p>
""",
    },
}

TERMS = {
    "en": {
        "title": "Splixy Terms of Use", "desc": "The terms that apply when you use Splixy, including the Free and Pro plans.",
        "h1": "Terms of Use", "updated_label": "Last updated:",
        "body": """
<p>These terms govern your use of the Splixy app and website, provided by <strong>tylyoDev</strong> ("we"). By creating an account or using Splixy you accept them. If you do not agree, please do not use the app.</p>

<h2>1. The service</h2>
<p>Splixy lets you record expenses shared with other people and calculates who owes what. Splixy is <strong>not</strong> a bank, a payment service or a financial or accounting adviser: no money moves through the app, and payments between participants happen outside it.</p>

<h2>2. Your account</h2>
<ul>
<li>You must be at least 16 years old.</li>
<li>Give accurate information and keep your sign-in details secure. You are responsible for what happens under your account.</li>
<li>You can stop using Splixy and ask us to delete your account at any time (see the <a href="@DELETE@">delete account page</a>).</li>
</ul>

<h2>3. Groups and shared content</h2>
<p>You are responsible for the content you add. People you share a group with can see its content and, depending on the permission you give, add, edit or delete expenses. Share a group only with people you trust and do not add other people's personal data without a good reason.</p>

<h2>4. Acceptable use</h2>
<p>Do not use Splixy for anything unlawful, to harass others, to upload harmful content, to disrupt or overload the service, to access other people's accounts or data, or to copy or reverse engineer the app except where the law allows it.</p>

<h2>5. Free plan and Splixy Pro</h2>
<ul>
<li>The Free plan includes up to 7 groups, 15 transactions and 7 participants, and does not include sharing, export or statistics.</li>
<li><strong>Splixy Pro</strong> removes these limits and adds sharing, export and statistics. It is an auto-renewing monthly subscription at <strong>2.99 EUR per month</strong> (the price may vary by country).</li>
<li>Payment is charged to your Apple ID or Google Play account when you confirm the purchase. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period.</li>
<li>You can manage or cancel the subscription at any time in your App Store or Google Play account settings. Cancelling stops future renewals; you keep Pro until the end of the period already paid.</li>
<li>Refunds are handled by Apple or Google under their policies.</li>
<li>We may change prices or features; we will tell you in advance of any price change that applies to your subscription, as required by the store.</li>
</ul>
<p>On iOS, Apple's <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" rel="noopener">Standard License Agreement</a> also applies to your use of the app. On Android, the Google Play Terms of Service apply.</p>

<h2>6. Accuracy of the calculations</h2>
<p>Balances are calculated from the data entered by you and the other participants, and amounts are rounded. Please check them before settling up. We are not responsible for mistakes in the data entered.</p>

<h2>7. Intellectual property</h2>
<p>The app, the Splixy name and logo and the website belong to tylyoDev. You keep ownership of your content and give us the permission needed to store and process it to provide the service.</p>

<h2>8. Availability and changes</h2>
<p>We work to keep Splixy available but we do not guarantee that it will be uninterrupted or error-free. We may change or discontinue features, and we may suspend or close accounts that break these terms.</p>

<h2>9. Liability</h2>
<p>Splixy is provided "as is". To the extent allowed by law, we are not liable for indirect or consequential losses or for losses arising from data entered by users. Nothing in these terms excludes or limits liability that cannot be excluded by law, and the rights you have as a consumer under mandatory law are not affected.</p>

<h2>10. Governing law</h2>
<p>These terms are governed by Italian law. If you are a consumer, you also keep the protection of the mandatory rules of the country where you live.</p>

<h2>11. Changes to these terms</h2>
<p>We may update these terms. The date at the top shows the latest version; for significant changes we will notify you in the app. If you keep using Splixy after a change takes effect, you accept the new terms.</p>

<h2>12. Contact</h2>
<p><a href="mailto:@EMAIL@">@EMAIL@</a> &middot; <a href="@PRIVACY@">Privacy Policy</a></p>
""",
    },
    "it": {
        "title": "Termini di utilizzo di Splixy", "desc": "I termini che si applicano quando usi Splixy, compresi i piani Gratis e Pro.",
        "h1": "Termini di utilizzo", "updated_label": "Ultimo aggiornamento:",
        "body": """
<p>Questi termini regolano l'uso dell'app e del sito di Splixy, forniti da <strong>tylyoDev</strong> ("noi"). Creando un account o usando Splixy li accetti. Se non sei d'accordo, ti chiediamo di non usare l'app.</p>

<h2>1. Il servizio</h2>
<p>Splixy ti permette di registrare le spese condivise con altre persone e calcola chi deve cosa. Splixy <strong>non</strong> è una banca, un servizio di pagamento né un consulente finanziario o contabile: nell'app non transita denaro e i pagamenti tra i partecipanti avvengono fuori dall'app.</p>

<h2>2. Il tuo account</h2>
<ul>
<li>Devi avere almeno 16 anni.</li>
<li>Fornisci informazioni corrette e custodisci con cura le credenziali di accesso. Sei responsabile di ciò che avviene tramite il tuo account.</li>
<li>Puoi smettere di usare Splixy e chiederci di eliminare il tuo account in qualsiasi momento (vedi la <a href="@DELETE@">pagina per eliminare l'account</a>).</li>
</ul>

<h2>3. Gruppi e contenuti condivisi</h2>
<p>Sei responsabile dei contenuti che aggiungi. Le persone con cui condividi un gruppo possono vederne i contenuti e, in base al permesso che assegni, aggiungere, modificare o eliminare spese. Condividi un gruppo solo con persone di cui ti fidi e non inserire dati personali di altre persone senza un valido motivo.</p>

<h2>4. Uso consentito</h2>
<p>Non usare Splixy per attività illecite, per molestare altri, per caricare contenuti dannosi, per disturbare o sovraccaricare il servizio, per accedere ad account o dati altrui, né per copiare l'app o ricostruirne il codice, salvo dove la legge lo consente.</p>

<h2>5. Piano Gratis e Splixy Pro</h2>
<ul>
<li>Il piano Gratis include fino a 7 gruppi, 15 transazioni e 7 partecipanti, e non include condivisione, export e statistiche.</li>
<li><strong>Splixy Pro</strong> elimina questi limiti e aggiunge condivisione, export e statistiche. È un abbonamento mensile a rinnovo automatico al prezzo di <strong>2,99 EUR al mese</strong> (il prezzo può variare in base al Paese).</li>
<li>Il pagamento viene addebitato sul tuo ID Apple o account Google Play alla conferma dell'acquisto. L'abbonamento si rinnova automaticamente se non lo annulli almeno 24 ore prima della fine del periodo in corso.</li>
<li>Puoi gestire o annullare l'abbonamento in qualsiasi momento dalle impostazioni del tuo account App Store o Google Play. L'annullamento ferma i rinnovi futuri; mantieni Pro fino alla fine del periodo già pagato.</li>
<li>I rimborsi sono gestiti da Apple o Google secondo le loro regole.</li>
<li>Possiamo modificare prezzi o funzioni; ti avviseremo in anticipo di ogni variazione di prezzo che riguarda il tuo abbonamento, come richiesto dallo store.</li>
</ul>
<p>Su iOS si applica anche il <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" rel="noopener">contratto di licenza standard</a> di Apple. Su Android si applicano i Termini di servizio di Google Play.</p>

<h2>6. Correttezza dei calcoli</h2>
<p>I saldi sono calcolati sui dati inseriti da te e dagli altri partecipanti e gli importi sono arrotondati. Verificali prima di pareggiare i conti. Non siamo responsabili di errori nei dati inseriti.</p>

<h2>7. Proprietà intellettuale</h2>
<p>L'app, il nome e il logo Splixy e il sito appartengono a tylyoDev. Resti proprietario dei tuoi contenuti e ci dai l'autorizzazione necessaria per conservarli ed elaborarli allo scopo di fornire il servizio.</p>

<h2>8. Disponibilità e modifiche</h2>
<p>Ci impegniamo a mantenere Splixy disponibile ma non garantiamo che sia ininterrotto o privo di errori. Possiamo modificare o interrompere delle funzioni e possiamo sospendere o chiudere gli account che violano questi termini.</p>

<h2>9. Responsabilità</h2>
<p>Splixy è fornito "così com'è". Nei limiti consentiti dalla legge, non rispondiamo di danni indiretti o consequenziali né di perdite derivanti dai dati inseriti dagli utenti. Nulla in questi termini esclude o limita responsabilità che non possono essere escluse per legge, e restano salvi i diritti che hai come consumatore in base a norme inderogabili.</p>

<h2>10. Legge applicabile</h2>
<p>Questi termini sono regolati dalla legge italiana. Se sei un consumatore mantieni anche la tutela delle norme inderogabili del Paese in cui risiedi.</p>

<h2>11. Modifiche ai termini</h2>
<p>Possiamo aggiornare questi termini. La data in alto indica l'ultima versione; per le modifiche rilevanti ti avviseremo nell'app. Se continui a usare Splixy dopo l'entrata in vigore di una modifica, accetti i nuovi termini.</p>

<h2>12. Contatti</h2>
<p><a href="mailto:@EMAIL@">@EMAIL@</a> &middot; <a href="@PRIVACY@">Informativa sulla privacy</a></p>
""",
    },
}
