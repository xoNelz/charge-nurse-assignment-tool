# Charge Nurse Assignment Tool

A clinical decision-support web application that helps 
charge nurses build safe, balanced patient assignments 
at the start of every shift.

Built by a charge nurse, for charge nurses.

## The Problem
Charge nurses manually distribute patients on the unit
staff using experience, memory, and instinct — with no 
real-time safety checks. A single bad assignment can 
overload a nurse or create dangerous medication conflicts.

## The Solution
An interactive drag-and-drop assignment board that flags 
rule violations in real time as assignments are built.

## Features
- Day / Night shift mode with shift-aware rules
- Room selection grid for occupied beds
- Drag and drop patient cards into nurse slots
- Click any patient card to add clinical flags
- Real-time violation warnings on nurse slots
- Editable nurse names on the board

## Clinical Rules Engine
The app enforces these assignment safety rules:
- Max 4 patients per nurse
- Trach patients reduce max to 3 on day shift
- No 2 trach patients per nurse on any shift
- No 2 heparin drip patients per nurse
- No heparin drip + transfusion risk on same nurse
- Max 2 isolation patients per nurse
- Max 2 OR-scheduled patients per nurse
- Max 2 expected discharges per nurse
- Max 2 wound care patients per nurse
- Charge nurse takes 0 patients on day shift
- Charge nurse takes max 1 patient on night shift

## Patient Flags
Each patient can be flagged for:
Heparin Drip · Transfusion Risk · Isolation · 
Going to OR · Expected Discharge · High Acuity · 
Lines (PICC/Central) · Drains (JP/IR) · 
Wound Care · Trach

## Tech Stack
HTML · CSS · JavaScript

## Author
Samuel Onewo, RN BSN, NSDS.
Clinical Informatics Professional
