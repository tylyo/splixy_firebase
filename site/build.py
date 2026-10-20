"""Genera le pagine statiche del sito (landing, supporto, privacy, termini, eliminazione account).

Uso: python3 build.py        (scrive in ../public)
Prima: make_images.py per le immagini in public/assets/site/.
"""
import re
from pathlib import Path

from content_legal import DELETE, PRIVACY, SUPPORT, TERMS

PUBLIC = Path(__file__).parent.parent / "public"

SITE = "https://splixy.web.app"
EMAIL = "tylyodev@gmail.com"
PLAY_URL = "https://play.google.com/store/apps/details?id=com.tylyodev.splixy"
APPSTORE_URL = "https://apps.apple.com/us/app/splixy/id6449210549"
UPDATED = {"it": "20 ottobre 2026", "en": "October 20, 2026"}

# percorso pubblico di ogni pagina, per lingua
PATHS = {
    "home": {"en": "/", "it": "/it"},
    "support": {"en": "/support", "it": "/it/support"},
    "privacy": {"en": "/privacy", "it": "/it/privacy"},
    "terms": {"en": "/terms", "it": "/it/terms"},
    "delete": {"en": "/delete-account", "it": "/it/delete-account"},
}
# pagine web complete: (file in public/, pagina, lingua)
FILES = [
    ("index.html", "home", "en"), ("index.it.html", "home", "it"),
    ("support.html", "support", "en"), ("it/support.html", "support", "it"),
    ("privacy.html", "privacy", "en"), ("it/privacy.html", "privacy", "it"),
    ("terms.html", "terms", "en"), ("it/terms.html", "terms", "it"),
    ("delete-account.html", "delete", "en"), ("it/delete-account.html", "delete", "it"),
]
# frammenti HTML per l'app (attilio_lib li scarica da /<doc>.<lang> e scarta le risposte con "<html"):
# niente tabelle ne' stili, link assoluti
FRAGMENTS = [(f"{page}.{lang}.html", page, lang) for page in ("support", "privacy", "terms") for lang in ("it", "en")]

T = {
    "en": {
        "lang_name": "Italiano", "features": "Features", "plans": "Plans", "support": "Support", "privacy": "Privacy",
        "terms": "Terms", "delete": "Delete account", "skip": "Skip to content",
        "home_title": "Splixy: split expenses with friends",
        "home_desc": "Split trip, flatmate and group expenses with friends. Clear balances, real-time sharing, export to PDF and CSV. Free to start.",
        "h1": "Split expenses with friends, clearly.",
        "lead": "Trips, shared flats, dinners: add the expenses and Splixy tells everyone exactly who owes what, updated in real time.",
        "get_google": "Get it on Google Play", "get_apple": "Download on the App Store",
        "hero_note": "Free to start. Upgrade to Pro for sharing, export and statistics.",
        "feat_h": "Everything you need to settle up", "feat_sub": "Simple enough for a weekend away, complete enough for a shared flat.",
        "features_list": [
            ("\U0001F465", "A group for every occasion", "Create a group in seconds and add friends by name or from your contacts."),
            ("➗", "Split your way", "Divide an expense equally, by shares or by percentage, and record who paid."),
            ("⚖️", "Balances at a glance", "See each person's balance and who should pay whom, always up to date."),
            ("\U0001F517", "Share in real time (Pro)", "Invite friends with a QR code or an invite code. Everyone sees the same group, and you choose who can edit."),
            ("\U0001F4CA", "Understand the spending (Pro)", "Trends by category and by participant, filtered by period."),
            ("\U0001F4C4", "Export and keep a record (Pro)", "Export the group summary to PDF or CSV and share the final balance."),
        ],
        "shots_h": "See it in action",
        "shot_alts": ["Group balances", "Transactions list", "Invite with a QR code", "Statistics by category", "Statistics by participant", "Export to PDF or CSV"],
        "plans_h": "Free to start, Pro when you need more",
        "free": "Free", "free_price": "Free", "pro": "Pro", "pro_price": "2.99 EUR", "pro_per": "/ month",
        "free_items": ["Up to 7 groups", "Up to 15 transactions", "Up to 7 participants", "Split by shares or percentage", "Balances and categories"],
        "pro_items": ["Unlimited groups, transactions and participants", "Real-time sharing with friends", "Export to PDF and CSV", "Full statistics"],
        "plans_fine": "Splixy Pro is an auto-renewing monthly subscription at 2.99 EUR per month (the price may vary by country). Payment is charged to your store account when you confirm the purchase. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period. You can manage or cancel it at any time in your App Store or Google Play account settings.",
        "faq_h": "Questions",
        "faq": [
            ("Does Splixy move money?", "No. Splixy keeps track of who owes what and suggests how to settle up. Payments happen outside the app, however you prefer."),
            ("Do I need an account?", "Yes. You can sign in with email, Google or Apple, so your groups are available on any device."),
            ("Can I use another currency?", "Each group has its own currency, so you can keep a trip abroad separate from your everyday expenses."),
            ("How do I cancel Pro?", "Subscriptions are managed by the store: on iPhone open Settings, tap your name, then Subscriptions; on Android open Google Play, then Payments and subscriptions."),
            ("How do I delete my account?", "Follow the steps on the <a href=\"@DELETE@\">delete account page</a>."),
        ],
        "foot": "Made by tylyoDev.", "contact": "Contact",
    },
    "it": {
        "lang_name": "English", "features": "Funzioni", "plans": "Piani", "support": "Supporto", "privacy": "Privacy",
        "terms": "Termini", "delete": "Elimina account", "skip": "Vai al contenuto",
        "home_title": "Splixy: dividi le spese con gli amici",
        "home_desc": "Dividi le spese di viaggi, coinquilini e gruppi con gli amici. Saldi chiari, condivisione in tempo reale, export in PDF e CSV. Gratis per iniziare.",
        "h1": "Dividi le spese con gli amici, in modo chiaro.",
        "lead": "Viaggi, case condivise, cene: aggiungi le spese e Splixy ti dice esattamente chi deve cosa a chi, aggiornato in tempo reale.",
        "get_google": "Scarica su Google Play", "get_apple": "Scarica su App Store",
        "hero_note": "Gratis per iniziare. Con Pro condividi, esporti e vedi le statistiche.",
        "feat_h": "Tutto quello che serve per fare i conti", "feat_sub": "Semplice per un weekend fuori, completo per una casa condivisa.",
        "features_list": [
            ("\U0001F465", "Un gruppo per ogni occasione", "Crea un gruppo in pochi secondi e aggiungi gli amici per nome o dalla rubrica."),
            ("➗", "Dividi come vuoi", "Dividi una spesa in parti uguali, per quote o in percentuale, e registra chi ha pagato."),
            ("⚖️", "Saldi a colpo d'occhio", "Vedi il saldo di ognuno e chi deve pagare chi, sempre aggiornato."),
            ("\U0001F517", "Condividi in tempo reale (Pro)", "Invita gli amici con un QR code o un codice. Tutti vedono lo stesso gruppo e tu scegli chi può modificare."),
            ("\U0001F4CA", "Capisci dove vanno i soldi (Pro)", "Andamento per categoria e per partecipante, filtrato per periodo."),
            ("\U0001F4C4", "Esporta e conserva (Pro)", "Esporta il riepilogo del gruppo in PDF o CSV e condividi il saldo finale."),
        ],
        "shots_h": "Guardalo in azione",
        "shot_alts": ["Saldi del gruppo", "Elenco delle movimentazioni", "Invito con QR code", "Statistiche per categoria", "Statistiche per partecipante", "Export in PDF o CSV"],
        "plans_h": "Gratis per iniziare, Pro quando serve di più",
        "free": "Gratis", "free_price": "Gratis", "pro": "Pro", "pro_price": "2,99 EUR", "pro_per": "/ mese",
        "free_items": ["Fino a 7 gruppi", "Fino a 15 transazioni", "Fino a 7 partecipanti", "Divisione per quote o percentuale", "Saldi e categorie"],
        "pro_items": ["Gruppi, transazioni e partecipanti illimitati", "Condivisione in tempo reale con gli amici", "Export in PDF e CSV", "Statistiche complete"],
        "plans_fine": "Splixy Pro è un abbonamento mensile a rinnovo automatico al prezzo di 2,99 EUR al mese (il prezzo può variare in base al Paese). Il pagamento viene addebitato sul tuo account dello store alla conferma dell'acquisto. L'abbonamento si rinnova automaticamente se non viene annullato almeno 24 ore prima della fine del periodo in corso. Puoi gestirlo o annullarlo in qualsiasi momento dalle impostazioni del tuo account App Store o Google Play.",
        "faq_h": "Domande frequenti",
        "faq": [
            ("Splixy sposta i soldi?", "No. Splixy tiene il conto di chi deve cosa e suggerisce come pareggiare. I pagamenti avvengono fuori dall'app, nel modo che preferisci."),
            ("Serve un account?", "Sì. Puoi accedere con email, Google o Apple, così i tuoi gruppi sono disponibili su ogni dispositivo."),
            ("Posso usare un'altra valuta?", "Ogni gruppo ha la sua valuta, così puoi tenere separato un viaggio all'estero dalle spese di tutti i giorni."),
            ("Come annullo Pro?", "Gli abbonamenti sono gestiti dallo store: su iPhone apri Impostazioni, tocca il tuo nome e poi Abbonamenti; su Android apri Google Play e poi Pagamenti e abbonamenti."),
            ("Come elimino il mio account?", "Segui i passaggi nella <a href=\"@DELETE@\">pagina per eliminare l'account</a>."),
        ],
        "foot": "Creato da tylyoDev.", "contact": "Contatti",
    },
}

SHOT_NAMES = ["group_detail", "transactions", "share_qr", "stats_categories", "stats_members", "export_menu"]


def fill(text, lang, absolute=False):
    pre = SITE if absolute else ""
    return (text.replace("@EMAIL@", EMAIL).replace("@DELETE@", pre + PATHS["delete"][lang])
            .replace("@PRIVACY@", pre + PATHS["privacy"][lang]).replace("@TERMS@", pre + PATHS["terms"][lang])
            .replace("@SUPPORT@", pre + PATHS["support"][lang]).replace("@UPDATED@", UPDATED[lang]))


def tables_to_lists(html):
    """Le tabelle diventano elenchi: il viewer HTML dell'app non le supporta."""
    def table(m):
        items = []
        for row in re.findall(r"<tr>(.*?)</tr>", m.group(1), flags=re.S):
            cells = re.findall(r"<td>(.*?)</td>", row, flags=re.S)
            if len(cells) == 2:
                items.append(f"<li><strong>{cells[0]}:</strong> {cells[1]}</li>")
        return "<ul>" + "".join(items) + "</ul>"
    html = re.sub(r"<table>(.*?)</table>", table, html, flags=re.S)
    return re.sub(r'<div class="callout">(.*?)</div>', r"<p><em>\1</em></p>", html, flags=re.S)


def fragment(lang, data):
    d = data[lang]
    body = tables_to_lists(fill(d["body"], lang, absolute=True))
    out = f"<h1>{d['h1']}</h1>\n<p>{d['updated_label']} {UPDATED[lang]}</p>\n{body}\n"
    assert "<html" not in out.lower()
    return out


def head(lang, page, title, desc, canonical):
    other = "it" if lang == "en" else "en"
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{SITE}{canonical}">
<link rel="alternate" hreflang="{lang}" href="{SITE}{PATHS[page][lang]}">
<link rel="alternate" hreflang="{other}" href="{SITE}{PATHS[page][other]}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/site/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/site/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Splixy">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{SITE}{canonical}">
<meta property="og:image" content="{SITE}/assets/site/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0062a8">
<link rel="stylesheet" href="/assets/site/site.css">
"""


def header(lang, page):
    t = T[lang]
    other = "it" if lang == "en" else "en"
    home = PATHS["home"][lang]
    base = "" if page == "home" else home
    cur = lambda p: ' aria-current="page"' if page == p else ""
    return f"""</head>
<body>
<a class="skip" href="#main">{t['skip']}</a>
<header class="site-header"><div class="wrap">
<a class="brand" href="{home}"><img src="/assets/img/logo.webp" alt="" width="34" height="34">Splixy</a>
<nav class="nav" aria-label="Main">
<a class="opt" href="{base}#features">{t['features']}</a>
<a class="opt" href="{base}#plans">{t['plans']}</a>
<a href="{PATHS['support'][lang]}"{cur('support')}>{t['support']}</a>
<a href="{PATHS['privacy'][lang]}"{cur('privacy')}>{t['privacy']}</a>
<a href="{PATHS['terms'][lang]}"{cur('terms')}>{t['terms']}</a>
<a class="lang" href="{PATHS[page][other]}" hreflang="{other}" lang="{other}">{t['lang_name']}</a>
</nav></div></header>
"""


def footer(lang):
    t = T[lang]
    return f"""<footer class="site-footer"><div class="wrap">
<div>&copy; 2026 Splixy. {t['foot']}</div>
<div><a href="{PATHS['support'][lang]}">{t['support']}</a><a href="{PATHS['privacy'][lang]}">{t['privacy']}</a><a href="{PATHS['terms'][lang]}">{t['terms']}</a><a href="{PATHS['delete'][lang]}">{t['delete']}</a><a href="mailto:{EMAIL}">{t['contact']}</a></div>
</div></footer>
</body>
</html>
"""


def badges(lang):
    t = T[lang]
    out = f'<a href="{PLAY_URL}" rel="noopener"><img src="/assets/img/google-play-badge.png" alt="{t["get_google"]}" width="162" height="48"></a>'
    if APPSTORE_URL:
        out = f'<a href="{APPSTORE_URL}" rel="noopener"><img src="/assets/img/app-store-badge.svg" alt="{t["get_apple"]}" width="144" height="48"></a>' + out
    return f'<div class="badges">{out}</div>'


def home(lang):
    t = T[lang]
    feats = "".join(f'<div class="card"><div class="ico" aria-hidden="true">{i}</div><h3>{h}</h3><p>{p}</p></div>' for i, h, p in t["features_list"])
    shots = "".join(f'<img src="/assets/site/shot-{lang}-{n}.jpg" alt="{a}" width="540" height="1173" loading="lazy">' for n, a in zip(SHOT_NAMES, t["shot_alts"]))
    faq = "".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in t["faq"])
    free = "".join(f"<li>{x}</li>" for x in t["free_items"])
    pro = "".join(f"<li>{x}</li>" for x in t["pro_items"])
    ld = ('{"@context":"https://schema.org","@type":"MobileApplication","name":"Splixy","operatingSystem":"iOS, Android",'
          '"applicationCategory":"FinanceApplication","description":"%s","offers":[{"@type":"Offer","price":"0","priceCurrency":"EUR"},'
          '{"@type":"Offer","price":"2.99","priceCurrency":"EUR","name":"Splixy Pro monthly"}],"url":"%s%s"}') % (t["home_desc"], SITE, PATHS["home"][lang])
    return (head(lang, "home", t["home_title"], t["home_desc"], PATHS["home"][lang]) + f'<script type="application/ld+json">{ld}</script>\n' + header(lang, "home") + f"""
<main id="main">
<section class="hero"><div class="wrap">
<div><h1>{t['h1']}</h1><p class="lead">{t['lead']}</p>{badges(lang)}<p class="note">{t['hero_note']}</p></div>
<div class="hero-shot"><img src="/assets/site/hero-{lang}.jpg" alt="{t['shot_alts'][0]}" width="520" height="1130"></div>
</div></section>
<section id="features"><div class="wrap"><h2>{t['feat_h']}</h2><p class="sub">{t['feat_sub']}</p><div class="grid">{feats}</div></div></section>
<section class="alt"><div class="wrap"><h2>{t['shots_h']}</h2><p class="sub"></p><div class="shots">{shots}</div></div></section>
<section id="plans"><div class="wrap"><h2>{t['plans_h']}</h2><p class="sub"></p>
<div class="plans">
<div class="plan"><h3>{t['free']}</h3><div class="price">{t['free_price']}</div><ul>{free}</ul></div>
<div class="plan pro"><h3>{t['pro']}</h3><div class="price">{t['pro_price']} <small>{t['pro_per']}</small></div><ul>{pro}</ul></div>
</div><p class="fine">{t['plans_fine']}</p></div></section>
<section class="alt"><div class="wrap"><h2>{t['faq_h']}</h2>{faq}</div></section>
</main>
""" + footer(lang)).replace("@DELETE@", PATHS["delete"][lang])


def document(lang, page, data):
    t = T[lang]
    d = data[lang]
    body = fill(d["body"], lang)
    return (head(lang, page, d["title"], d["desc"], PATHS[page][lang]) + header(lang, page) + f"""
<main id="main" class="doc"><div class="wrap">
<h1>{d['h1']}</h1>
<p class="updated">{d['updated_label']} {UPDATED[lang]}</p>
{body}
</div></main>
""" + footer(lang))


def main():
    pages = {"support": SUPPORT, "privacy": PRIVACY, "terms": TERMS, "delete": DELETE}
    for filename, page, lang in FILES:
        html = home(lang) if page == "home" else document(lang, page, pages[page])
        target = PUBLIC / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")
        print(filename)
    for filename, page, lang in FRAGMENTS:
        (PUBLIC / filename).write_text(fragment(lang, pages[page]), encoding="utf-8")
        print(filename, "(frammento per l'app)")


if __name__ == "__main__":
    main()
