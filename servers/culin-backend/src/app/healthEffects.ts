export type HealthEffect = {
  id: number;
  name: string;
};

// NOTE: Populate this list with the canonical mapping from your Flavor Recommender.
// The UI will render names and send the corresponding numeric ids to the backend.
export const HEALTH_EFFECTS: HealthEffect[] = [
  // Example entries (replace with your real mapping):
  { id: 1, name: "Anti-inflammatory" },
  { id: 2, name: "Heart health" },
  { id: 3, name: "Gut health" },
  { id: 4, name: "Blood sugar control" },
  { id: 5, name: "Immune support" },
];


