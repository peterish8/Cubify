import type { ReactNode } from "react"

type Language = "json" | "http"

function JsonLine({ line }: { line: string }) {
  const parts = line.split(/("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g)
  return <>{parts.map((part, index) => {
    if (!part) return null
    if (/^"(?:\\.|[^"\\])*"$/.test(part)) {
      const rest = line.slice(line.indexOf(part) + part.length)
      return <span key={index} className={/^\s*:/.test(rest) ? "docs-code-key" : "docs-code-string"}>{part}</span>
    }
    if (/^-?\d+(?:\.\d+)?$/.test(part)) return <span key={index} className="docs-code-number">{part}</span>
    if (/^(true|false|null)$/.test(part)) return <span key={index} className="docs-code-literal">{part}</span>
    return <span key={index}>{part}</span>
  })}</>
}

function HttpLine({ line }: { line: string }) {
  const request = line.match(/^(GET|POST)\s+(.+)$/)
  if (request) return <><span className="docs-code-method">{request[1]}</span><span> </span><span className="docs-code-path">{request[2]}</span></>
  const header = line.match(/^([A-Za-z-]+):\s*(.+)$/)
  if (header) return <><span className="docs-code-header">{header[1]}</span><span>: </span><span className="docs-code-string">{header[2]}</span></>
  return <JsonLine line={line} />
}

function Lines({ code, language }: { code: string; language: Language }) {
  return <>{code.split("\n").map((line, index): ReactNode => <span className="docs-code-line" key={`${index}-${line}`}><span className="docs-code-line-number" aria-hidden="true">{String(index + 1).padStart(2, " ")}</span><span className="docs-code-line-content">{language === "http" ? <HttpLine line={line} /> : <JsonLine line={line} />}</span>{"\n"}</span>)}</>
}

export function VsCodeBlock({ code, language, fileName, className = "" }: { code: string; language: Language; fileName?: string; className?: string }) {
  return <div className={`docs-vscode-shell ${className}`}><div className="docs-vscode-window"><div className="docs-vscode-bar"><span className="docs-code-dot bg-[#ff5f57]" /><span className="docs-code-dot bg-[#febc2e]" /><span className="docs-code-dot bg-[#28c840]" /><span className="docs-vscode-file">{fileName ?? (language === "json" ? "response.json" : "request.http")}</span><span className="docs-vscode-language">{language}</span></div><pre><code><Lines code={code} language={language} /></code></pre></div></div>
}
