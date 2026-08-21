# DSH Superpowers Zh

[Superpowers-zh](https://github.com/jnMetaCode/superpowers-zh) core engineering skills packaged for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Install

```sh
dsh plugin --profile web add dsh-superpowers-zh
```

Restart the DSH Web service after installation. The bundle registers `brainstorming`, `writing-plans`, `executing-plans`, `systematic-debugging`, `test-driven-development`, `requesting-code-review`, `receiving-code-review`, and `verification-before-completion`.

## Scope

This is a thin DSH adapter. It ships only the eight listed upstream Markdown skills and does not include Pi-specific extensions, workflow runners, credentials, or local configuration.

## Attribution and license

The skills are copied from [jnMetaCode/superpowers-zh](https://github.com/jnMetaCode/superpowers-zh), licensed under MIT. `UPSTREAM-LICENSE` preserves the upstream license text. This adapter is also MIT licensed.
