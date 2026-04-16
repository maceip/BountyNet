# Axolotl Dataset Placeholders

Place specialist training corpora here as JSONL chat samples:

- `rust-sentinel-train.jsonl`
- `typescript-auditor-train.jsonl`
- `specialist-train.jsonl`

Suggested row shape:

```json
{"messages":[{"role":"system","content":"You are Rust Sentinel..."},{"role":"user","content":"Patch this Cargo vulnerability..."},{"role":"assistant","content":"..."}]}
```

Keep these datasets out of git if they contain proprietary code snippets.
