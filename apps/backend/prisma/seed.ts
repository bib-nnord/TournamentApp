import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Using 10 rounds (vs production 16) so seeding completes quickly
const SALT_ROUNDS = 10;

const USERS = [
  { username: 'marcuswebb',      display_name: 'Marcus Webb',      email: 'marcus.webb@example.com',       location: 'Chicago, IL',       bio: 'Weekend warrior and table tennis enthusiast.',         games_sports: ['Table Tennis', 'Chess'] },
  { username: 'lenafischer',     display_name: 'Lena Fischer',     email: 'lena.fischer@example.com',      location: 'Berlin, Germany',   bio: 'Marathon runner, coffee addict.',                       games_sports: ['Running', 'Cycling'] },
  { username: 'sophieandersen',  display_name: 'Sophie Andersen',  email: 'sophie.andersen@example.com',   location: 'Copenhagen, Denmark', bio: 'Volleyball player and occasional chess nerd.',         games_sports: ['Volleyball', 'Chess'] },
  { username: 'jakenguyern',     display_name: 'Jake Nguyen',      email: 'jake.nguyen@example.com',       location: 'San Jose, CA',      bio: 'Competitive FPS player. Top 500 last season.',          games_sports: ['FPS', 'Basketball'] },
  { username: 'carlaromero',     display_name: 'Carla Romero',     email: 'carla.romero@example.com',      location: 'Barcelona, Spain',  bio: 'Football coach and weekend referee.',                   games_sports: ['Football', 'Swimming'] },
  { username: 'tomblackwell',    display_name: 'Tom Blackwell',    email: 'tom.blackwell@example.com',     location: 'Manchester, UK',    bio: 'Darts champion, pub quiz regular.',                     games_sports: ['Darts', 'Snooker'] },
  { username: 'ingridholm',      display_name: 'Ingrid Holm',      email: 'ingrid.holm@example.com',       location: 'Oslo, Norway',      bio: 'Cross-country skiing in winter, tennis in summer.',     games_sports: ['Skiing', 'Tennis'] },
  { username: 'ravimehta',       display_name: 'Ravi Mehta',       email: 'ravi.mehta@example.com',        location: 'Mumbai, India',     bio: 'Cricket stats obsessive and fantasy league manager.',   games_sports: ['Cricket', 'Badminton'] },
  { username: 'zoepearce',       display_name: 'Zoe Pearce',       email: 'zoe.pearce@example.com',        location: 'Sydney, Australia', bio: 'Surfer, swimmer, beach volleyball regular.',            games_sports: ['Surfing', 'Volleyball'] },
  { username: 'oscarlindqvist',  display_name: 'Oscar Lindqvist',  email: 'oscar.lindqvist@example.com',   location: 'Stockholm, Sweden', bio: 'Ice hockey fanatic and amateur golfer.',                games_sports: ['Ice Hockey', 'Golf'] },
  { username: 'hannahfox',       display_name: 'Hannah Fox',       email: 'hannah.fox@example.com',        location: 'Toronto, Canada',   bio: 'Yoga teacher who secretly loves dodgeball.',           games_sports: ['Yoga', 'Dodgeball'] },
  { username: 'diegovarela',     display_name: 'Diego Varela',     email: 'diego.varela@example.com',      location: 'Buenos Aires, AR',  bio: 'Football forever. Boca fan. Works in sports analytics.',games_sports: ['Football', 'Running'] },
  { username: 'emmalarsson',     display_name: 'Emma Larsson',     email: 'emma.larsson@example.com',      location: 'Gothenburg, Sweden', bio: 'Competitive swimmer and open water enthusiast.',       games_sports: ['Swimming', 'Triathlon'] },
  { username: 'samkowalski',     display_name: 'Sam Kowalski',     email: 'sam.kowalski@example.com',      location: 'Warsaw, Poland',    bio: 'Esports tournament organiser and part-time streamer.',  games_sports: ['FPS', 'RTS'] },
  { username: 'niaadeyemi',      display_name: 'Nia Adeyemi',      email: 'nia.adeyemi@example.com',       location: 'Lagos, Nigeria',    bio: 'Track and field, 400m specialist.',                     games_sports: ['Athletics', 'Basketball'] },
  { username: 'colemurray',      display_name: 'Cole Murray',      email: 'cole.murray@example.com',       location: 'Dublin, Ireland',   bio: 'GAA hurling player and casual golfer.',                 games_sports: ['Hurling', 'Golf'] },
  { username: 'astridvang',      display_name: 'Astrid Vang',      email: 'astrid.vang@example.com',       location: 'Aarhus, Denmark',   bio: 'Handball goalkeeper, team captain for six years.',      games_sports: ['Handball', 'Swimming'] },
  { username: 'leonbauer',       display_name: 'Leon Bauer',       email: 'leon.bauer@example.com',        location: 'Munich, Germany',   bio: 'Football midfielder, big fan of tactics and data.',     games_sports: ['Football', 'Tennis'] },
  { username: 'priyanair',       display_name: 'Priya Nair',       email: 'priya.nair@example.com',        location: 'Bangalore, India',  bio: 'Badminton semi-pro, loves board game nights.',          games_sports: ['Badminton', 'Chess'] },
  { username: 'benhartley',      display_name: 'Ben Hartley',      email: 'ben.hartley@example.com',       location: 'Bristol, UK',       bio: 'Rugby number 8, gym obsessive, terrible at chess.',     games_sports: ['Rugby', 'Gym'] },
];

const TEAMS = [
  {
    name: 'Iron Wolves',
    description: 'Competitive multi-sport team. We train hard and play harder.',
    is_open: false,
    disciplines: ['FPS', 'RTS'],
    lead: 'samkowalski',
    members: ['jakenguyern', 'leonbauer', 'tomblackwell', 'benhartley'],
  },
  {
    name: 'Riverside Strikers',
    description: 'Football club for players of all levels. Friendly matches every weekend.',
    is_open: true,
    disciplines: ['Football'],
    lead: 'carlaromero',
    members: ['diegovarela', 'leonbauer', 'niaadeyemi', 'colemurray'],
  },
  {
    name: 'Circuit Breakers',
    description: 'Esports org running community tournaments and ranked ladders.',
    is_open: false,
    disciplines: ['FPS', 'Chess'],
    lead: 'jakenguyern',
    members: ['samkowalski', 'marcuswebb', 'priyanair'],
  },
  {
    name: 'Alpine Runners',
    description: 'Running club for trail and road athletes. Weekly group runs.',
    is_open: true,
    disciplines: ['Running', 'Cycling', 'Triathlon'],
    lead: 'lenafischer',
    members: ['emmalarsson', 'niaadeyemi', 'ingridholm'],
  },
  {
    name: 'Harbor Sharks',
    description: 'Swimming and open-water squad. Racing season April to September.',
    is_open: false,
    disciplines: ['Swimming', 'Triathlon'],
    lead: 'emmalarsson',
    members: ['zoepearce', 'astridvang', 'hannahfox'],
  },
  {
    name: 'Steel Ravens',
    description: 'Mixed sports team. We compete in whatever the season throws at us.',
    is_open: true,
    disciplines: ['Basketball', 'Volleyball', 'Dodgeball'],
    lead: 'oscarlindqvist',
    members: ['sophieandersen', 'zoepearce', 'hannahfox', 'niaadeyemi', 'colemurray'],
  },
  {
    name: 'Golden Owls',
    description: 'Strategy and mind sports collective. Chess, board games, and betting on darts.',
    is_open: true,
    disciplines: ['Chess', 'Darts', 'Snooker'],
    lead: 'marcuswebb',
    members: ['priyanair', 'tomblackwell', 'sophieandersen'],
  },
  {
    name: 'Southside Ballers',
    description: 'Street basketball crew. 3-on-3, half court, no excuses.',
    is_open: false,
    disciplines: ['Basketball'],
    lead: 'niaadeyemi',
    members: ['jakenguyern', 'benhartley', 'diegovarela'],
  },
];

async function main() {
  console.log('🌱  Seeding database…\n');

  // ── Users ────────────────────────────────────────────────────────────────
  console.log(`Creating ${USERS.length} users…`);
  const userMap: Record<string, number> = {};

  for (const u of USERS) {
    const password_hash = await bcrypt.hash(u.username, SALT_ROUNDS);
    const created = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        email: u.email,
        password_hash,
        display_name: u.display_name,
        bio: u.bio,
        location: u.location,
        email_confirmed: true,
      },
    });
    userMap[u.username] = created.user_id;
    process.stdout.write(`  ✓ ${u.display_name} (@${u.username})\n`);
  }

  // ── Teams ────────────────────────────────────────────────────────────────
  console.log(`\nCreating ${TEAMS.length} teams…`);

  for (const t of TEAMS) {
    const leadId = userMap[t.lead];
    if (!leadId) {
      console.warn(`  ⚠ Lead "${t.lead}" not found, skipping team "${t.name}"`);
      continue;
    }

    const team = await prisma.team.upsert({
      where: { team_id: (await prisma.team.findFirst({ where: { name: t.name } }))?.team_id ?? 0 },
      update: {},
      create: {
        name: t.name,
        description: t.description,
        is_open: t.is_open,
        disciplines: t.disciplines,
        created_by: leadId,
        members: {
          create: [
            { user_id: leadId, role: 'lead' },
            ...t.members
              .filter((m) => userMap[m] !== undefined && userMap[m] !== leadId)
              .map((m) => ({ user_id: userMap[m], role: 'member' as const })),
          ],
        },
      },
    });

    process.stdout.write(`  ✓ ${team.name} (lead: ${t.lead})\n`);
  }

  console.log('\n✅  Done.\n');
  console.log('Credentials: username = password for every user.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
