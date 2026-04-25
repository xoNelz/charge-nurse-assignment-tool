# Charge Nurse Assignment Tool (ChargeDeck)

**Live App:** https://xonelz.github.io/charge-nurse-assignment-tool

A clinical decision-support web application that helps charge 
nurses build safe, balanced patient assignments at the start 
of every shift. Built by a charge nurse, for charge nurses.

## The Problem
Charge nurses manually distribute patients across nursing staff 
using experience, memory, and instinct, with no real-time safety 
checks. A single bad assignment can overload a nurse, create 
dangerous medication conflicts, or leave one nurse with all the 
most complex patients.

## The Solution
An interactive drag-and-drop assignment board that flags rule 
violations in real time as assignments are built on both 
desktop and mobile. Features smart auto-assignment with 
geographic clustering, report continuity optimization, and 
returning nurse continuity. Saves automatically so no work 
is ever lost.

## User Flow
1. **Setup Screen** — Select shift type, number of nurses, occupied rooms
2. **Outgoing Assignment Screen** — Optionally enter previous shift's 
   final assignments to improve report continuity
3. **Assignment Board** — Drag and drop, flag patients, auto-assign, 
   review and print
4. **Restore Session** — On reload, restore your last saved board 
   instantly or start fresh

## Features
- Day / Night shift mode with shift-aware clinical rules
- Room selection grid for all 29 occupied beds
- Drag and drop patient cards into nurse slots (desktop + mobile)
- Long press any patient card to add clinical flags
- Hover over any card to see active flags at a glance
- Real-time violation warnings and advisories on nurse slots
- Editable nurse names on the board
- Returning nurse toggle with room continuity
- Outgoing shift assignment entry for report continuity
- Auto-assign with geographic clustering, report continuity 
  and fairness balancing
- Clear Assignment to reset and start over
- Reset Flags — clear all flags globally or per patient
- Color-coded flag legend — collapsible horizontal drawer
- localStorage auto-save — board survives refresh or accidental close
- Restore Session banner on reload
- Back to Outgoing button — edit previous shift data without losing board
- Print assignment sheet as a clean one-page table

## Clinical Rules Engine
The app enforces these assignment safety rules in real time:

**Hard violations (red):**
- Max 4 patients per nurse
- Trach patients reduce max to 3 on day shift
- No 2 trach patients per nurse on any shift
- 2+ High Acuity patients on one nurse
- Trach + High Acuity combination on one nurse
- No 2 heparin drip patients per nurse
- No heparin drip + transfusion risk on same nurse
- Max 2 isolation patients per nurse
- Max 3 OR-scheduled patients per nurse
- Max 3 expected discharges per nurse
- Max 3 wound care patients per nurse
- Charge nurse takes 0 patients on day shift
- Charge nurse takes max 1 patient on night shift

**Soft advisories (yellow):**
- Night shift trach patient — monitor workload
- Multiple aggressive patients — review workload
- Patients too spread out geographically
- Trach patient not near nursing station
- Getting report from 4+ outgoing nurses

## Patient Flags
Each patient can be flagged for:
Heparin Drip · Transfusion Risk · Isolation · Going to OR · 
Expected Discharge · High Acuity · Lines (PICC/Central) · 
Drains (JP/IR) · Wound Care · Trach · Aggressive Patient · 
1:1 (Safety / Suicide Precaution) · Police/Prison Custody · 
Other (with comment)

## Floor Geography
Rooms organized into 6 pods for smart clustering:
- **Pod A:** 1, 2, 3, 5 — front pod
- **Pod B:** 8, 9, 10, 11, 12, 43, 44 — nursing station (high acuity)
- **Pod C:** 15, 16, 17, 18, 22 — middle corridor
- **Pod D:** 35, 38, 39, 40, 41 — middle, behind station
- **Pod E:** 23, 24, 25, 26 — far back
- **Pod F:** 31, 32, 33, 34 — far back

## Tech Stack
HTML · CSS · Vanilla JavaScript · GitHub Pages

## Versions
- v1.0 — Core app, drag and drop, rules engine, print
- v2.0 — Auto-assign, returning nurses, geography clustering, new flags
- v2.1 — High acuity rules, numerical sorting, Other comment tooltip
- v3.0 — Outgoing shift screen, report continuity clustering
- v3.1 — localStorage save/restore, legend, hover tooltips, 
          flag reset, Back to Outgoing navigation

## Author
Samuel Onewo, RN BSN, MSDS
Charge Nurse & Clinical AI Specialist — Penn Medicine
Healthcare Informatics | Clinical Decision Support