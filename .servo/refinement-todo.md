# Refinement TODO

Open decisions servo couldn't infer from your project. Each has a resolution trigger — the moment in your workflow when you'll know enough to close it. Mirrors jig's refinement-todo format.

---

## Threshold

**Deferred:** default `THRESHOLD=0.5` chosen by servo without project-specific data.

**Resolution trigger:** first time the oracle gate misfires — edit the `THRESHOLD` default at the top of `oracle.sh` to match observed quality.

