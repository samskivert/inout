import * as React from "react";
import * as UI from './ui'

//
// Date stuff

const pad = (value :number) => (value < 10) ? `0${value}` : `${value}`

// a date-stamp: yyyy-mm-dd
export type Stamp = string

export function toStamp (date :Date) :Stamp {
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
}

const stampRE = /^([0-9]+)-([0-9]+)-([0-9]+)$/

export function fromStamp (stamp :Stamp) :Date|void {
  let comps = stampRE.exec(stamp)
  if (comps && comps.length === 4) {
    let year = parseInt(comps[1])
    let month = parseInt(comps[2])-1
    let day = parseInt(comps[3])
    return new Date(year, month, day)
  }
}

const dateFmtOpts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
export function formatDate (date :Date) :string {
  const locale = "en-US" // TODO: use browser locale?
  return date.toLocaleDateString(locale, dateFmtOpts)
}

//
// UI stuff

export function menuButton (key :string, icon :JSX.Element, onClick :() => void) :JSX.Element {
  return <UI.IconButton key={key} color="inherit" aria-label="Menu" onClick={onClick}>
    {icon}
  </UI.IconButton>
}
