# Grasp Architecture Document

Product and technical blueprint for a webcam-gesture-controlled 3D learning platform. MVP domain: human heart anatomy. Read `00` first; it names the three hardest problems and the smallest prototype that validates the idea. Every file tags its content **MVP**, **V1**, or **Future** (legend in the `project-conventions` skill).

Phase B status: **complete 2026-10-04**. All 20 files written by the owning agents, reviewed by `architecture-critic` in three passes (coverage and locked positions; cross-file consistency and mechanics; post-fix verification), and fixed. Final verdict: PASS WITH FIXES, all fixes applied. Open questions for the user are collected at the end of each file.

| # | File | Format sections | Owner | Status |
|---|---|---|---|---|
| 00 | `00-executive-summary.md` | 1 Executive Summary; three hardest problems; smallest viable prototype | product-strategist | reviewed: PASS WITH FIXES, fixes applied |
| 01 | `01-product-definition.md` | 2 Product Vision, 3 Problem Statement, 4 Target Users | product-strategist | reviewed: PASS WITH FIXES, fixes applied |
| 02 | `02-learning-experience.md` | 5 Core Learning Experience; 7 failure states | product-strategist, learning-designer, ux-designer | reviewed: PASS WITH FIXES, fixes applied |
| 03 | `03-system-architecture.md` | 6 System Architecture | platform-architect | reviewed: PASS WITH FIXES, fixes applied |
| 04 | `04-computer-vision.md` | 7 Computer Vision Architecture; gesture pseudocode | cv-engineer | reviewed: PASS WITH FIXES, fixes applied |
| 05 | `05-3d-interaction.md` | 8 3D Interaction Architecture; interaction pseudocode | three-engineer | reviewed: PASS WITH FIXES, fixes applied |
| 06 | `06-learning-engine.md` | 9 Learning Engine; evaluation pseudocode | learning-designer | reviewed: PASS WITH FIXES, fixes applied |
| 07 | `07-ai-tutor.md` | 10 AI Tutor | ai-tutor-architect | rewritten 2026-10-05 (template tutor, no paid APIs); re-reviewed: PASS WITH FIXES, fixes applied |
| 08 | `08-gamification.md` | 11 Gamification | learning-designer | reviewed: PASS WITH FIXES, fixes applied |
| 09 | `09-database.md` | 12 Database Architecture | platform-architect | reviewed: PASS WITH FIXES, fixes applied |
| 10 | `10-3d-content-system.md` | 13 3D Content Architecture | platform-architect | reviewed: PASS WITH FIXES, fixes applied |
| 11 | `11-ui-ux.md` | 14 UI/UX Architecture | ux-designer | reviewed: PASS WITH FIXES, fixes applied |
| 12 | `12-mvp-definition.md` | 15 MVP Definition | product-strategist | reviewed: PASS WITH FIXES, fixes applied |
| 13 | `13-roadmap.md` | 16 Development Roadmap | product-strategist | reviewed: PASS WITH FIXES, fixes applied |
| 14 | `14-evaluation-methodology.md` | 17 Evaluation Methodology | research-methodologist, cv-engineer | reviewed: PASS WITH FIXES, fixes applied |
| 15 | `15-risks-security-scalability.md` | 18 Technical Risks, 19 Security and Privacy, 20 Scalability; 14 challenges | cv-engineer, three-engineer, platform-architect | reviewed: PASS WITH FIXES, fixes applied |
| 16 | `16-folder-structure.md` | 21 Project Folder Structure | platform-architect | reviewed: PASS WITH FIXES, fixes applied |
| 17 | `17-first-prototype-plan.md` | 22 First Prototype Implementation Plan | three-engineer, cv-engineer | reviewed: PASS WITH FIXES, fixes applied |
| 18 | `18-future-expansion.md` | 23 Future Expansion | platform-architect | reviewed: PASS WITH FIXES, fixes applied |
| 19 | `19-tech-stack-and-final-diagram.md` | 24 Recommended Technology Stack, 25 Final Architecture Diagram | platform-architect | reviewed: PASS WITH FIXES, fixes applied |

Conventions: Mermaid diagrams, GFM tables, relative links between files, canonical identifiers from the glossary. Review every file with `/arch-review` before marking it done.
