# dgx OpenClaw operator notes

## Source of truth

- Repo checkout: `/home/trent/src/openclaw`
- Current remotes on this host:
  - `origin` = `gh:openclaw/openclaw`
  - `tpn` = `gh:tpn/openclaw`
- Running gateway service:
  - unit: `~/.config/systemd/user/openclaw-gateway.service`
  - current ExecStart: `/home/trent/mambaforge/envs/openclaw/bin/node /home/trent/mambaforge/envs/openclaw/lib/node_modules/openclaw/dist/index.js gateway --port 18789`

Do not patch hashed `dist/*.js` files in place on live hosts. Make changes in source, rebuild, and redeploy.

## Sync workflow

Current host layout keeps upstream on `origin` and the fork on `tpn`. For future hosts, prefer the more standard layout:

- `origin` = `gh:tpn/openclaw`
- `upstream` = `gh:openclaw/openclaw`

Recommended flow for fork-only fixes:

1. Commit the fix in the repo checkout.
2. Push that commit to `tpn` on a dedicated branch or tag.
3. On each host, fetch both remotes and deploy the exact branch/tag you want.
4. Periodically rebase or merge upstream `openclaw/openclaw` into the fork branch, then redeploy with the same script below.

## Build and install

Use the tracked deploy script from the repo root:

```bash
OPENCLAW_INSTALL_NPM=/home/trent/mambaforge/envs/openclaw/bin/npm \
OPENCLAW_GLOBAL_PREFIX=/home/trent/mambaforge/envs/openclaw \
./scripts/deploy-source-build.sh
```

What it does:

1. Installs repo dependencies with the pinned `pnpm` version from `package.json`.
2. Runs the normal `pnpm build`.
3. Creates an `npm pack` tarball under `.artifacts/source-builds/`.
4. Installs that tarball into the explicit `openclaw` conda prefix the gateway service already uses.

## Restart

After a successful install:

```bash
systemctl --user restart openclaw-gateway.service
```

## Verify

Service health:

```bash
systemctl --user status openclaw-gateway.service --no-pager
openclaw channels status --probe
```

Verify the source fix:

```bash
rg -n 'const slackTo = `channel:|to: `channel:|const replyTarget = isDirectMessage' src/slack/monitor/message-handler/prepare.ts
```

Verify the installed build also contains it:

```bash
rg -n 'const slackTo = `channel:|to: `channel:|const replyTarget = isDirectMessage' /home/trent/mambaforge/envs/openclaw/lib/node_modules/openclaw/dist
```

Run the focused regression tests when touching Slack reply routing:

```bash
./node_modules/.bin/vitest run \
  src/slack/monitor/message-handler/prepare.test.ts \
  src/slack/monitor/message-handler/prepare.thread-session-key.test.ts
```
