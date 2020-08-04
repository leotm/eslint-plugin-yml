import path from "path"
import fs from "fs"
import { rules } from "../src/utils/rules"
import type { RuleModule } from "../src/types"

//eslint-disable-next-line require-jsdoc
function formatItems(items: string[]) {
    if (items.length <= 2) {
        return items.join(" and ")
    }
    return `all of ${items.slice(0, -1).join(", ")} and ${
        items[items.length - 1]
    }`
}

//eslint-disable-next-line require-jsdoc
function yamlValue(val: any) {
    if (typeof val === "string") {
        return `"${val.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`
    }
    return val
}

const ROOT = path.resolve(__dirname, "../docs/rules")

class DocFile {
    private rule: RuleModule
    private filePath: string
    private content: string
    public constructor(rule: RuleModule) {
        this.rule = rule
        this.filePath = path.join(ROOT, `${rule.meta.docs.ruleName}.md`)
        this.content = fs.readFileSync(this.filePath, "utf8")
    }

    public static read(rule: RuleModule) {
        return new DocFile(rule)
    }

    public updateHeader() {
        const {
            meta: {
                fixable,
                deprecated,
                docs: { ruleId, description, categories, replacedBy },
            },
        } = this.rule
        const title = `# ${ruleId}\n\n> ${description}`
        const notes = []

        if (deprecated) {
            if (replacedBy) {
                const replacedRules = replacedBy.map(
                    (name) => `[yml/${name}](${name}.md) rule`,
                )
                notes.push(
                    `- :warning: This rule was **deprecated** and replaced by ${formatItems(
                        replacedRules,
                    )}.`,
                )
            } else {
                notes.push("- :warning: This rule was **deprecated**.")
            }
        } else {
            if (categories) {
                const presets = []
                // eslint-disable-next-line @mysticatea/ts/require-array-sort-compare
                for (const cat of categories.sort()) {
                    presets.push(`\`"plugin:yml/${cat}"\``)
                }
                notes.push(
                    `- :gear: This rule is included in ${formatItems(
                        presets,
                    )}.`,
                )
            }
        }
        if (fixable) {
            notes.push(
                "- :wrench: The `--fix` option on the [command line](https://eslint.org/docs/user-guide/command-line-interface#fixing-problems) can automatically fix some of the problems reported by this rule.",
            )
        }

        // Add an empty line after notes.
        if (notes.length >= 1) {
            notes.push("", "")
        }

        const headerPattern = /#.+\n+[^\n]*\n+(?:- .+\n+)*\n*/u

        const header = `${title}\n\n${notes.join("\n")}`
        if (headerPattern.test(this.content)) {
            this.content = this.content.replace(headerPattern, header)
        } else {
            this.content = `${header}${this.content.trim()}\n`
        }

        return this
    }

    public updateFooter() {
        const { ruleName } = this.rule.meta.docs
        const footerPattern = /## Implementation[\s\S]+$/u
        const footer = `## Implementation

- [Rule source](https://github.com/ota-meshi/eslint-plugin-yml/blob/master/src/rules/${ruleName}.ts)
- [Test source](https://github.com/ota-meshi/eslint-plugin-yml/blob/master/tests/src/rules/${ruleName}.js)
${
    this.rule.meta.docs.extensionRule
        ? `
<sup>Taken with ❤️ [from ESLint core](https://eslint.org/docs/rules/${ruleName})</sup>
`
        : ""
}`
        if (footerPattern.test(this.content)) {
            this.content = this.content.replace(footerPattern, footer)
        } else {
            this.content = `${this.content.trim()}\n\n${footer}`
        }

        return this
    }

    public updateCodeBlocks() {
        const { meta } = this.rule

        this.content = this.content.replace(
            /<eslint-code-block(.*?)>/gu,
            (_t, str) => {
                const ps = str
                    .split(/\s+/u)
                    .map((s: string) => s.trim())
                    .filter((s: string) => s && s !== "fix")
                if (meta.fixable) {
                    ps.unshift("fix")
                }
                ps.unshift("<eslint-code-block")
                return `${ps.join(" ")}>`
            },
        )
        return this
    }

    public adjustCodeBlocks() {
        // Adjust the necessary blank lines before and after the code block so that GitHub can recognize `.md`.
        this.content = this.content.replace(
            /(<eslint-code-block([\s\S]*?)>)\n+```/gmu,
            "$1\n\n```",
        )
        this.content = this.content.replace(
            /```\n+<\/eslint-code-block>/gmu,
            "```\n\n</eslint-code-block>",
        )
        return this
    }

    public updateFileIntro() {
        const { ruleId, description } = this.rule.meta.docs

        const fileIntro = {
            pageClass: "rule-details",
            sidebarDepth: 0,
            title: ruleId,
            description,
        }
        const computed = `---\n${Object.keys(fileIntro)
            .map((key) => `${key}: ${yamlValue((fileIntro as any)[key])}`)
            .join("\n")}\n---\n`

        const fileIntroPattern = /^---\n(.*\n)+---\n*/gu

        if (fileIntroPattern.test(this.content)) {
            this.content = this.content.replace(fileIntroPattern, computed)
        } else {
            this.content = `${computed}${this.content.trim()}\n`
        }

        return this
    }

    public write() {
        // eslint-disable-next-line @mysticatea/ts/no-require-imports
        const isWin = require("os").platform().startsWith("win")

        this.content = this.content.replace(/\r?\n/gu, isWin ? "\r\n" : "\n")

        fs.writeFileSync(this.filePath, this.content)
    }
}

for (const rule of rules) {
    DocFile.read(rule)
        .updateHeader()
        .updateFooter()
        .updateCodeBlocks()
        .updateFileIntro()
        .adjustCodeBlocks()
        .write()
}