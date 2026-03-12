export interface TeamSettingsFormProps {
  teamId: number;
  team: { name: string; description: string; open: boolean; disciplines?: string[] };
  isLead: boolean;
  onSuccess?: (updated: { name: string; description: string; open: boolean; disciplines: string[] }) => void;
  onDisband?: () => void;
}
