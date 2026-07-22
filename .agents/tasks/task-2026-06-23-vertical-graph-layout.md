# Implementation Task: Vertical Graph Layout Refactoring

## Description
Updated the graph generation logic to implement a vertical hub-and-spoke layout for inventory tracking.

## Changes
- Modified `InventoryItemsService` to include the root Item node and explicitly map edges to grouped workflow modules (`group-inventory`, `group-production`, `group-bom`).
- Updated `GraphLayoutService` to nest module groups inside a vertical wrapper (`group-all`) with `DOWN` direction, while keeping the root graph direction `RIGHT`.
- Increased bounding box size for ELK nodes (width 360, height 200) to ensure generous padding and avoid overlapping nodes.

## Status
Completed and verified.
