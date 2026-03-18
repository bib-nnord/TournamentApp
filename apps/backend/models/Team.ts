import User from './User';

export type TeamRole = 'lead' | 'moderator' | 'member' | 'none';

export interface TeamMemberParams {
  id: number;
  username: string | null;
  displayName: string | null;
  role: TeamRole;
}

export class TeamMember {
  id: number;
  username: string | null;
  displayName: string | null;
  role: TeamRole;

  constructor({ id, username, displayName, role }: TeamMemberParams) {
    this.id = id;
    this.username = username;
    this.displayName = displayName;
    this.role = role;
  }
}

export interface TeamSummaryParams {
  id: number;
  name: string;
  role: TeamRole;
  membersCount: number;
  isOpen: boolean;
}

export class TeamSummary {
  id: number;
  name: string;
  role: TeamRole;
  membersCount: number;
  isOpen: boolean;

  constructor({ id, name, role, membersCount, isOpen }: TeamSummaryParams) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.membersCount = membersCount;
    this.isOpen = isOpen;
  }
}

export interface TeamParams {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isOpen: boolean;
  disciplines?: string[];
  creator?: User | null;
  members?: TeamMember[];
  membersCount?: number;
  myRole?: TeamRole;
}

class Team {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isOpen: boolean;
  disciplines: string[];
  creator: User | null;
  members: TeamMember[];
  membersCount: number;
  myRole: TeamRole;

  constructor({
    id,
    name,
    description = null,
    imageUrl = null,
    isOpen,
    disciplines = [],
    creator = null,
    members = [],
    membersCount,
    myRole = 'none',
  }: TeamParams) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.imageUrl = imageUrl;
    this.isOpen = isOpen;
    this.disciplines = disciplines;
    this.creator = creator;
    this.members = members;
    this.membersCount = membersCount ?? members.length;
    this.myRole = myRole;
  }
}

export default Team;
