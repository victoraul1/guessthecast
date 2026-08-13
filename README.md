# Guess the Cast — Swipe Edition

A mobile-first movie trivia game powered by TMDB. Players decide whether the actor shown appeared in the named movie. Swipe right for **yes**, swipe left for **no**, or use the matching buttons/arrow keys.

## Game rules

- Every round pairs one movie with one actor.
- Players can switch between Movies and TV Shows from the compact top navigation.
- Each pool cycle loads up to 200 popular movies and 200 popular actors from TMDB.
- A correct answer grows the current streak by one.
- A wrong answer resets the streak to zero.
- A streak of 20 unlocks username submission to the **20 Club** winners table.
- Movie titles, release years, cast membership, and actor portraits come from TMDB.

## Files

```text
index.html             App shell and dialogs
css/styles.css         Responsive visual system and card interactions
js/config.js           TMDB credentials and game tuning
js/script.js           TMDB loading, challenge logic, swipes, and game state
js/leaderboard.js      Same-origin winners API client
js/analytics.js        Consent-first Google Analytics loader and events
api/winners.php        PHP/MySQL JSON API
api/config.php         Server-side database connection settings
api/config.example.php Safe template for deployment configuration
guessthecast.sql       MySQL winners-table schema
```

## Run locally

This app must be served over HTTP rather than opened directly from the filesystem.

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/`.

## Controls

- Drag/swipe the actor card left or right.
- Tap the red X or green check buttons.
- On a keyboard, use the left and right arrow keys.

## Services

The browser app reads TMDB using the credentials in `js/config.js`. Winners are stored in MySQL through `api/winners.php`. Database credentials stay in the server-executed `api/config.php`, which is blocked from direct HTTP access by `api/.htaccess`.

For a new deployment, copy `api/config.example.php` to `api/config.php` and enter the hosting database credentials. The real configuration is ignored by Git and must be uploaded to Netfirms separately.

Google Analytics remains unloaded until the visitor accepts analytics in the cookie banner. The footer's Cookie settings control lets visitors revisit and change that choice.

The API creates the `winners` table automatically on its first successful database connection. `guessthecast.sql` is also included for manual administration or backup. Production hosting must run PHP with the PDO MySQL extension enabled.

This product uses the TMDB API but is not endorsed or certified by TMDB.
