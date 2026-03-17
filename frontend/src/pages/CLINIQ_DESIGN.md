# ClinIQ — UI redesign summary

## High-level layout

- **Single-column, max-width 900px**, centered. Dark-first theme (deep navy `#0a0b0f`).
- **Header**: ClinIQ logo + tagline. No stepper; replaced by a **horizontal pipeline** (Ingest → Detect → Enrich → Analyze) with live status per stage.
- **Content**: One step visible at a time. Each step uses a **content card** with title + short description, then primary actions. Results step adds a **highlights strip** (e.g. “2 signals detected”) and structured cards for findings.

## Component breakdown

| Component | Role |
|-----------|------|
| **cliniq-pipeline** | Horizontal flow: 4 stages with icon (1–4), label, and status (idle / current / processing / done). Connector line behind. |
| **cliniq-dropzone** | Upload area: dashed border, hover/drag state, smart hint. After upload: file preview card + progress bar (animated when loading). |
| **cliniq-card** | Glass-style panel: surface, border, soft shadow. Used for document preview and grouping. |
| **cliniq-doc-card** | Document preview with optional **scanning** effect (animated gradient sweep when “Detect” is running). |
| **cliniq-highlights** | Pill-style tags: e.g. “2 signals detected” (green), filename (neutral). Semantic colors: valid / attention / anomaly. |
| **pathology-item / enrich-section** | Existing cards with ClinIQ overrides: rounded corners, shadow, accepted = green tint, declined = muted. |
| **cliniq-content** | Wrapper for step body; fade-in transition when step changes. |

## Microcopy (examples)

- **Header**: “ClinIQ” / “Turn medical documents into structured insights. Ingest, detect, enrich, analyze.”
- **Step 1**: “Drop your document to unlock insights” / “We support PDFs, scans, and handwritten notes” / “We extract text automatically.”
- **Step 2**: “Detect key signals” / “Run extraction on the parsed text to identify pathologies and findings.” / “Detecting…”
- **Step 3**: “What we found” / “Review and confirm findings, then enrich with context.” / “Enrich with context” (button).
- **Step 4**: “Enrich with context” / “Paragraphs from the document linked to the findings…”
- **Actions**: “Continue to detect signals”, “Add finding”, “Back to findings”, “Analyze another document”.

## Animations & interactions

- **Pipeline**: Current stage = accent border + subtle glow; processing = pulse animation; done = teal fill + glow.
- **Dropzone**: Hover/drag = scale(1.005), accent border, light teal background. Loading = indeterminate progress bar animation.
- **Detect step**: Document card gets `.cliniq-doc-card--scanning` while extracting: vertical gradient sweep (keyframes `cliniq-scan`).
- **Step change**: `.cliniq-content` uses `cliniq-fade-in` (opacity + translateY 8px → 0).
- **Buttons**: Primary has teal glow shadow; hover increases glow. Accepted/declined cards use semantic border and background.

## Visual tokens (ClinIQ)

- **Background**: `--cliniq-bg` #0a0b0f, **surface** #12141a, **elevated** #181b22.
- **Accent**: teal `#0d9488` with glow `rgba(13, 148, 136, 0.35)`.
- **Semantic**: success #22c55e, attention #f59e0b, anomaly #ef4444.
- **Radius**: 14px (cards), 10px (small elements). **Shadow**: 0 4px 24px rgba(0,0,0,0.25).

## Optional (not implemented)

- **AI assistant panel**: Right-side panel with natural-language summary of findings (could be added as a collapsible sidebar).
- **Timeline view**: Vertical timeline of processing steps (could replace or complement the horizontal pipeline on small screens).

## Trust & restraint

- No decorative clutter; spacing and typography carry hierarchy.
- Semantic color only for status (accepted/declined) and highlights.
- Copy is professional and action-oriented, suitable for physicians and analysts.
