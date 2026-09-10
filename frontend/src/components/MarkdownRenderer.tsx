import React from 'react'

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Simple, safe lightweight markdown parser
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLang = ''

  const renderInline = (text: string): React.ReactNode => {
    // Process inline code, bold, italic, links
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0

    // Tokenize patterns: `code`, **bold**, *italic*, [link](url)
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
    let match: RegExpExecArray | null
    let lastIndex = 0

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      const token = match[0]
      if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={key++}
            style={{
              background: 'var(--color-surface)',
              padding: '0.15rem 0.35rem',
              borderRadius: '0.25rem',
              fontSize: '0.85em',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {token.slice(1, -1)}
          </code>
        )
      } else if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(<strong key={key++} style={{ fontWeight: 600, color: 'var(--color-text)' }}>{token.slice(2, -2)}</strong>)
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(<em key={key++}>{token.slice(1, -1)}</em>)
      } else if (token.startsWith('[') && token.includes('](')) {
        const linkText = token.slice(1, token.indexOf(']('))
        const linkUrl = token.slice(token.indexOf('](') + 2, -1)
        parts.push(
          <a
            key={key++}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
          >
            {linkText}
          </a>
        )
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.slice(3).trim()
        codeBlockContent = []
      } else {
        inCodeBlock = false
        elements.push(
          <div
            key={`code-${i}`}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              margin: '0.5rem 0',
              overflowX: 'auto',
            }}
          >
            {codeBlockLang && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                {codeBlockLang}
              </div>
            )}
            <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text)' }}>
              {codeBlockContent.join('\n')}
            </pre>
          </div>
        )
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', margin: '0.75rem 0 0.25rem' }}>
          {renderInline(line.slice(4))}
        </h3>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: '1rem 0 0.25rem' }}>
          {renderInline(line.slice(3))}
        </h2>
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', margin: '1.25rem 0 0.5rem' }}>
          {renderInline(line.slice(2))}
        </h1>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '0.5rem', margin: '0.25rem 0 0.25rem 0.5rem' }}>
          <span style={{ color: 'var(--color-primary)' }}>•</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{renderInline(line.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/)
      if (match) {
        elements.push(
          <div key={i} style={{ display: 'flex', gap: '0.5rem', margin: '0.25rem 0 0.25rem 0.5rem' }}>
            <span style={{ color: 'var(--color-primary)', fontWeight: 600, minWidth: '1.2rem' }}>{match[1]}.</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{renderInline(match[2])}</span>
          </div>
        )
      }
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '0.5rem' }} />)
    } else {
      elements.push(
        <p key={i} style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6, margin: '0.25rem 0' }}>
          {renderInline(line)}
        </p>
      )
    }
  }

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>
}
