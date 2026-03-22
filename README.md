# Charge Nurse Assignment Tool

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
geographic clustering and returning nurse continuity.

## Features
- Day / Night shift mode with shift-aware clinical rules
- Room selection grid for all 29 occupied beds
- Drag and drop patient cards into nurse slots (desktop + mobile)
- Long press any patient card to add clinical flags
- Real-time violation warnings on nurse slots
- Editable nurse names on the board
- Returning nurse toggle with room continuity
- Auto-assign with geographic clustering and fairness balancing
- Clear Assignment to reset and start over
- Print assignment sheet as a clean one-page table

## Clinical Rules Engine
The app enforces these assignment safety rules in real time:
- Max 4 patients per nurse
- Min 3 patients per nurse (auto-assign)
- Trach patients reduce max to 3 on day shift
- Night shift allows 4 patients including a trach with advisory
- No 2 trach patients per nurse on any shift
- No 2 heparin drip patients per nurse
- No heparin drip + transfusion risk on same nurse
- Max 2 isolation patients per nurse
- Max 3 OR-scheduled patients per nurse
- Max 3 expected discharges per nurse
- Max 3 wound care patients per nurse
- Charge nurse takes 0 patients on day shift
- Charge nurse takes max 1 patient on night shift
- Multiple aggressive patients triggers soft advisory
- Geographic spread advisory when rooms are disconnected
- Trach placement advisory when not near nursing station

## Patient Flags
Each patient can be flagged for:
Heparin Drip · Transfusion Risk · Isolation · Going to OR · 
Expected Discharge · High Acuity · Lines (PICC/Central) · 
Drains (JP/IR) · Wound Care · Trach · Aggressive Patient · 
1:1 Safety (Fall/Elopement) · 1:1 Suicide Precaution · 
Police/Prison Custody

## Floor Geography
Rooms are organized into 6 pods for smart clustering:
- Pod A: 1, 2, 3, 5 (front)
- Pod B: 8, 9, 10, 11, 12, 43, 44 (nursing station)
- Pod C: 15, 16, 17, 18, 22 (middle corridor)
- Pod D: 35, 38, 39, 40, 41 (middle, behind station)
- Pod E: 23, 24, 25, 26 (far back)
- Pod F: 31, 32, 33, 34 (far back)

## Tech Stack
HTML · CSS · Vanilla JavaScript · GitHub Pages

## Version
v2.0 — March 2026

## Author
Samuel Onewo, RN BSN, MSDS
Charge Nurse & Clinical AI Specialist — Penn Medicine
Healthcare Informatics | Clinical Decision Support