# dgx OpenClaw operator notes

## Source of truth

- Repo checkout: `/home/trent/src/openclaw`
- Current remotes on this host:
  - `origin` = `gh:tpn/openclaw`
  - `upstream` = `gh:openclaw/openclaw`
- Running gateway service:
  - unit: `~/.config/systemd/user/openclaw-gateway.service`
  - current ExecStart: `/home/trent/mambaforge/envs/openclaw/bin/node /home/trent/mambaforge/envs/openclaw/lib/node_modules/openclaw/dist/index.js gateway --port 18789`
- Slack DM owner allowlist on this host should use Trent's stable Slack user ID:
  - `channels.slack.allowFrom: ["U035G8BHXNU"]`

Do not patch hashed `dist/*.js` files in place on live hosts. Make changes in source, rebuild, and redeploy.

## Sync workflow

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
3. Runs `pnpm ui:build` so the packaged install includes `dist/control-ui`.
4. Creates an `npm pack` tarball under `${TMPDIR:-/tmp}/openclaw-source-builds/` unless `OPENCLAW_PACK_DIR` overrides it.
5. Installs that tarball into the explicit `openclaw` conda prefix the gateway service already uses.
   - The install step rewrites GitHub SSH dependency URLs to HTTPS for that command so hosts without GitHub SSH keys can still install public git-backed npm dependencies cleanly.

## Reinstall the service cleanly

After a successful package install, reinstall the user service via the `openclaw`
env's `node` so the unit keeps pointing at that env even if another `node` is
earlier on `PATH`:

```bash
/home/trent/mambaforge/envs/openclaw/bin/node \
  /home/trent/mambaforge/envs/openclaw/lib/node_modules/openclaw/openclaw.mjs \
  gateway install --force
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
