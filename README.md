# The Very Hungry Caterpillar 🐛 — browser game

A small, kid-friendly browser game inspired by Eric Carle's picture book
[*The Very Hungry Caterpillar*](https://en.wikipedia.org/wiki/The_Very_Hungry_Caterpillar).
Steer the caterpillar snake-style through his week of eating, then watch him
build a cocoon and become a butterfly.

- **Monday** one apple · **Tuesday** two pears · **Wednesday** three plums ·
  **Thursday** four strawberries · **Friday** five oranges
- **Saturday** the big junk-food feast (chocolate cake, ice-cream cone, pickle,
  Swiss cheese, salami, lollipop, cherry pie, sausage, cupcake, watermelon) —
  the board gets wobblier with every bite, and that night he has a stomachache!
- **Sunday** one nice green leaf, then cocoon → butterfly 🦋

Eat only *today's* food. Wrong food or bumping into yourself costs one of three hearts.

## Play

Arrow keys / WASD, swipe on the board, or the on-screen d-pad on phones.
Space pauses. Three speeds: Gentle, Normal, Speedy.

## Share with a QR code

Tap the **📱** button (or the *Share QR code* button on the title screen, or
open `/?share`). The page renders a QR code of **its own URL**, so once it is
deployed the code always points at the live game. From there you can copy the
link, use the phone's share sheet, or **save the QR as a PNG** to print or put
on a slide.

## Run locally

```bash
npm start            # http://localhost:3000
PORT=8080 npm start  # any port you like
```

No dependencies and no build step: `server.js` is a tiny static file server
for the `public/` folder.

## Deploy to Railway

1. Create a new Railway project and choose **Deploy from GitHub repo** → this repository.
2. Railway detects Node from `package.json` and uses `railway.json`
   (`npm start`, health check at `/health`). Nothing else to configure.
3. Under **Settings → Networking**, click **Generate Domain**.
4. Open `https://<your-domain>.up.railway.app/?share` to see the QR code for the deployed game.

## Project layout

```
public/index.html   markup + styles
public/game.js      game logic, drawing, input, QR share modal
public/qrcode.js    vendored qrcode-generator (MIT, Kazuhiko Arase)
server.js           static server
railway.json        Railway deploy settings
```

A fan game; *The Very Hungry Caterpillar* is © Eric Carle.
