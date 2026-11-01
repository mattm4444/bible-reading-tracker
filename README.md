# Bible Reading Tracker

A one-page Bible reading tracker for the home server. All 66 books show at once as tiles;
tap one to open its chapters. Tap a chapter to check it, or tap
"Mark whole book read" to check them all. It always opens to the book you were last in.
Progress is saved on the server and backed up to a private GitHub repo of your own, so it
survives the server dying. Needs Docker; no other dependencies.

## Install on the server

    git clone https://github.com/mattm4444/bible-reading-tracker.git
    cd bible-reading-tracker
    cp .env.example .env        # then fill in .env (see Backup below)
    docker compose up -d --build

Open `http://<server-ip>:8087` on the house Wi-Fi, or `http://<server's Tailscale name>:8087`
over Tailscale. On iPhone: open it in Safari, Share, Add to Home Screen.

## Backup (so a dead server doesn't lose your progress)

The server copies your progress to `backup/progress.json` in a separate private repo about
10 minutes after each change, plus once a day as a safety net. If `data/state.json` is missing
when the container starts (new server, wiped disk), it restores from that backup automatically.
The backup is optional: leave `GITHUB_TOKEN` empty and progress stays on the server only.

1. On GitHub, create a new **private** repo for the backups, e.g. `bible-reading-progress`.
   It can be empty. Put `your-github-name/bible-reading-progress` in `.env` as `GITHUB_REPO`.
2. Settings, Developer settings, Fine-grained tokens, Generate new token.
3. Repository access: **Only select repositories**, pick that backup repo (not this one).
4. Permissions: **Contents: Read and write**. Nothing else.
5. Set an expiration you'll remember (or none), copy the token into `.env` as `GITHUB_TOKEN`.
6. `docker compose up -d` to pick it up.

The page footer shows "backed up <time>" when it's working, or "GitHub backup failing" if the
token expired or the server can't reach GitHub. `docker logs bible-tracker` gives details.

`.env` and `data/` are git-ignored, so the token and the live file never get committed by hand.

## Rebuild after a server dies

Clone this repo on the new machine, recreate `.env`, `docker compose up -d --build`.
Progress comes back from `backup/progress.json` in your backup repo on first start.

## Firewall

There's no login, so keep it off the internet. Allow port 8087 from the house network
(use your own subnet) and Tailscale, e.g. with ufw:

    sudo ufw allow from 192.168.1.0/24 to any port 8087 proto tcp
    sudo ufw allow in on tailscale0 to any port 8087 proto tcp

## Notes

- Each device also keeps a copy, so you can check chapters while the server is down; they
  upload when the page reaches it again.
- If two devices save different changes at the same time, the most recent save wins.
- Change the port: edit the left number of `"8087:8080"` in `compose.yaml`.
