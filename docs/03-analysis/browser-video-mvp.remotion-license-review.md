# Remotion License Review

> **Feature**: browser-video-mvp
> **Gate**: Design §2.4 item 5 — commercial-use approval before deployment
> **Question asked**: 회사 라이선스가 아닌 개인 라이선스 기준으로 사용 가능한가
> **Date**: 2026-07-28
> **Status**: Reviewed. Free License does not cover the intended use. Currently
> covered by the evaluation clause. Decision: stay in evaluation, revisit before
> deployment.
> **Reviewer**: Claude Code, from Remotion's published terms. This is a reading
> of the public license text, not legal advice.

## 1. Question

The project uses `remotion`, `@remotion/media`, `@remotion/player`, and
`@remotion/web-renderer` at `4.0.499` to produce UA video for Superplanet. The
question was whether an individual license held by the developer is sufficient,
rather than a company license.

## 2. Sources

| Source | URL |
|--------|-----|
| License text | https://github.com/remotion-dev/remotion/blob/main/LICENSE.md (redirect target of remotion.dev/license) |
| Terms | https://www.remotion.dev/docs/license/terms |
| FAQ | https://www.remotion.dev/docs/license/faq |
| Licensing docs | https://www.remotion.dev/docs/licensing |

## 3. Free License Eligibility vs This Project

Free License applies to those who are:

| Published criterion | This project |
|---------------------|--------------|
| "an individual using the Remotion Software for **personal use**" | ❌ Output is company UA creative, not personal use |
| "an organization or team of individuals with **up to 3 people**" | ❌ Superplanet exceeds three personnel |
| "a non-profit or not-for-profit organization" | ❌ |
| "**evaluating** whether the Remotion Software is a good fit, and is **not yet using it in a commercial way**" | ✅ Current state: PoC and MVP only, nothing deployed or shipped |

## 4. Why an Individual License Does Not Transfer

Two clauses decide it.

> "The Company License must always be obtained by the owner of the Remotion
> project, which is the party that owns or controls the Remotion codebase."

The license holder must be the party owning the codebase. Once this tool is used
to produce company creative, the company is the project owner. A personal
license held by the developer does not satisfy the requirement.

> "the total number of personnel across all involved parties reaches the
> threshold of four or more"

Headcount is counted across all involved parties and explicitly includes
part-time employees and independent contractors, so the three-person ceiling is
not reachable here.

**Conclusion: 개인 라이선스로는 커버되지 않습니다.** The obligation attaches to the
company at the moment of commercial use, not to the individual who wrote the code.

## 5. Cost If a Company License Is Obtained

| Product | Price | Intended for |
|---------|-------|--------------|
| Remotion for Creators | **$25 per seat / month, no seat minimum** | Low-volume rendering within and for your own company. Matches this project. |
| Remotion for Automators | Render-volume based, mandatory telemetry from Remotion 5.0 | Products that render on behalf of external users. Not applicable. |
| Enterprise | $500 / month minimum, telemetry opt-out with monthly reports | Not applicable at this scale. |

One seat is roughly $300 per year. Purchasing is a company decision and was not
performed.

## 6. Current Position

The project is inside the evaluation clause today: no deployment, no shipped
creative, no production traffic. The existing Module 2 gate ("Company production
license: Blocked — do not deploy until approved") therefore stands unchanged and
is now backed by the specific clauses above rather than a general caution.

**Decision (user, 2026-07-28): remain in evaluation and revisit before deployment.**

## 7. Trigger Conditions

Obtain a Company License before any of these:

- [ ] Deploying the app to GitHub Pages or any shared internal URL
- [ ] Using a rendered MP4 in a live UA campaign
- [ ] Another team member using the tool
- [ ] Any use that is no longer plausibly "evaluating whether it is a good fit"

## 8. Contingency If the License Is Not Approved

Design Option C isolates Remotion behind adapters, so a swap does not reach the
domain or the editor UI.

| Layer | Impact of removing Remotion |
|-------|-----------------------------|
| `src/domain/**` | None |
| `src/features/editor/**` | None. Consumes the `VideoRenderer` port. |
| `src/app/App.tsx` | One line: inject a different renderer |
| `src/infrastructure/render/**` | Rewrite the adapter |
| `src/compositions/**` | Rewrite. Remotion `Sequence` and `Video` would be replaced by direct WebCodecs plus a canvas timeline. |
| Preview | Rewrite. `@remotion/player` would need a custom preview. |

The realistic alternative is WebCodecs plus `mediabunny` (already an indirect
dependency, MPL-2.0) driven by an own composition renderer. That removes the
license constraint but costs the preview/render parity that Design §1.1 goal 2
depends on. At $25 per seat per month, replacement is unlikely to be the
economical choice; this section exists so the option stays open, not because it
is recommended.

## 9. Deployment Readiness (2026-07-28)

Everything except this license is ready. The Pages subpath layout was verified
locally with the real production bundle — worker chunk, asset resolution, refresh,
and a real MP4 render — in `tests/e2e/pages-subpath.spec.ts`. The deploy workflow
exists and is manual-only.

The step-by-step path from license approval to a live URL is in
[docs/01-plan/pages-deployment-runbook.md](../01-plan/pages-deployment-runbook.md).

**Blocking owner: Superplanet (purchase decision). Not resolvable by the developer
or by tooling.**

## 10. Follow-up

- Remotion 5.0 changes telemetry behavior. Re-read the terms before upgrading
  past `4.0.499`.
- If a license is purchased, record the seat count and holder here and flip the
  Module 2 gate row to Approved.
