export interface DisciplineOption {
  value: string;
  label: string;
  icon: string;
}

export const CUSTOM_DISCIPLINE_VALUE = "__custom__";

export const DISCIPLINE_OPTIONS: DisciplineOption[] = [
  { value: "football", label: "Football", icon: "[BALL]" },
  { value: "basketball", label: "Basketball", icon: "[BALL]" },
  { value: "baseball", label: "Baseball", icon: "[BAT]" },
  { value: "softball", label: "Softball", icon: "[BAT]" },
  { value: "tennis", label: "Tennis", icon: "[RACKET]" },
  { value: "table_tennis", label: "Table Tennis", icon: "[PADDLE]" },
  { value: "padel", label: "Padel", icon: "[RACKET]" },
  { value: "volleyball", label: "Volleyball", icon: "[BALL]" },
  { value: "beach_volleyball", label: "Beach Volleyball", icon: "[BALL]" },
  { value: "ice_hockey", label: "Ice Hockey", icon: "[STICK]" },
  { value: "field_hockey", label: "Field Hockey", icon: "[STICK]" },
  { value: "cricket", label: "Cricket", icon: "[BAT]" },
  { value: "rugby", label: "Rugby", icon: "[BALL]" },
  { value: "badminton", label: "Badminton", icon: "[RACKET]" },
  { value: "handball", label: "Handball", icon: "[BALL]" },
  { value: "futsal", label: "Futsal", icon: "[BALL]" },
  { value: "swimming", label: "Swimming", icon: "[WAVE]" },
  { value: "athletics", label: "Athletics", icon: "[TRACK]" },
  { value: "cycling", label: "Cycling", icon: "[BIKE]" },
  { value: "running", label: "Running", icon: "[SHOE]" },
  { value: "martial_arts", label: "Martial Arts", icon: "[GLOVE]" },
  { value: "chess", label: "Chess", icon: "[PIECE]" },
  { value: "counter_strike_2", label: "Counter-Strike 2", icon: "[FPS]" },
  { value: "valorant", label: "Valorant", icon: "[FPS]" },
  { value: "league_of_legends", label: "League of Legends", icon: "[MOBA]" },
  { value: "fortnite", label: "Fortnite", icon: "[BR]" },
  { value: "rocket_league", label: "Rocket League", icon: "[CAR]" },
  { value: CUSTOM_DISCIPLINE_VALUE, label: "Other (custom)", icon: "[EDIT]" },
];

const valueToLabel = new Map(DISCIPLINE_OPTIONS.map((option) => [option.value, option.label]));

export function disciplineValueToLabel(value: string): string {
  return valueToLabel.get(value) ?? value;
}

export function labelToDisciplineValue(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  for (const option of DISCIPLINE_OPTIONS) {
    if (option.label.toLowerCase() === normalized) return option.value;
  }
  return null;
}
