import * as React from "react";
import * as UI from './ui'

const dateFmtOpts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
export function formatDate (date :Date) :string {
  const locale = "en-US" // TODO: use browser locale?
  return date.toLocaleDateString(locale, dateFmtOpts)
}

export function menuButton (key :string, icon :JSX.Element, onClick :() => void) :JSX.Element {
  return <UI.IconButton key={key} color="inherit" aria-label="Menu" onClick={onClick}>
    {icon}
  </UI.IconButton>
}
