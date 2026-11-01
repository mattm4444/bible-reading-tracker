# Bible Reading Tracker

A one-page Bible reading tracker for the home server. All 66 books show at once as tiles;
tap one to open its chapters. Tap a chapter to check it, or tap
"Mark whole book read" to check them all. It always opens to the book you were last in.
Progress is saved on the server and backed up to this repo, so it survives the server dying.

## Install on the server

    git clone https://github.com/mattm4444/bible-reading-tracker.git
    cd bible-reading-tracker
    cp .env.example .env        # then put your token in .env (below)
    docker compose up -d --build

Open `http://<server-ip>:8087` on the house Wi-Fi, or `http://<server's Tailscale name>:8087`
over Tailscale. On iPhone: open it in Safari, Share, Add to Home Screen.

## Backup (so a dead server doesn't lose your progress)

The server copies your progress to `backup/progress.json` in this repo about 10 minutes
after each change, plus once a day as a safety net. If `data/state.json` is missing when the
container starts (new server, wiped disk), it restores from that backup automatically.

It needs a token that can write to this one repo:

1. GitHub, Settings, Developer settings, Fine-grained tokens, Generate new token.
2. Repository access: **Only select repositories**, pick `bible-reading-tracker`.
3. Permissions: **Contents: Read and write**. Nothing else.
4. Set an expiration you'll remember (or none), copy the token into `.env` as `GITHUB_TOKEN`.
5. `docker compose up -d` to pick it up.

The page footer shows "backed up <time>" when it's working, or "GitHub backup failing" if the
token expired or the server can't reach GitHub. `docker logs bible-tracker` gives details.

`.env` and `data/` are git-ignored, so the token and the live file never get committed by hand.

## Rebuild after a server dies

Clone this repo on the new machine, recreate `.env`, `docker compose up -d --build`.
Progress comes back from `backup/progress.json` on first start.

## Firewall

Allow port 8087 from the house network and Tailscale, e.g. with ufw:

    sudo ufw allow from 192.168.1.0/24 to any port 8087 proto tcp
    sudo ufw allow in on tailscale0 to any port 8087 proto tcp

## Notes

- Each device also keeps a copy, so you can check chapters while the server is down; they
  upload when the page reaches it again.
- If two devices save different changes at the same time, the most recent save wins.
- Change the port: edit the left number of `"8087:8080"` in `compose.yaml`.
