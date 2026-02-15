import { ReactNode } from 'react'
import './app.css'

type Props = {
  sidebar: ReactNode
  main: ReactNode
  details: ReactNode
  themeClass: 'theme-dark' | 'theme-light'
  titlebar?: ReactNode
}

export function AppShell({ sidebar, main, details, titlebar, themeClass }: Props) {
  return (
    <div className={`window ${themeClass}`}>
      {titlebar}
      <div className="app-shell">
        <aside className="sidebar">{sidebar}</aside>
        <main className="main">{main}</main>
        <section className="details scroll-container hide-scrollbar">{details}</section>
      </div>
    </div>
  )
}
