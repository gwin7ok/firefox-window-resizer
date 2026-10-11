# Changelog

All notable changes to this project are recorded in this file.

The version in `manifest.json` is the single source of truth. Each release has a
`## [x.y.z] - YYYY-MM-DD` section; the GitHub Release notes are extracted from it.


## [Unreleased]


## [1.1.0] - 2026-10-11

Context menus
- Add "複製を別ウィンドウで開く" menu to the page background and tab context menus: the tab is duplicated and only the duplicate is moved to a new window with the chosen preset.
- Add "別ウィンドウで開く" menu to bookmark context menus (bookmarks toolbar / menu / sidebar / library). Adds the `bookmarks` permission.
- Add "履歴を別ウィンドウで開く" to the toolbar icon context menu; it opens the history sidebar.
- Fix: the tab context menu now moves the right-clicked tab instead of the window's active tab.

History sidebar
- Add a history sidebar (search + list). Choose a preset each time to open a history entry in a new window. Right-click an entry for a one-level preset menu. Adds the `history` permission.

Release process
- Add CHANGELOG-driven release workflow (tag `vX.Y.Z` -> signed XPI attached to a GitHub Release).

## [1.0.0] - 2025-10

- Add context menu feature (link / page / tab).
- Support multi-line preset names.
- Reorder presets by drag & drop.
- Improve preset table display.
- Improve tab handling (create an empty window, then move the tab to keep its state).
- Improve DPR support.
