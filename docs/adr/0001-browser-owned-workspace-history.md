# Use browser-owned history for the Learning Workspace

The Learning Workspace maps each Workspace Place to a canonical hash route and delegates navigation history to the browser's session history through the standard History API. We will remove the custom `pastViews` and `futureViews` stacks, avoid storing learning-data snapshots in history, and not introduce a routing or state-management dependency while the route set remains small; this preserves native Chrome back, forward, refresh, linking, and accessibility behavior with one source of navigation truth.
