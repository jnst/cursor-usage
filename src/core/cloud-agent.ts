import type { UsageEvent } from "./types.ts";

import { billable, byModel, byUser } from "./aggregate.ts";

/** IDs are grouped only within the caller's filtered analysis set, never as lifetime tasks. */
export function analyzeCloudAgents(events: UsageEvent[]) {
  const groups = new Map<string, UsageEvent[]>();
  for (const event of billable(events)) {
    const id = event.cloudAgentId?.trim();
    if (!id) continue;
    const group = groups.get(id) ?? [];
    group.push(event);
    groups.set(id, group);
  }
  const agents = [...groups]
    .map(([key, rows]) => {
      const models = byModel(rows);
      const users = byUser(rows)
        .map((row) => row.key)
        .sort();
      const times = rows.map((row) => row.date.getTime());
      return {
        key,
        cost: rows.reduce((sum, row) => sum + row.cost, 0),
        totalTokens: rows.reduce((sum, row) => sum + row.totalTokens, 0),
        eventCount: rows.length,
        users,
        models,
        firstObserved: new Date(
          times.reduce((min, time) => Math.min(min, time), Infinity),
        ).toISOString(),
        lastObserved: new Date(
          times.reduce((max, time) => Math.max(max, time), -Infinity),
        ).toISOString(),
      };
    })
    .sort((a, b) => b.cost - a.cost || a.key.localeCompare(b.key));
  const costs = agents.map((agent) => agent.cost).sort((a, b) => a - b);
  const count = agents.length;
  const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
  const middle = Math.floor(count / 2);
  const userCounts = new Map<string, number>();
  for (const agent of agents) {
    for (const user of agent.users) userCounts.set(user, (userCounts.get(user) ?? 0) + 1);
  }
  return {
    agents,
    summary: {
      agentCount: count,
      totalCost,
      totalTokens: agents.reduce((sum, agent) => sum + agent.totalTokens, 0),
      eventCount: agents.reduce((sum, agent) => sum + agent.eventCount, 0),
      meanCost: count ? totalCost / count : 0,
      medianCost: count ? (costs[middle - (count % 2 === 0 ? 1 : 0)]! + costs[middle]!) / 2 : 0,
      maxCost: costs.at(-1) ?? 0,
      top10CostShare:
        totalCost > 0
          ? (agents.slice(0, 10).reduce((sum, agent) => sum + agent.cost, 0) / totalCost) * 100
          : 0,
    },
    byUser: [...userCounts]
      .map(([key, agentCount]) => ({ key, agentCount }))
      .sort((a, b) => b.agentCount - a.agentCount || a.key.localeCompare(b.key)),
  };
}
