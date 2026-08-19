// Read-layer live-tail splice (spec 014, slice 014-02, AC4). The RAG chip's
// real lever is the LATEST observation's timestamp: `deriveForecast` reads
// `spanDays` and `daysToDeadline` off `latest.collectedAt` (src/derive.mjs).
// A stalled project accrues no new captures, so its newest STORED record keeps
// an old timestamp → a false `on_track`. Fix in the read layer (never in the
// pure fold): splice the server's live `observeAll` observation (current state,
// `collectedAt` = now, freshness recomputed at request time) as the TAIL of the
// stored series before `deriveForecast`. `latest` then reflects now, and Gate 2
// splits the outcome honestly — a fresh-but-flat project reaches the pace fold
// (`at_risk`), a quiet project short-circuits to `unknown('stale-evidence')` —
// never a false `on_track` off a frozen latest, and never coerced.
//
// ALWAYS appends (spec AC4 + edge case): when the live observation's state
// equals the newest stored record, it is NOT skipped — appending the
// equal-value tail is the desired timestamp advance, not a double-count (pace
// is endpoint-based / density-invariant, so the extra flat point changes no
// pace, only extends the span with a `now` endpoint). A literal "skip when
// equal" would reintroduce the frozen-latest false `on_track` this exists to
// kill. `deriveForecast` stays pure and `now`-free (ADR-0006); the request
// clock lives here, in the read layer that already ran `observeAll`.
export function spliceLiveObservation(storedObservations, liveObservation) {
  const stored = storedObservations || [];
  if (!liveObservation) return stored;
  return [...stored, liveObservation];
}
