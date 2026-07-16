# TODO — app.js sadalīšana mazākos failos

Šis fails seko līdzi, cik tālu esam ar `app.js` sadalīšanu mazākos, vieglāk uzturamos `panels/*.js` failos. Sīkāk par to, **kāpēc** šis darbs notiek un **kā** tas tiek darīts (solis pa solim), skaties `CLAUDE.md` sadaļā "Splitting app.js into smaller files".

**Svarīgi:** šī sadalīšana nepadara lietotni ātrāku — tā tikai sakārto kodu, lai to būtu vieglāk un drošāk labot. Ja meklē ātruma uzlabojumus, tas ir cits, vēl nesākts darbs.

## Izdarīts

- ✅ `panels/self-tests.js`
- ✅ `panels/polar-tests.js`
- ✅ `panels/health-journal.js`
- ✅ `panels/lab-tests.js`
- ✅ `panels/restrictions.js`
- ✅ `panels/races.js` — **daļēji**: pati sacensību loģika (dialogi, saglabāšana, saraksts) izdalīta, bet divas mazas daļas, kas ir iebūvētas kalendāra pamatkodā (sacensību "čipiņu" attēlošana dienas ailē + klikšķu apstrāde koplietotā notikumu klausītājā), apzināti atstātas `app.js` — tās skar visbiežāk lietoto kalendāra kodu, tāpēc risks pārsniedz ieguvumu. Sīkāk — CLAUDE.md.
- ✅ `panels/diary.js`
- ✅ `panels/records.js`
- ✅ `panels/admin.js` (sportistu izveide/dzēšana, paroles atiestatīšana)
- ✅ `panels/profile.js` (profils, HR zonas, slieksni, temps-pulss tabula) — pilnībā izdalīts. Blakus atrastas un **izdzēstas** divas nevajadzīgas koda daļas: viena funkcija dublēja rekordu ielādi (liekas datu pieprasījums pie katras sportista maiņas), otra bija pilnībā nelietota "miris kods" no laika, kad Rekordu panelis vēl nebija pārtaisīts. Sīkāk — CLAUDE.md.
- ✅ `panels/stats.js` (nedēļas/mēneša slodzes grafiki) — pilnībā izdalīts. Blakus atrasti un **izdzēsti** trīs vēl lielāki nevajadzīgi datu pieprasījumi — pie katras nedēļas/sportista maiņas lietotne pieprasīja no servera trīs datu kopas ("nedēļas statistika", "mēneša km", "mēneša minūtes"), kuras nekur ekrānā netika parādītas, tikai izmestas. Sīkāk — CLAUDE.md.
- ✅ `panels/interval-history.js` (intervālu vēstures cilnes) — pilnībā izdalīts, vienkāršākā izdalīšana līdz šim (tas bija pati `app.js` faila beigu daļa). Nekas nevajadzīgs blakus netika atrasts.

`app.js` samazinājies no ~5800 līdz ~3420 rindām.

## Varētu vēl paskatīties

Visi šī saraksta kandidāti ir izdarīti. Kad būs vēlme turpināt tālāk, vajadzēs vispirms no jauna izpētīt `app.js` atlikušo daļu un atrast nākamo izolēto kandidātu — sk. "Nākamais solis" zemāk.

## Paliek `app.js` "kodolā" — nav plānots izdalīt

Šīs daļas ir pats lietotnes pamats un pārāk cieši savītas savā starpā, lai tās droši varētu pārvietot atsevišķā failā:

- Kalendāra/nedēļas/mēneša skata renderēšana (`renderCalendar`, `renderMonthViewInline`)
- Treniņu plānu ģenerēšana un šabloni (custom builder, intervālu loģika)
- Treniņa izpildījuma ("log") dialogi
- Divas ar sacensībām saistītas daļas, kas iebūvētas kalendāra kodā (skat. augstāk pie Races)

## Nākamais solis

Visi zināmie ērti izdalāmie paneļi tagad ir izdalīti (9 paneļi kopš 2026-07-14, `app.js` samazinājies gandrīz uz pusi — no ~5800 līdz ~3420 rindām). Atlikusī `app.js` daļa lielākoties ir kalendāra/treniņu-plānu "kodols" — pats lietotnes pamats, kas nav droši atdalāms bez lielāka riska (sk. augstāk). Kad būs vēlme turpināt, pasaki — vispirms no jauna izpētīšu, vai atlikušajā app.js daļā ir kāds jauns, pietiekami izolēts kandidāts, pirms sāku faktisko pārvietošanu.
