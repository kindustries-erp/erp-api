---
title: "BOM Excel Upload"
date: "2026-06-23"
author: "AI"
status: "Completed"
---

# Objective
Implement the ability to upload a BOM (Excel/CSV) from the Web UI, parsing it in the backend, and populating the BOM lines dynamically.

# Changes

1. **liouni-erp-api**:
    - Removed `xlsx` package in favor of `exceljs`.
    - Added `GET /bom/import/template` to generate the template with frozen header and list of items.
    - Added `POST /bom/import/parse` to validate the uploaded CSV/XLSX and map to `ErpBomLine` format.

2. **liouni-erp-web**:
    - Added UI buttons for "Template" and "Upload" in `BomFormDrawer`.
    - Merged imported line elements smoothly with Combobox to fix placeholder issues.
    - Updated `bomCoreApi.ts`.

# Verification
Uploaded a file with missing attributes and validated it successfully parses and maps to the local lines properly. Combobox displays correct labels.
