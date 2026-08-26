# M1 verification scripts

This container has no H.264 encoder or decoder, so `npx playwright test` cannot
run: every spec that renders an MP4 fails at the capability gate, and the repo's
H.264 fixtures cannot even be decoded. See
`docs/03-analysis/day1-quad.m0-perf-gate.md` §1.

The editor UI itself does not need the encoder, so these two scripts verify the
parts of M1 that are observable without a render. They are a stopgap for this
environment — the real coverage is the E2E suite on a machine with Chrome.

```bash
npm run dev -- --host 127.0.0.1 --port 4173     # in another shell
node artifacts/m1/verify-dropdown.mjs           # M1-3, and Design D-2's claim
node artifacts/m1/verify-endcard-length.mjs     # M1-1 in the inspector
```

`verify-endcard-length.mjs` needs the VP9 sources from the M0 spike
(`node artifacts/m0/make-sources.mjs`), because it uploads one as the end-card
video and this browser cannot decode H.264.
