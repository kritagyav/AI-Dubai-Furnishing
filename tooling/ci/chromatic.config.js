// Chromatic visual regression testing
// Chromatic runs via GitHub Action (chromaui/action) in ci.yml,
// not via this config file. This file is kept for reference only.
//
// Configuration is set directly in the GitHub Action:
//   - projectToken: from CHROMATIC_PROJECT_TOKEN secret
//   - exitZeroOnChanges: true (don't fail on visual changes)
//   - autoAcceptChanges: "main" (auto-accept baseline on main)
//   - onlyChanged: true (TurboSnap - only test changed stories)

export default {
  projectToken: process.env.CHROMATIC_PROJECT_TOKEN,
};
