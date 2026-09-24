# Jak wypuścić „Kto idzie?” – krok po kroku

Całość zajmuje ok. 30–45 minut. Na darmowym planie Cloudflare dla ~50 osób nie płacisz nic. Wszystkie komendy uruchamiasz w folderze projektu (`activity-registration-app-helper`).

**Potrzebujesz:** konta Cloudflare, Telegrama na telefonie i Node.js (już jest).

---

## 1. Konto Cloudflare

1. Załóż darmowe konto: <https://dash.cloudflare.com/sign-up>.
2. **Włącz R2** (na loga aktywności): w panelu wejdź w **R2 Object Storage** → **Enable R2 / Purchase R2 Plan**. Wybierz darmowy plan (10 GB za darmo).

> ⚠️ Cloudflare wymaga przy R2 podpięcia karty, choć przy naszym użyciu (kilkadziesiąt obrazków) nic nie pobierze. Jeśli nie chcesz podawać karty, daj znać: przerobię zdjęcia tak, żeby trzymały się w bazie D1 i R2 nie będzie potrzebne.

## 2. Zaloguj wranglera

```bash
npx wrangler login
```

Otworzy się przeglądarka. Kliknij **Allow**.

## 3. Utwórz bazę danych

```bash
npx wrangler d1 create kto-idzie
```

Wrangler wypisze `database_id` (UUID). Jeśli zapyta, czy dodać bazę do konfiguracji, odpowiedz **nie**. Zamiast tego otwórz [`wrangler.jsonc`](../wrangler.jsonc) i podmień:

```jsonc
"database_id": "00000000-0000-0000-0000-000000000000",
```

na swój UUID.

## 4. Utwórz miejsce na zdjęcia

```bash
npx wrangler r2 bucket create kto-idzie-photos
```

## 5. Załóż bota w Telegramie

1. Napisz do [@BotFather](https://t.me/BotFather): `/newbot`.
2. Nazwa: `Kto idzie?`
3. Username (musi kończyć się na `bot`), np. `ktoidzie_nyttars_bot`.
4. BotFather odeśle **token** w postaci `123456789:AAH...`. **Zachowaj go w tajemnicy**, nie wrzucaj do gita ani na czat.

## 6. Ustaw siebie jako organizatora

1. Napisz do [@userinfobot](https://t.me/userinfobot). Odpowie Twoim **ID**, np. `123456789`.
2. W [`wrangler.jsonc`](../wrangler.jsonc) wpisz je w `vars`:

```jsonc
"vars": {
  "DEV_AUTH": "0",
  "ORGANIZER_TELEGRAM_IDS": "123456789"
}
```

Kilka osób wpisujesz po przecinku: `"123,456"`. Kolejnych organizatorów możesz też dodać później w panelu aplikacji.

> `DEV_AUTH` **musi** zostać `"0"`, bo inaczej każdy mógłby wejść bez Telegrama.

## 7. Załóż tabele w bazie

```bash
npm run db:migrate:remote
```

Potwierdź `y`. Przy każdej migracji z folderu `migrations/` powinien pojawić się ✅.

## 8. Wdróż aplikację

```bash
npm run deploy
```

- Za pierwszym razem wrangler poprosi o wybranie subdomeny `workers.dev` (np. `twojanazwa`).
- Na końcu wypisze adres, np. **`https://kto-idzie.twojanazwa.workers.dev`**. Zapisz go.

## 9. Dodaj token bota

```bash
npx wrangler secret put BOT_TOKEN
```

Wklej token z kroku 5 i zatwierdź Enterem. Sekret działa od razu, bez ponownego wdrażania.

**Sprawdzenie:** otwórz adres z kroku 8 w zwykłej przeglądarce. Powinieneś zobaczyć logo i „Nie udało się połączyć. Otwórz aplikację z Telegrama”. To dobrze: poza Telegramem aplikacja nikogo nie wpuszcza.

## 10. Podłącz aplikację do bota

W [@BotFather](https://t.me/BotFather):

1. `/mybots` → wybierz bota → **Bot Settings** → **Configure Mini App** → **Enable Mini App** → wyślij adres z kroku 8.
2. (Opcjonalnie) `/mybots` → bot → **Bot Settings** → **Menu Button** → adres z kroku 8 i nazwa `Kto idzie?`. Wtedy w czacie z botem pojawi się przycisk otwierający aplikację.

Link do aplikacji to: **`https://t.me/<username_bota>?startapp`**, np. `https://t.me/ktoidzie_nyttars_bot?startapp`.

## 11. Przygotuj obóz (Ty jako organizator)

1. Otwórz link z kroku 10 na telefonie. Wybierz płeć i grupę wiekową.
2. Kliknij ⚙️ (panel organizatora):
   - **Obóz:** nazwa `Nyttårs camp 2026`, liczba dni i daty (28.12–1.01), daty startu (i opcjonalnie końca) zapisów dla U15/U18/O18. Kliknij Zapisz.
   - **Aktywności:** dodaj każdą z nazwą, krótkim opisem i logo (jeden kwadratowy obrazek).
   - **Oferty:** dla każdej aktywności wskaż, w które dni jest dostępna, dla kogo (chłopcy/dziewczyny, U15/U18/O18), limit miejsc i 🔥, jeśli jest na nią duże zainteresowanie. Kilka dni w jednej ofercie oznacza aktywność wielodniową.
3. Sprawdź dzień lub dwa jako uczestnik: dodaj coś do rankingu, przeciągnij, ustaw warunek.

## 12. Test z jedną osobą, potem ogłoszenie

1. Wyślij link jednemu znajomemu i poproś, żeby coś wybrał. Sprawdź, czy widzisz to u siebie (odświeża się co ~10 s).
2. Wrzuć link na grupę i **przypnij wiadomość**, np.:
   > 🗓️ **Kto idzie?** Zobacz, kto wybiera jakie aktywności na Nyttårs camp, zanim się zapiszesz: https://t.me/ktoidzie_nyttars_bot?startapp
3. W **Uczestnicy** poprawisz komuś płeć lub grupę wiekową albo usuniesz osobę spoza grupy.

---

## Później

| Co | Jak |
|----|-----|
| Wgrać nową wersję | `npm run deploy` (jeśli doszła nowa migracja, najpierw `npm run db:migrate:remote`) |
| Sprawdzić ruch i limity | panel Cloudflare → **Workers & Pages** → `kto-idzie` → Metrics, oraz **D1** → `kto-idzie` |
| Po obozie | ⚙️ → Obóz → **Zakończ obóz**: usuwa wybory, oferty i uczestników; aktywności ze zdjęciami zostają na kolejny raz |

## Gdy coś nie działa

- **W Telegramie widać „Nie udało się połączyć … 401”:** zły `BOT_TOKEN`. Powtórz krok 9 z tokenem od BotFathera (`/mybots` → bot → API Token).
- **Każdy dostaje „Nie udało się połączyć”:** sprawdź `npx wrangler secret list`. Musi tam być `BOT_TOKEN`. Token idzie **tylko** przez `secret put`, nigdy do `wrangler.jsonc`.
- **Nie widzisz ⚙️:** Twoje ID w `ORGANIZER_TELEGRAM_IDS` jest złe. Popraw je i zrób `npm run deploy`.
- **„Organizator jeszcze nie przygotował obozu”:** nie zapisałeś zakładki Obóz w panelu.
- **Błąd przy `deploy` o `database_id`:** nie podmieniłeś UUID w kroku 3.

## Limity darmowego planu (dla spokoju)

- **Workers:** 100 000 zapytań dziennie. Otwarta aplikacja robi 1 zapytanie na 10 s, więc 50 osób × 3 godziny to ok. 54 000.
- **D1:** 5 mln odczytów i 100 tys. zapisów dziennie. Co 10 s aplikacja sprawdza tylko numer wersji (1 wiersz), a pełny stan pobiera dopiero, gdy ktoś coś zmieni.
- **R2:** 10 GB. Logo jest ograniczone do 5 MB.
