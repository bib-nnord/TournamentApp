export interface TeamSettingsFormProps {
  team: { name: string; description: string; open: boolean };
  isLead: boolean;
  onSuccess?: () => void;
}
