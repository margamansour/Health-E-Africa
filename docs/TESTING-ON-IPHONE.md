# Testing on an iPhone with a USB-C cable (Windows laptop)

The app runs on your laptop and opens in Safari on the iPhone, over the cable. Changes you make
on the laptop show on the phone straight away.

It works through the iPhone's **Personal Hotspot over USB**: the cable puts the laptop and the
phone on a small private network, so the phone can reach the laptop. No Wi-Fi network is needed,
and no data is used for this traffic.

> An iPad can't do this job: it can't run the app's development server. To use the iPad, open the
> published demo link in Safari instead.

## One-time setup on the laptop

1. Install **Node.js 22 LTS** from https://nodejs.org (tick "Add to PATH").
2. Install **Git** from https://git-scm.com.
3. Install **Apple Devices** from the Microsoft Store (or iTunes). It provides the driver that
   lets Windows use the iPhone's hotspot over USB.
4. Open **PowerShell** and get the app:

   ```powershell
   git clone https://github.com/margamansour/Health-E-Africa.git
   cd Health-E-Africa
   git checkout claude/health-e-africa-architecture-2eu28f
   cd apps\patient
   npm install
   ```

5. Allow the phone to reach the app through Windows Firewall. Open **PowerShell as administrator**
   (right-click → Run as administrator) and run:

   ```powershell
   New-NetFirewallRule -DisplayName "Health-e Africa (phone testing)" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
   ```

## Each time you test

1. **iPhone:** Settings → Personal Hotspot → turn on **Allow Others to Join**.
   (Your mobile plan must include hotspot. Leave the iPhone's Wi-Fi as it is.)
2. **Plug the iPhone into the ThinkPad** with the USB-C cable. On the iPhone, tap **Trust** and
   enter your passcode if asked. The hotspot bar at the top of the iPhone turns green or shows
   "1 connection".
3. **Laptop:** in PowerShell, in the `Health-E-Africa\apps\patient` folder, run:

   ```powershell
   npm run phone
   ```

   It prints addresses like this:

   ```
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://192.168.1.20:5173/
   ➜  Network: http://172.20.10.2:5173/
   ```

   Use the one starting **172.20.10.** — that's the cable connection.
4. **iPhone:** open **Safari** and type that address, e.g. `http://172.20.10.2:5173`.
5. Optional: tap Share → **Add to Home Screen** to open it like an app.

Leave PowerShell open while you test. Press `Ctrl + C` in it to stop.

## Seeing errors on the phone

Safari's developer tools need a Mac. Instead, add `?debug` to the address
(`http://172.20.10.2:5173/?debug`). A small gear button appears; tap it for a console showing
errors, network requests and stored data. This only works in testing, never in the published app.

## If it doesn't work

| Problem | Fix |
|---|---|
| No `172.20.10.` address is printed | Unplug and replug the cable; turn Personal Hotspot off and on; check Apple Devices is installed; then run `npm run phone` again. |
| Safari says it can't connect | The firewall rule (step 5 of the one-time setup) is missing, or the laptop treats the iPhone network as "Public" and blocks it. Run the firewall command again as administrator. |
| "Port 5173 is in use" | Another copy is running. Close the other PowerShell window, or restart the laptop. |
| Old version showing | Pull the latest changes: `git pull`, then `npm install`, then `npm run phone`. |
| Data from an earlier test is still there | Each address keeps its own data. More → Settings → Close account in the app, or in iPhone Settings → Apps → Safari → Advanced → Website Data, remove the entry for 172.20.10.2. |

## Notes

- Everything you enter stays in Safari on the phone (demo mode); nothing is sent to the laptop
  or anywhere else.
- "Take photo" opens the iPhone camera through the file picker, which works over this connection.
- The published demo link and the single offline file are still the easiest way to show the app
  to others; this setup is for testing changes as you make them.
